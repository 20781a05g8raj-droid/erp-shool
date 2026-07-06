import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Counts
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

  // Fee stats
  const studentFees = await db.studentFee.findMany({
    where: { student: { schoolId } },
    select: { totalAmount: true, paidAmount: true, dueAmount: true, status: true },
  });
  const totalFeeExpected = studentFees.reduce((sum, f) => sum + f.totalAmount, 0);
  const totalFeeCollected = studentFees.reduce((sum, f) => sum + f.paidAmount, 0);
  const totalFeeDue = studentFees.reduce((sum, f) => sum + f.dueAmount, 0);
  const feeDefaulters = studentFees.filter((f) => f.status !== "paid").length;

  // Attendance: last 7 days
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
      present,
      absent,
      rate: Math.round(rate),
    });
  }

  // Fee collection trend: last 6 months
  const feeTrend: { month: string; collected: number; expected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const payments = await db.feePayment.findMany({
      where: {
        studentFee: { student: { schoolId } },
        paymentDate: {
          startsWith: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        },
      },
      select: { amount: true },
    });
    const collected = payments.reduce((sum, p) => sum + p.amount, 0);
    feeTrend.push({
      month: monthName,
      collected,
      expected: Math.round(totalFeeExpected / 6),
    });
  }

  // Exam performance: average marks per subject for latest exam
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
      if (!subjectGroups[key]) {
        subjectGroups[key] = { total: 0, count: 0, name: r.subject?.name || "Unknown" };
      }
      subjectGroups[key].total += r.marksObtained;
      subjectGroups[key].count += 1;
    }
    for (const key of Object.keys(subjectGroups)) {
      const g = subjectGroups[key];
      examPerformance.push({
        subject: g.name,
        avgMarks: Math.round(g.total / g.count),
      });
    }
  }

  // Gender distribution
  const maleStudents = await db.student.count({ where: { schoolId, gender: "male", status: "active" } });
  const femaleStudents = await db.student.count({ where: { schoolId, gender: "female", status: "active" } });
  const otherStudents = await db.student.count({ where: { schoolId, status: "active", NOT: { OR: [{ gender: "male" }, { gender: "female" }] } } });

  // Class distribution
  const allClasses = await db.class.findMany({
    where: { schoolId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  const classDistribution: { name: string; count: number }[] = [];
  for (const cls of allClasses) {
    const count = await db.student.count({ where: { classId: cls.id, status: "active" } });
    if (count > 0) {
      classDistribution.push({ name: cls.name, count });
    }
  }

  // Today's attendance rate
  const todayStr = today.toISOString().split("T")[0];
  const todayAttendance = await db.studentAttendance.findMany({
    where: { date: todayStr, student: { schoolId } },
    select: { status: true },
  });
  const todayPresent = todayAttendance.filter((a) => a.status === "present" || a.status === "late").length;
  const todayRate = todayAttendance.length > 0 ? Math.round((todayPresent / todayAttendance.length) * 100) : 0;

  // Recent notices
  const recentNotices = await db.notice.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Recent admissions
  const recentStudents = await db.student.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { class: true, section: true },
  });

  return NextResponse.json({
    stats: {
      students,
      staff,
      classes,
      books,
      vehicles,
      routes,
      notices,
      exams,
      homework,
      feeDefaulters,
      totalFeeExpected,
      totalFeeCollected,
      totalFeeDue,
      todayAttendanceRate: todayRate,
    },
    attendanceTrend,
    feeTrend,
    examPerformance,
    genderDistribution: [
      { name: "Male", value: maleStudents },
      { name: "Female", value: femaleStudents },
      ...(otherStudents > 0 ? [{ name: "Other", value: otherStudents }] : []),
    ],
    classDistribution,
    recentNotices,
    recentStudents,
    latestExamName: latestExam?.name || null,
  });
}
