import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/exams — list exams with class + result count
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  // Role-based scoping: student/parent only see exams for their class
  let scopeClassId = classId || undefined;
  if (user.role === "student" || user.role === "parent") {
    if (user.studentId) {
      const student = await db.student.findUnique({
        where: { id: user.studentId },
        select: { classId: true },
      });
      scopeClassId = student?.classId || undefined;
    } else {
      return NextResponse.json({ exams: [] });
    }
  }

  const where: { schoolId: string; classId?: string } = { schoolId: user.schoolId };
  if (scopeClassId) where.classId = scopeClassId;

  const exams = await db.exam.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      class: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  });

  // Compute unique student count per exam
  const examIds = exams.map((e) => e.id);
  const results = examIds.length
    ? await db.examResult.findMany({
        where: { examId: { in: examIds } },
        select: { examId: true, studentId: true },
        distinct: ["examId", "studentId"],
      })
    : [];

  const studentCountByExam = new Map<string, number>();
  for (const r of results) {
    studentCountByExam.set(r.examId, (studentCountByExam.get(r.examId) || 0) + 1);
  }

  return NextResponse.json({
    exams: exams.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      schoolId: e.schoolId,
      classId: e.classId,
      startDate: e.startDate,
      endDate: e.endDate,
      maxMarks: e.maxMarks,
      createdAt: e.createdAt,
      class: e.class,
      resultCount: e._count.results,
      studentCount: studentCountByExam.get(e.id) || 0,
    })),
  });
}

// POST /api/exams — create exam
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, type, classId, startDate, endDate, maxMarks } = body as {
      name?: string;
      type?: string;
      classId?: string;
      startDate?: string;
      endDate?: string;
      maxMarks?: number;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Exam name is required" }, { status: 400 });
    }
    if (!classId) {
      return NextResponse.json({ error: "Class is required" }, { status: 400 });
    }
    if (!type || !["unit_test", "mid_term", "final"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be unit_test, mid_term, or final" },
        { status: 400 }
      );
    }
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Validate class belongs to school
    const cls = await db.class.findFirst({
      where: { id: classId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const exam = await db.exam.create({
      data: {
        name: name.trim(),
        type,
        classId,
        startDate,
        endDate,
        maxMarks: typeof maxMarks === "number" && maxMarks > 0 ? maxMarks : 100,
        schoolId: user.schoolId,
      },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create exam";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
