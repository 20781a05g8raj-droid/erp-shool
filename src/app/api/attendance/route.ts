import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/attendance — list attendance records
// Supports query params:
//   ?classId=&sectionId=&date=YYYY-MM-DD  -> list students of class+section with their attendance for that date
//   ?studentId= -> all attendance records for a single student
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const sectionId = searchParams.get("sectionId");
  const date = searchParams.get("date");
  const studentId = searchParams.get("studentId");

  const schoolId = user.schoolId;

  try {
    // Single-student mode: return all attendance records + computed stats
    if (studentId) {
      // Verify the student belongs to this school
      const { data: student } = await supabaseAdmin
        .from("students")
        .select(
          "id, first_name, last_name, admission_number, class_id, section_id"
        )
        .eq("id", studentId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!student) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }

      const { data: records } = await supabaseAdmin
        .from("student_attendance")
        .select("id, date, status, marked_by")
        .eq("student_id", studentId)
        .order("date", { ascending: true });

      const recs = (records || []) as Array<{
        id: string;
        date: string;
        status: string;
        marked_by: string | null;
      }>;
      const camelRecords = recs.map((r) =>
        toCamelCase(r as unknown as Record<string, unknown>)
      );

      const total = recs.length;
      const counts = {
        present: recs.filter((r) => r.status === "present").length,
        absent: recs.filter((r) => r.status === "absent").length,
        late: recs.filter((r) => r.status === "late").length,
        leave: recs.filter((r) => r.status === "leave").length,
        halfday: recs.filter((r) => r.status === "halfday").length,
      };
      const weighted =
        counts.present +
        counts.late * 0.5 +
        counts.halfday * 0.5 +
        counts.leave * 0;
      const percentage =
        total > 0 ? Math.round((weighted / total) * 1000) / 10 : 0;

      return NextResponse.json({
        student: toCamelCase(student as unknown as Record<string, unknown>),
        records: camelRecords,
        counts,
        total,
        percentage,
      });
    }

    // Class+section+date mode (default)
    if (!classId || !date) {
      return NextResponse.json(
        { error: "classId and date are required" },
        { status: 400 }
      );
    }

    // Verify the class belongs to this school
    const { data: cls } = await supabaseAdmin
      .from("classes")
      .select("id, name")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Fetch students in this class (+ optional section)
    let studentQuery = supabaseAdmin
      .from("students")
      .select(
        "id, first_name, last_name, admission_number, roll_number"
      )
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("status", "active");
    if (sectionId) {
      studentQuery = studentQuery.eq("section_id", sectionId);
    }
    studentQuery = studentQuery.order("roll_number", {
      ascending: true,
      nullsFirst: false,
    });
    studentQuery = studentQuery.order("first_name", { ascending: true });

    const { data: studentsData, error: studentsErr } = await studentQuery;
    if (studentsErr) {
      throw studentsErr;
    }

    const students = (studentsData || []) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      admission_number: string;
      roll_number: string | null;
    }>;
    const studentIds = students.map((s) => s.id);

    // Fetch existing attendance records for that date
    let attendance: Array<{
      id: string;
      student_id: string;
      status: string;
      marked_by: string | null;
    }> = [];
    if (studentIds.length > 0) {
      const { data: attendanceData } = await supabaseAdmin
        .from("student_attendance")
        .select("id, student_id, status, marked_by")
        .eq("date", date)
        .in("student_id", studentIds);
      attendance = (attendanceData || []) as typeof attendance;
    }

    const attendanceMap = new Map(attendance.map((a) => [a.student_id, a]));

    const rows = students.map((s) => {
      const att = attendanceMap.get(s.id) || null;
      return {
        ...toCamelCase(s as unknown as Record<string, unknown>),
        attendance: att
          ? toCamelCase(att as unknown as Record<string, unknown>)
          : null,
      };
    });

    return NextResponse.json({
      date,
      classInfo: toCamelCase(cls as unknown as Record<string, unknown>),
      students: rows,
      marked: attendance.length,
    });
  } catch (err) {
    console.error("[attendance GET] error", err);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

// POST /api/attendance — bulk-mark attendance for a class on a date
// Body: { classId, sectionId?, date, records: [{ studentId, status }] }
// Strategy: delete existing records for the submitted students on the date,
// then insert the new ones. (Equivalent to upsert per (student_id, date).)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  try {
    const body = await req.json();
    const { classId, sectionId, date, records } = body || {};

    if (!classId || !date || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "classId, date and records[] are required" },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Verify class belongs to school
    const { data: cls } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const validStatuses = ["present", "absent", "late", "leave", "halfday"];

    // Get all valid student IDs in this class+section for this school
    let validStudentQuery = supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("status", "active");
    if (sectionId) {
      validStudentQuery = validStudentQuery.eq("section_id", sectionId);
    }
    const { data: validStudentsData } = await validStudentQuery;
    const validStudentIds = new Set(
      ((validStudentsData || []) as Array<{ id: string }>).map((s) => s.id)
    );

    // Filter and normalize records
    const cleanRecords = records
      .filter(
        (r: { studentId?: string; status?: string }) =>
          r &&
          typeof r.studentId === "string" &&
          typeof r.status === "string" &&
          validStudentIds.has(r.studentId) &&
          validStatuses.includes(r.status)
      )
      .map(
        (r: { studentId: string; status: string }) =>
          ({
            studentId: r.studentId,
            status: r.status,
          }) as { studentId: string; status: string }
      );

    if (cleanRecords.length === 0) {
      return NextResponse.json(
        { error: "No valid records to save" },
        { status: 400 }
      );
    }

    const cleanStudentIds = cleanRecords.map((r) => r.studentId);

    // Delete existing attendance for these students on this date
    const { error: deleteErr } = await supabaseAdmin
      .from("student_attendance")
      .delete()
      .eq("date", date)
      .in("student_id", cleanStudentIds);
    if (deleteErr) {
      throw deleteErr;
    }

    // Insert new records
    const insertRows = cleanRecords.map((r) => ({
      student_id: r.studentId,
      date,
      status: r.status,
      marked_by: user.id,
    }));
    const { error: insertErr } = await supabaseAdmin
      .from("student_attendance")
      .insert(insertRows);
    if (insertErr) {
      throw insertErr;
    }

    return NextResponse.json({
      success: true,
      date,
      saved: cleanRecords.length,
    });
  } catch (err) {
    console.error("[attendance POST] error", err);
    return NextResponse.json(
      { error: "Failed to save attendance" },
      { status: 500 }
    );
  }
}
