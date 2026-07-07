import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
      const student = await db.student.findFirst({
        where: { id: studentId, schoolId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          classId: true,
          sectionId: true,
        },
      });
      if (!student) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }

      const records = await db.studentAttendance.findMany({
        where: { studentId },
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
      // Attendance percentage: present counts full, late/halfday count half
      const weighted =
        counts.present +
        counts.late * 0.5 +
        counts.halfday * 0.5 +
        counts.leave * 0;
      const percentage =
        total > 0 ? Math.round((weighted / total) * 1000) / 10 : 0;

      return NextResponse.json({
        student,
        records,
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
    const cls = await db.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Fetch students in this class (+ optional section)
    const students = await db.student.findMany({
      where: {
        schoolId,
        classId,
        status: "active",
        ...(sectionId ? { sectionId } : {}),
      },
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
      },
    });

    const studentIds = students.map((s) => s.id);

    // Fetch existing attendance records for that date
    const attendance =
      studentIds.length > 0
        ? await db.studentAttendance.findMany({
            where: { studentId: { in: studentIds }, date },
            select: {
              id: true,
              studentId: true,
              status: true,
              markedBy: true,
            },
          })
        : [];

    const attendanceMap = new Map(attendance.map((a) => [a.studentId, a]));

    const rows = students.map((s) => ({
      ...s,
      attendance: attendanceMap.get(s.id) || null,
    }));

    return NextResponse.json({
      date,
      classInfo: cls,
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
    const cls = await db.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const validStatuses = ["present", "absent", "late", "leave", "halfday"];

    // Get all valid student IDs in this class+section for this school
    const validStudents = await db.student.findMany({
      where: {
        schoolId,
        classId,
        status: "active",
        ...(sectionId ? { sectionId } : {}),
      },
      select: { id: true },
    });
    const validStudentIds = new Set(validStudents.map((s) => s.id));

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

    // Fetch existing attendance for these students on this date
    const existing = await db.studentAttendance.findMany({
      where: {
        date,
        studentId: { in: cleanRecords.map((r) => r.studentId) },
      },
      select: { id: true, studentId: true },
    });
    const existingMap = new Map(existing.map((e) => [e.studentId, e.id]));

    // Upsert: update if exists, create if not
    const operations = cleanRecords.map((r) => {
      const existingId = existingMap.get(r.studentId);
      if (existingId) {
        return db.studentAttendance.update({
          where: { id: existingId },
          data: { status: r.status, markedBy: user.id },
        });
      }
      return db.studentAttendance.create({
        data: {
          studentId: r.studentId,
          date,
          status: r.status,
          markedBy: user.id,
        },
      });
    });

    await db.$transaction(operations);

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
