import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/reports/attendance — attendance summary by class, by month, overall rate
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Get all classes
  const classes = await db.class.findMany({
    where: { schoolId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  // Get all attendance records for the school (last 6 months for trend + class breakdown)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startPrefix = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`;

  const attendanceRecords = await db.studentAttendance.findMany({
    where: {
      date: { gte: startPrefix },
      student: { schoolId },
    },
    select: {
      status: true,
      date: true,
      student: { select: { classId: true } },
    },
  });

  // Overall rate
  const totalRecords = attendanceRecords.length;
  const presentRecords = attendanceRecords.filter(
    (r) => r.status === "present" || r.status === "late"
  ).length;
  const overallRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

  // By class
  const classMap: Record<string, { name: string; total: number; present: number }> = {};
  for (const cls of classes) {
    classMap[cls.id] = { name: cls.name, total: 0, present: 0 };
  }
  for (const r of attendanceRecords) {
    const entry = r.student.classId ? classMap[r.student.classId] : null;
    if (entry) {
      entry.total += 1;
      if (r.status === "present" || r.status === "late") entry.present += 1;
    }
  }
  const byClass = Object.values(classMap).map((c) => ({
    class: c.name,
    total: c.total,
    present: c.present,
    rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
  }));

  // By month (last 6 months)
  const byMonth: { month: string; rate: number; total: number; present: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const monthRecords = attendanceRecords.filter((r) => r.date.startsWith(prefix));
    const monthTotal = monthRecords.length;
    const monthPresent = monthRecords.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    byMonth.push({
      month: monthName,
      total: monthTotal,
      present: monthPresent,
      rate: monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0,
    });
  }

  // Status breakdown
  const statusBreakdown: Record<string, number> = {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    halfday: 0,
  };
  for (const r of attendanceRecords) {
    if (r.status in statusBreakdown) {
      statusBreakdown[r.status]++;
    }
  }

  return NextResponse.json({
    overallRate,
    totalRecords,
    presentRecords,
    byClass,
    byMonth,
    statusBreakdown,
  });
}
