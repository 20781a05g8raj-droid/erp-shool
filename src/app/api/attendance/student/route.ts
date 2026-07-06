import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
        classId: true,
        sectionId: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const where = {
      studentId,
      ...(month ? { date: { startsWith: month } } : {}),
    };

    const records = await db.studentAttendance.findMany({
      where,
      orderBy: { date: "asc" },
      select: { id: true, date: true, status: true, markedBy: true },
    });

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
      student,
      records,
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
