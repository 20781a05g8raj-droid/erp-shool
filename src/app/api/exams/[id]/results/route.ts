import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Standard grading scale
export function gradeForPercentage(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

export function gradeForMarks(marks: number, max: number): string {
  if (max <= 0) return "F";
  return gradeForPercentage((marks / max) * 100);
}

// GET /api/exams/[id]/results — all results for exam
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
    select: { id: true, classId: true, maxMarks: true },
  });
  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const results = await db.examResult.findMany({
    where: { examId: id },
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
  });

  return NextResponse.json({ results });
}

// POST /api/exams/[id]/results — bulk save/upsert results
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const exam = await db.exam.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { id: true, maxMarks: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const body = await req.json();
    const { results } = body as {
      results?: {
        studentId: string;
        subjectId: string;
        marksObtained: number;
        maxMarks?: number;
        grade?: string;
        remarks?: string;
      }[];
    };

    if (!Array.isArray(results)) {
      return NextResponse.json(
        { error: "results array is required" },
        { status: 400 }
      );
    }

    // Validate each result
    for (const r of results) {
      if (!r.studentId || !r.subjectId) {
        return NextResponse.json(
          { error: "Each result requires studentId and subjectId" },
          { status: 400 }
        );
      }
      if (typeof r.marksObtained !== "number" || r.marksObtained < 0) {
        return NextResponse.json(
          { error: "marksObtained must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    let upserted = 0;
    for (const r of results) {
      const max = r.maxMarks ?? exam.maxMarks;
      if (r.marksObtained > max) {
        // clamp
        r.marksObtained = max;
      }
      const grade = r.grade || gradeForMarks(r.marksObtained, max);

      // Find existing record (examId + studentId + subjectId)
      const existing = await db.examResult.findFirst({
        where: {
          examId: id,
          studentId: r.studentId,
          subjectId: r.subjectId,
        },
        select: { id: true },
      });

      if (existing) {
        await db.examResult.update({
          where: { id: existing.id },
          data: {
            marksObtained: r.marksObtained,
            maxMarks: max,
            grade,
            remarks: r.remarks || null,
          },
        });
      } else {
        await db.examResult.create({
          data: {
            examId: id,
            studentId: r.studentId,
            subjectId: r.subjectId,
            marksObtained: r.marksObtained,
            maxMarks: max,
            grade,
            remarks: r.remarks || null,
          },
        });
      }
      upserted++;
    }

    return NextResponse.json({ upserted, total: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
