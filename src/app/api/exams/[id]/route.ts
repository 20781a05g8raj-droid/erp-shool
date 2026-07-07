import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/exams/[id] — single exam with results grouped by student+subject
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const exam = await db.exam.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      class: { select: { id: true, name: true } },
      results: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              rollNumber: true,
            },
          },
        },
        orderBy: { student: { firstName: "asc" } },
      },
    },
  });

  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  // Get subjects for this class (via class_subjects)
  const classSubjects = await db.classSubject.findMany({
    where: { classId: exam.classId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  // Get students of this class
  const students = await db.student.findMany({
    where: { classId: exam.classId, status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      rollNumber: true,
    },
    orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      classId: exam.classId,
      startDate: exam.startDate,
      endDate: exam.endDate,
      maxMarks: exam.maxMarks,
      class: exam.class,
      createdAt: exam.createdAt,
    },
    subjects: classSubjects.map((cs) => cs.subject),
    students,
    results: exam.results,
  });
}

// PUT /api/exams/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await db.exam.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, type, startDate, endDate, maxMarks } = body as {
      name?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      maxMarks?: number;
    };

    const data: Record<string, unknown> = {};
    if (name && typeof name === "string") data.name = name.trim();
    if (type && ["unit_test", "mid_term", "final"].includes(type)) data.type = type;
    if (startDate) data.startDate = startDate;
    if (endDate) data.endDate = endDate;
    if (typeof maxMarks === "number" && maxMarks > 0) data.maxMarks = maxMarks;

    const updated = await db.exam.update({
      where: { id },
      data,
      include: { class: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update exam";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/exams/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await db.exam.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Results cascade-delete via onDelete: Cascade
    await db.exam.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete exam";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
