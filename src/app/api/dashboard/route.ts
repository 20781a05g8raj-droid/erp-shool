import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

// Helper: run a count query and return the numeric count
async function countRows(table: string, filters: Record<string, unknown>): Promise<number> {
  let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value as string);
  }
  const { count } = await query;
  return count ?? 0;
}

// ==================== ADMIN DASHBOARD ====================
async function getAdminDashboard(schoolId: string, role: string) {
  const [students, staff, classes, books, vehicles, routes, notices, exams, homework] = await Promise.all([
    countRows("students", { school_id: schoolId, status: "active" }),
    countRows("staff", { school_id: schoolId, status: "active" }),
    countRows("classes", { school_id: schoolId }),
    countRows("library_books", { school_id: schoolId }),
    countRows("vehicles", { school_id: schoolId }),
    countRows("transport_routes", { school_id: schoolId }),
    countRows("notices", { school_id: schoolId }),
    countRows("exams", { school_id: schoolId }),
    countRows("homework", { school_id: schoolId }),
  ]);

  // Fetch all student_fees for this school (joined via student) and compute fee stats in JS
  const { data: studentFeesRaw } = await supabaseAdmin
    .from("student_fees")
    .select("id, total_amount, paid_amount, due_amount, status, students!inner(school_id)")
    .eq("students.school_id", schoolId);

  const studentFees = studentFeesRaw ?? [];
  const studentFeeIds = studentFees.map((f: any) => f.id);
  const totalFeeExpected = studentFees.reduce((sum, f: any) => sum + Number(f.total_amount ?? 0), 0);
  const totalFeeCollected = studentFees.reduce((sum, f: any) => sum + Number(f.paid_amount ?? 0), 0);
  const totalFeeDue = studentFees.reduce((sum, f: any) => sum + Number(f.due_amount ?? 0), 0);
  const feeDefaulters = studentFees.filter((f: any) => f.status !== "paid").length;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 7-day window for attendance trend (inclusive of today)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  // Fetch all attendance records for the school for last 7 days in ONE query, group in JS.
  // student_attendance has no school_id, so we join via students!inner(school_id) for filtering.
  const { data: attendanceRaw } = await supabaseAdmin
    .from("student_attendance")
    .select("date, status, students!inner(school_id)")
    .eq("students.school_id", schoolId)
    .gte("date", sevenDaysAgoStr)
    .lte("date", todayStr);

  const attendanceByDate: Record<string, any[]> = {};
  for (const rec of attendanceRaw ?? []) {
    const d = (rec as any).date;
    if (!attendanceByDate[d]) attendanceByDate[d] = [];
    attendanceByDate[d].push(rec);
  }

  const attendanceTrend: { date: string; present: number; absent: number; rate: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayRecords = attendanceByDate[dateStr] ?? [];
    const present = dayRecords.filter((r: any) => r.status === "present" || r.status === "late").length;
    const absent = dayRecords.filter((r: any) => r.status === "absent").length;
    const rate = dayRecords.length > 0 ? (present / dayRecords.length) * 100 : 0;
    attendanceTrend.push({
      date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      present, absent, rate: Math.round(rate),
    });
  }

  // Fetch all fee_payments for the school in last 6 months (filter by student_fee_id IN school's student_fees).
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

  let paymentsRaw: any[] = [];
  if (studentFeeIds.length > 0) {
    const { data: pr } = await supabaseAdmin
      .from("fee_payments")
      .select("amount, payment_date")
      .in("student_fee_id", studentFeeIds)
      .gte("payment_date", sixMonthsAgoStr);
    paymentsRaw = (pr ?? []) as any[];
  }

  const feeTrend: { month: string; collected: number; expected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthPayments = paymentsRaw.filter((p: any) => typeof p.payment_date === "string" && p.payment_date.startsWith(prefix));
    const collected = monthPayments.reduce((sum, p: any) => sum + Number(p.amount ?? 0), 0);
    feeTrend.push({ month: monthName, collected, expected: Math.round(totalFeeExpected / 6) });
  }

  // Latest exam with results + subject (aliased to match Prisma relation name "subject")
  const { data: latestExamRaw } = await supabaseAdmin
    .from("exams")
    .select("*, exam_results(*, subject:subjects(*))")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestExam: any = latestExamRaw;
  const examPerformance: { subject: string; avgMarks: number }[] = [];
  if (latestExam && Array.isArray(latestExam.exam_results)) {
    const subjectGroups: Record<string, { total: number; count: number; name: string }> = {};
    for (const r of latestExam.exam_results) {
      const key = r.subject_id;
      if (!subjectGroups[key]) subjectGroups[key] = { total: 0, count: 0, name: r.subject?.name || "Unknown" };
      subjectGroups[key].total += Number(r.marks_obtained ?? 0);
      subjectGroups[key].count += 1;
    }
    for (const key of Object.keys(subjectGroups)) {
      const g = subjectGroups[key];
      examPerformance.push({ subject: g.name, avgMarks: Math.round(g.total / g.count) });
    }
  }

  // Gender distribution (male + female + other = total active)
  const [maleStudents, femaleStudents] = await Promise.all([
    countRows("students", { school_id: schoolId, gender: "male", status: "active" }),
    countRows("students", { school_id: schoolId, gender: "female", status: "active" }),
  ]);
  // "Other" = total active − male − female (handles null / unknown genders)
  const otherStudents = Math.max(0, students - maleStudents - femaleStudents);

  // Class distribution
  const { data: allClassesRaw } = await supabaseAdmin
    .from("classes")
    .select("id, name, \"order\"")
    .eq("school_id", schoolId)
    .order("order", { ascending: true });

  // Class distribution - optimized to run in parallel
  const allClasses = allClassesRaw ?? [];
  const classDistributions = await Promise.all(
    allClasses.map(async (cls) => {
      const { count } = await supabaseAdmin
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("class_id", cls.id)
        .eq("status", "active");
      return { name: cls.name, count: count ?? 0 };
    })
  );
  const classDistribution = classDistributions.filter((c) => c.count > 0);

  // Today's attendance rate
  const todayRecords = attendanceByDate[todayStr] ?? [];
  const todayPresent = todayRecords.filter((r: any) => r.status === "present" || r.status === "late").length;
  const todayRate = todayRecords.length > 0 ? Math.round((todayPresent / todayRecords.length) * 100) : 0;

  // Recent notices + students (use aliased relation names to match Prisma output shape)
  const [{ data: recentNoticesRaw }, { data: recentStudentsRaw }] = await Promise.all([
    supabaseAdmin
      .from("notices")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("students")
      .select("*, class:classes(*), section:sections(*)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentNotices = (recentNoticesRaw ?? []).map((n) => toCamelCase(n));
  const recentStudents = (recentStudentsRaw ?? []).map((s) => toCamelCase(s));

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

  // Get teacher's timetable slots. staff_id is unique per school, so filter by staff_id only.
  const { data: myTimetableRaw } = await supabaseAdmin
    .from("timetable_slots")
    .select("*, subject:subjects(*), class:classes(*), section:sections(*)")
    .eq("staff_id", staffId);

  const myTimetable: any[] = (myTimetableRaw ?? []) as any[];

  // My classes = distinct class/section combos
  const classSectionSet = new Set<string>();
  myTimetable.forEach((s) => classSectionSet.add(`${s.class_id}-${s.section_id}`));
  const myClassesCount = classSectionSet.size;

  // My students = count of students in those classes
  const classIds = [...new Set(myTimetable.map((s) => s.class_id))];
  let myStudents = 0;
  if (classIds.length > 0) {
    const { count } = await supabaseAdmin
      .from("students")
      .select("*", { count: "exact", head: true })
      .in("class_id", classIds)
      .eq("status", "active");
    myStudents = count ?? 0;
  }

  // Homework posted by this teacher
  const homeworkPosted = await countRows("homework", { staff_id: staffId, school_id: schoolId });

  const { data: myHomeworkRaw } = await supabaseAdmin
    .from("homework")
    .select("*, class:classes(*), subject:subjects(*)")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(5);
  const myHomework: any[] = (myHomeworkRaw ?? []) as any[];

  // Today's periods
  const todayPeriods = myTimetable.filter((s) => s.day === dayName);
  const todayPeriodsCount = todayPeriods.length;

  // Attendance marking trend (last 7 days) — fetch all attendance for teacher's classes in one query.
  const attendanceMarkingTrend: { date: string; present: number; absent: number }[] = [];
  if (classIds.length > 0) {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data: attRaw } = await supabaseAdmin
      .from("student_attendance")
      .select("date, status, students!inner(class_id)")
      .in("students.class_id", classIds)
      .gte("date", sevenDaysAgoStr)
      .lte("date", todayStr);

    const byDate: Record<string, any[]> = {};
    for (const rec of attRaw ?? []) {
      const d = (rec as any).date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(rec);
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const records = byDate[dateStr] ?? [];
      const present = records.filter((r: any) => r.status === "present" || r.status === "late").length;
      const absent = records.filter((r: any) => r.status === "absent").length;
      attendanceMarkingTrend.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        present, absent,
      });
    }
  } else {
    // No classes — fill trend with zeros
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      attendanceMarkingTrend.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        present: 0, absent: 0,
      });
    }
  }

  // My classes performance — exam results for classes I teach
  const myClassesPerformance: { subject: string; avgMarks: number }[] = [];
  if (classIds.length > 0) {
    const { data: examResultsRaw } = await supabaseAdmin
      .from("exam_results")
      .select("*, subject:subjects(*), students!inner(class_id)")
      .in("students.class_id", classIds);

    const subjectGroups: Record<string, { total: number; count: number; name: string }> = {};
    for (const r of (examResultsRaw ?? []) as any[]) {
      const key = r.subject_id;
      if (!subjectGroups[key]) subjectGroups[key] = { total: 0, count: 0, name: r.subject?.name || "Unknown" };
      subjectGroups[key].total += Number(r.marks_obtained ?? 0);
      subjectGroups[key].count += 1;
    }
    for (const key of Object.keys(subjectGroups)) {
      const g = subjectGroups[key];
      myClassesPerformance.push({ subject: g.name, avgMarks: Math.round(g.total / g.count) });
    }
  }

  // My leaves
  const { data: myLeavesRaw } = await supabaseAdmin
    .from("staff_leaves")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(5);
  const myLeaves: any[] = (myLeavesRaw ?? []) as any[];

  // Recent notices for teacher (target_audience=all OR target_audience=role AND target_role=teacher)
  const { data: allNoticesRaw } = await supabaseAdmin
    .from("notices")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);
  const recentNoticesFiltered = (allNoticesRaw ?? [])
    .filter((n: any) => n.target_audience === "all" || (n.target_audience === "role" && n.target_role === "teacher"))
    .slice(0, 5);

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
      startTime: s.start_time,
      endTime: s.end_time,
    })),
    myHomework: myHomework.map((h) => ({
      id: h.id, title: h.title, class: h.class?.name || "—", subject: h.subject?.name || "—", dueDate: h.due_date,
    })),
    myLeaves: myLeaves.map((l) => ({
      id: l.id, fromDate: l.from_date, toDate: l.to_date, type: l.type, status: l.status, reason: l.reason,
    })),
    recentNotices: recentNoticesFiltered.map((n: any) => ({ id: n.id, title: n.title, content: n.content, date: n.date })),
  });
}

