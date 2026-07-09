import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/reports/attendance — attendance summary by class, by month, overall rate
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Get all classes
  const { data: classesRaw } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("order", { ascending: true });

  const classes = (classesRaw || []) as Array<{ id: string; name: string }>;

  // Get all student IDs in the school
  const { data: schoolStudentsRaw } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId);

  const schoolStudents = (schoolStudentsRaw || []) as Array<{
    id: string;
    class_id: string | null;
  }>;
  const studentClassMap = new Map<string, string | null>();
  for (const s of schoolStudents) {
    studentClassMap.set(s.id, s.class_id);
  }

  // Get all attendance records for the school (last 6 months for trend + class breakdown)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startPrefix = `${sixMonthsAgo.getFullYear()}-${String(
    sixMonthsAgo.getMonth() + 1
  ).padStart(2, "0")}`;

  const studentIds = schoolStudents.map((s) => s.id);
  let attendanceRecords: Array<{
    status: string;
    date: string;
    student_id: string;
  }> = [];

  if (studentIds.length > 0) {
    const { data: attRaw } = await supabaseAdmin
      .from("student_attendance")
      .select("status, date, student_id")
      .in("student_id", studentIds)
      .gte("date", startPrefix);
    attendanceRecords = (attRaw || []) as Array<{
      status: string;
      date: string;
      student_id: string;
    }>;
  }

  // Overall rate
  const totalRecords = attendanceRecords.length;
  const presentRecords = attendanceRecords.filter(
    (r) => r.status === "present" || r.status === "late"
  ).length;
  const overallRate =
    totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

  // By class
  const classMap: Record<
    string,
    { name: string; total: number; present: number }
  > = {};
  for (const cls of classes) {
    classMap[cls.id] = { name: cls.name, total: 0, present: 0 };
  }
  for (const r of attendanceRecords) {
    const cid = studentClassMap.get(r.student_id);
    if (cid && classMap[cid]) {
      classMap[cid].total += 1;
      if (r.status === "present" || r.status === "late")
        classMap[cid].present += 1;
    }
  }
  const byClass = Object.values(classMap).map((c) => ({
    class: c.name,
    total: c.total,
    present: c.present,
    rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
  }));

  // By month (last 6 months)
  const byMonth: {
    month: string;
    rate: number;
    total: number;
    present: number;
  }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const monthRecords = attendanceRecords.filter((r) =>
      r.date.startsWith(prefix)
    );
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
