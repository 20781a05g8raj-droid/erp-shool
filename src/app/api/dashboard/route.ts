import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // ============== ADMIN VIEW (school_admin, super_admin, accountant, librarian, transport_manager, hr) ==============
  const isAdminRole = ["school_admin", "super_admin", "accountant", "librarian", "transport_manager", "hr"].includes(user.role);

  if (isAdminRole) {
    return await getAdminDashboard(schoolId, user.role);
  }

  // ============== TEACHER VIEW ==============
  if (user.role === "teacher" && user.staffId) {
    return await getTeacherDashboard(schoolId, user.staffId, user.name);
  }

  // ============== STUDENT / PARENT VIEW ==============
  if ((user.role === "student" || user.role === "parent") && user.studentId) {
    return await getStudentDashboard(schoolId, user.studentId, user.role, user.name);
  }

  // Fallback to admin dashboard if role doesn't match specific views
  return await getAdminDashboard(schoolId, user.role);
}

// ==================== ADMIN DASHBOARD ====================
async function getAdminDashboard(schoolId: string, role: string) {
  const [students, staff, classes, books, vehicles, routes, notices, exams, homework] = await Promise.all([
    db.student.count({ where: { schoolId, status: "active" } }),
    db.staff.count({ where: { schoolId, status: "active" } }),
    db.class.count({ where: { schoolId } }),
    db.libraryBook.count({ where: { schoolId } }),
    db.vehicle.count({ where: { schoolId } }),
    db.transportRoute.count({ where: { schoolId } }),
    db.notice.count({ where: { schoolId } }),
    db.exam.count({ where: { schoolId } }),
    db.homework.count({ where: { schoolId } }),
  ]);

  const studentFees = await db.studentFee.findMany({
    where: { student: { schoolId } },
    select: { totalAmount: true, paidAmount: true, dueAmount: true, status: true },
  });
  const totalFeeExpected = studentFees.reduce((sum, f) => sum + f.totalAmount, 0);
  const totalFeeCollected = studentFees.reduce((sum, f) => sum + f.paidAmount, 0);
  const totalFeeDue = studentFees.reduce((sum, f) => sum + f.dueAmount, 0);
  const feeDefaulters = studentFees.filter((f) => f.status !== "paid").length;

  const today = new Date();
  const attendanceTrend: { date: string; present: number; absent: number; rate: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayRecords = await db.studentAttendance.findMany({
      where: { date: dateStr, student: { schoolId } },
      select: { status: true },
    });
    const present = dayRecords.filter((r) => r.status === "present" || r.status === "late").length;
    const absent = dayRecords.filter((r) => r.status === "absent").length;
    const rate = dayRecords.length > 0 ? (present / dayRecords.length) * 100 : 0;
    attendanceTrend.push({
      date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      present, absent, rate: Math.round(rate),
    });
  }

  const feeTrend: { month: string; collected: number; expected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const payments = await db.feePayment.findMany({
      where: {
        studentFee: { student: { schoolId } },
        paymentDate: { startsWith: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` },
      },
      select: { amount: true },
    });
    const collected = payments.reduce((sum, p) => sum + p.amount, 0);
    feeTrend.push({ month: monthName, collected, expected: Math.round(totalFeeExpected / 6) });
  }

  const latestExam = await db.exam.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: { results: { include: { subject: true } } },
  });
  const examPerformance: { subject: string; avgMarks: number }[] = [];
  if (latestExam) {
    const subjectGroups: Record<string, { total: number; count: number; name: string }> = {};
    for (const r of latestExam.results) {
      const key = r.subjectId;
      if (!subjectGroups[key]) subjectGroups[key] = { total: 0, count: 0, name: r.subject?.name || "Unknown" };
      subjectGroups[key].total += r.marksObtained;
      subjectGroups[key].count += 1;
    }
    for (const key of Object.keys(subjectGroups)) {
      const g = subjectGroups[key];
      examPerformance.push({ subject: g.name, avgMarks: Math.round(g.total / g.count) });
    }
  }

  const maleStudents = await db.student.count({ where: { schoolId, gender: "male", status: "active" } });
  const femaleStudents = await db.student.count({ where: { schoolId, gender: "female", status: "active" } });
  const otherStudents = await db.student.count({ where: { schoolId, status: "active", NOT: { OR: [{ gender: "male" }, { gender: "female" }] } } });

  const allClasses = await db.class.findMany({ where: { schoolId }, orderBy: { order: "asc" }, select: { id: true, name: true } });
  const classDistribution: { name: string; count: number }[] = [];
  for (const cls of allClasses) {
    const count = await db.student.count({ where: { classId: cls.id, status: "active" } });
    if (count > 0) classDistribution.push({ name: cls.name, count });
  }

  const todayStr = today.toISOString().split("T")[0];
  const todayAttendance = await db.studentAttendance.findMany({ where: { date: todayStr, student: { schoolId } }, select: { status: true } });
  const todayPresent = todayAttendance.filter((a) => a.status === "present" || a.status === "late").length;
  const todayRate = todayAttendance.length > 0 ? Math.round((todayPresent / todayAttendance.length) * 100) : 0;

  const recentNotices = await db.notice.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5 });
  const recentStudents = await db.student.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5, include: { class: true, section: true } });

  return NextResponse.json({
    role: "admin",
    userRole: role,
    stats: { students, staff, classes, books, vehicles, routes, notices, exams, homework, feeDefaulters, totalFeeExpected, totalFeeCollected, totalFeeDue, todayAttendanceRate: todayRate },
    attendanceTrend, feeTrend, examPerformance,
    genderDistribution: [{ name: "Male", value: maleStudents }, { name: "Female", value: femaleStudents }, ...(otherStudents > 0 ? [{ name: "Other", value: otherStudents }] : [])],
    classDistribution, recentNotices, recentStudents,
    latestExamName: latestExam?.name || null,
  });
}

// ==================== TEACHER DASHBOARD ====================
async function getTeacherDashboard(schoolId: string, staffId: string, teacherName: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

  // Get teacher's timetable slots
  const myTimetable = await db.timetableSlot.findMany({
    where: { staffId, class: { schoolId } },
    include: { subject: true, class: true, section: true },
  });

  // My classes = distinct class/section combos
  const classSectionSet = new Set<string>();
  myTimetable.forEach((s) => classSectionSet.add(`${s.classId}-${s.sectionId}`));
  const myClassesCount = classSectionSet.size;

  // My students = count of students in those classes
  const classIds = [...new Set(myTimetable.map((s) => s.classId))];
  const myStudents = classIds.length > 0 ? await db.student.count({ where: { classId: { in: classIds }, status: "active" } }) : 0;

  // Homework posted by this teacher
  const homeworkPosted = await db.homework.count({ where: { staffId, schoolId } });
  const myHomework = await db.homework.findMany({
    where: { staffId, schoolId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { class: true, subject: true },
  });

  // Today's periods
  const todayPeriods = myTimetable.filter((s) => s.day === dayName);
  const todayPeriodsCount = todayPeriods.length;

  // Attendance marking trend (last 7 days) — how many students this teacher marked
  const attendanceMarkingTrend: { date: string; present: number; absent: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const records = await db.studentAttendance.findMany({
      where: { date: dateStr, student: { classId: { in: classIds } } },
      select: { status: true },
    });
    const present = records.filter((r) => r.status === "present" || r.status === "late").length;
    const absent = records.filter((r) => r.status === "absent").length;
    attendanceMarkingTrend.push({
      date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      present, absent,
    });
  }

  // My classes performance — exam results for classes I teach
  const myClassesPerformance: { subject: string; avgMarks: number }[] = [];
  if (classIds.length > 0) {
    const examResults = await db.examResult.findMany({
      where: { student: { classId: { in: classIds } } },
      include: { subject: true },
    });
    const subjectGroups: Record<string, { total: number; count: number; name: string }> = {};
    for (const r of examResults) {
      const key = r.subjectId;
      if (!subjectGroups[key]) subjectGroups[key] = { total: 0, count: 0, name: r.subject?.name || "Unknown" };
      subjectGroups[key].total += r.marksObtained;
      subjectGroups[key].count += 1;
    }
    for (const key of Object.keys(subjectGroups)) {
      const g = subjectGroups[key];
      myClassesPerformance.push({ subject: g.name, avgMarks: Math.round(g.total / g.count) });
    }
  }

  // My leaves
  const myLeaves = await db.staffLeave.findMany({
    where: { staffId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Recent notices for teacher
  const recentNotices = await db.notice.findMany({
    where: {
      schoolId,
      OR: [
        { targetAudience: "all" },
        { targetAudience: "role", targetRole: "teacher" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Sort today's timetable by period
  const myTimetableToday = todayPeriods.sort((a, b) => a.period - b.period);

  return NextResponse.json({
    role: "teacher",
    teacherName,
    stats: { myClasses: myClassesCount, myStudents, homeworkPosted, todayPeriods: todayPeriodsCount },
    attendanceMarkingTrend,
    myClassesPerformance,
    myTimetableToday: myTimetableToday.map((s) => ({
      period: s.period,
      subject: s.subject?.name || "—",
      class: `${s.class?.name || ""} ${s.section?.name || ""}`.trim(),
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    myHomework: myHomework.map((h) => ({
      id: h.id, title: h.title, class: h.class?.name || "—", subject: h.subject?.name || "—", dueDate: h.dueDate,
    })),
    myLeaves: myLeaves.map((l) => ({
      id: l.id, fromDate: l.fromDate, toDate: l.toDate, type: l.type, status: l.status, reason: l.reason,
    })),
    recentNotices: recentNotices.map((n) => ({ id: n.id, title: n.title, content: n.content, date: n.date })),
  });
}

// ==================== STUDENT / PARENT DASHBOARD ====================
async function getStudentDashboard(schoolId: string, studentId: string, viewerRole: string, viewerName: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

  // Student info
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { class: true, section: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const studentName = `${student.firstName} ${student.lastName}`;
  const studentInfo = {
    name: studentName,
    admissionNumber: student.admissionNumber,
    className: student.class?.name || "—",
    sectionName: student.section?.name || "—",
    photo: student.photo,
  };

  // Attendance
  const allAttendance = await db.studentAttendance.findMany({
    where: { studentId },
    orderBy: { date: "asc" },
  });
  const presentCount = allAttendance.filter((a) => a.status === "present").length;
  const lateCount = allAttendance.filter((a) => a.status === "late").length;
  const absentCount = allAttendance.filter((a) => a.status === "absent").length;
  const leaveCount = allAttendance.filter((a) => a.status === "leave").length;
  const totalDays = allAttendance.length;
  const attendancePercent = totalDays > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalDays) * 100) : 0;

  // Attendance trend last 30 days
  const myAttendanceTrend: { date: string; status: string; day: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const record = allAttendance.find((a) => a.date === dateStr);
    myAttendanceTrend.push({
      date: dateStr,
      day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      status: record?.status || "no_data",
    });
  }

  // Fees
  const studentFees = await db.studentFee.findMany({
    where: { studentId },
    include: { feeStructure: true, payments: true },
  });
  const feeTotal = studentFees.reduce((s, f) => s + f.totalAmount, 0);
  const feePaid = studentFees.reduce((s, f) => s + f.paidAmount, 0);
  const feeDue = studentFees.reduce((s, f) => s + f.dueAmount, 0);

  // Homework for this student's class
  const myHomework = await db.homework.findMany({
    where: { classId: student.classId, schoolId },
    orderBy: { dueDate: "asc" },
    take: 10,
    include: { class: true, subject: true, staff: true },
  });
  const pendingHomework = myHomework.filter((h) => new Date(h.dueDate) >= today).length;

  // Exam results for this student
  const myExamResults = await db.examResult.findMany({
    where: { studentId },
    include: { subject: true, exam: true },
  });
  const upcomingExams = await db.exam.count({
    where: { classId: student.classId, schoolId, startDate: { gte: todayStr } },
  });

  // Today's timetable
  const myTimetableToday = await db.timetableSlot.findMany({
    where: { classId: student.classId, sectionId: student.sectionId, day: dayName },
    include: { subject: true, staff: true },
    orderBy: { period: "asc" },
  });

  // Notices for this student
  const recentNotices = await db.notice.findMany({
    where: {
      schoolId,
      OR: [
        { targetAudience: "all" },
        { targetAudience: "class", targetClassId: student.classId },
        { targetAudience: "role", targetRole: viewerRole },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    role: viewerRole, // "student" or "parent"
    viewerName,
    studentName,
    studentInfo,
    stats: {
      attendancePercent,
      feePaid,
      feeDue,
      feeTotal,
      pendingHomework,
      upcomingExams,
      totalAttendanceDays: totalDays,
      presentDays: presentCount,
      absentDays: absentCount,
    },
    myAttendanceTrend,
    myExamResults: myExamResults.map((r) => ({
      subject: r.subject?.name || "—",
      examName: r.exam?.name || "—",
      marks: r.marksObtained,
      maxMarks: r.maxMarks,
      grade: r.grade || "—",
    })),
    myHomework: myHomework.map((h) => ({
      id: h.id,
      title: h.title,
      subject: h.subject?.name || "—",
      dueDate: h.dueDate,
      description: h.description,
    })),
    myTimetableToday: myTimetableToday.map((s) => ({
      period: s.period,
      subject: s.subject?.name || "—",
      teacher: s.staff ? `${s.staff.firstName} ${s.staff.lastName}` : "—",
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    myFees: {
      total: feeTotal,
      paid: feePaid,
      due: feeDue,
      status: feeDue === 0 ? "paid" : feePaid > 0 ? "partial" : "pending",
    },
    recentNotices: recentNotices.map((n) => ({ id: n.id, title: n.title, content: n.content, date: n.date })),
  });
}
