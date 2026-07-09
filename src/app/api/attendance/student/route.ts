import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/attendance/student?studentId=...
// Returns all attendance records for the student + computed monthly stats + percentage.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const month = searchParams.get("month"); // optional "YYYY-MM"

  if (!studentId) {
    return NextResponse.json(
      { error: "studentId is required" },
      { status: 400 }
    );
  }

  try {
    // Verify the student belongs to this school
    const { data: student } = await supabaseAdmin
      .from("students")
      .select(
        "id, first_name, last_name, admission_number, roll_number, class_id, section_id, class:classes(id, name), section:sections(id, name)"
      )
      .eq("id", studentId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    let attendanceQuery = supabaseAdmin
      .from("student_attendance")
      .select("id, date, status, marked_by")
      .eq("student_id", studentId);
    if (month) {
      // date column is TEXT "YYYY-MM-DD" — match prefix via LIKE.
      attendanceQuery = attendanceQuery.like("date", `${month}%`);
    }
    attendanceQuery = attendanceQuery.order("date", { ascending: true });

    const { data: recordsData, error: recordsErr } = await attendanceQuery;
    if (recordsErr) {
      throw recordsErr;
    }

    const records = (recordsData || []) as Array<{
      id: string;
      date: string;
      status: string;
      marked_by: string | null;
    }>;

    const total = records.length;
    const counts = {
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      late: records.filter((r) => r.status === "late").length,
      leave: records.filter((r) => r.status === "leave").length,
      halfday: records.filter((r) => r.status === "halfday").length,
    };
    // present = full, late/halfday = half, leave/absent = 0
    const weighted =
      counts.present + counts.late * 0.5 + counts.halfday * 0.5;
    const percentage =
      total > 0 ? Math.round((weighted / total) * 1000) / 10 : 0;

    // Build a date->status map for quick calendar lookups
    const byDate: Record<string, string> = {};
    for (const r of records) byDate[r.date] = r.status;

    return NextResponse.json({
      student: toCamelCase(student as unknown as Record<string, unknown>),
      records: records.map((r) =>
        toCamelCase(r as unknown as Record<string, unknown>)
      ),
      byDate,
      counts,
      total,
      percentage,
    });
  } catch (err) {
    console.error("[attendance/student GET] error", err);
    return NextResponse.json(
      { error: "Failed to fetch student attendance" },
      { status: 500 }
    );
  }
}