// ==================== STUDENT / PARENT DASHBOARD ====================
async function getStudentDashboard(schoolId: string, studentId: string, viewerRole: string, viewerName: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

  // Student info (with class + section as aliased objects matching Prisma shape)
  const { data: studentRaw } = await supabaseAdmin
    .from("students")
    .select("*, class:classes(*), section:sections(*)")
    .eq("id", studentId)
    .maybeSingle();
  const student: any = studentRaw;

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const studentName = `${student.first_name} ${student.last_name}`;
  const studentInfo = {
    name: studentName,
    admissionNumber: student.admission_number,
    className: student.class?.name || "—",
    sectionName: student.section?.name || "—",
    photo: student.photo,
  };

  // Attendance
  const { data: allAttendanceRaw } = await supabaseAdmin
    .from("student_attendance")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: true });
  const allAttendance: any[] = (allAttendanceRaw ?? []) as any[];

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

  // Fees (feeStructure + payments aliased to match Prisma relation names)
  const { data: studentFeesRaw } = await supabaseAdmin
    .from("student_fees")
    .select("*, feeStructure:fee_structures(*), payments:fee_payments(*)")
    .eq("student_id", studentId);
  const studentFees: any[] = (studentFeesRaw ?? []) as any[];

  const feeTotal = studentFees.reduce((s, f) => s + Number(f.total_amount ?? 0), 0);
  const feePaid = studentFees.reduce((s, f) => s + Number(f.paid_amount ?? 0), 0);
  const feeDue = studentFees.reduce((s, f) => s + Number(f.due_amount ?? 0), 0);

  // Homework for this student's class
  const { data: myHomeworkRaw } = await supabaseAdmin
    .from("homework")
    .select("*, class:classes(*), subject:subjects(*), staff:staff(*)")
    .eq("class_id", student.class_id)
    .eq("school_id", schoolId)
    .order("due_date", { ascending: true })
    .limit(10);
  const myHomework: any[] = (myHomeworkRaw ?? []) as any[];
  const pendingHomework = myHomework.filter((h) => new Date(h.due_date) >= today).length;

  // Exam results for this student
  const { data: myExamResultsRaw } = await supabaseAdmin
    .from("exam_results")
    .select("*, subject:subjects(*), exam:exams(*)")
    .eq("student_id", studentId);
  const myExamResults: any[] = (myExamResultsRaw ?? []) as any[];

  // Upcoming exams
  const { count: upcomingExamsCount } = await supabaseAdmin
    .from("exams")
    .select("*", { count: "exact", head: true })
    .eq("class_id", student.class_id)
    .eq("school_id", schoolId)
    .gte("start_date", todayStr);
  const upcomingExams = upcomingExamsCount ?? 0;

  // Today's timetable (handle null sectionId gracefully)
  let myTimetableToday: any[] = [];
  if (student.class_id) {
    let q = supabaseAdmin
      .from("timetable_slots")
      .select("*, subject:subjects(*), staff:staff(*)")
      .eq("class_id", student.class_id)
      .eq("day", dayName);
    if (student.section_id) {
      q = q.eq("section_id", student.section_id);
    }
    const { data: ttRaw } = await q.order("period", { ascending: true });
    myTimetableToday = (ttRaw ?? []) as any[];
  }

  // Notices for this student
  const { data: noticesRaw } = await supabaseAdmin
    .from("notices")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);
  const recentNoticesFiltered = (noticesRaw ?? [])
    .filter((n: any) => {
      if (n.target_audience === "all") return true;
      if (n.target_audience === "class" && n.target_class_id === student.class_id) return true;
      if (n.target_audience === "role" && n.target_role === viewerRole) return true;
      return false;
    })
    .slice(0, 5);

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
      marks: Number(r.marks_obtained ?? 0),
      maxMarks: r.max_marks,
      grade: r.grade || "—",
    })),
    myHomework: myHomework.map((h) => ({
      id: h.id,
      title: h.title,
      subject: h.subject?.name || "—",
      dueDate: h.due_date,
      description: h.description,
    })),
    myTimetableToday: myTimetableToday.map((s) => ({
      period: s.period,
      subject: s.subject?.name || "—",
      teacher: s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : "—",
      startTime: s.start_time,
      endTime: s.end_time,
    })),
    myFees: {
      total: feeTotal,
      paid: feePaid,
      due: feeDue,
      status: feeDue === 0 ? "paid" : feePaid > 0 ? "partial" : "pending",
    },
    recentNotices: recentNoticesFiltered.map((n: any) => ({ id: n.id, title: n.title, content: n.content, date: n.date })),
  });
}
