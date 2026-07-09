import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: examRaw, error: examError } = await supabaseAdmin
    .from("exams")
    .select("id, class_id, max_marks")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (examError || !examRaw) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const { data: resultsRaw, error: resultsError } = await supabaseAdmin
    .from("exam_results")
    .select(
      "*, subject:subjects(id, name, code), student:students(id, first_name, last_name, admission_number, roll_number)"
    )
    .eq("exam_id", id);

  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  const results = (resultsRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({ results: results.map((r) => toCamelCase(r)) });
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
    const { data: examRaw, error: examError } = await supabaseAdmin
      .from("exams")
      .select("id, max_marks")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (examError || !examRaw) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const exam = examRaw as { id: string; max_marks: number };

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
      const max = r.maxMarks ?? exam.max_marks;
      const marksObtained = r.marksObtained > max ? max : r.marksObtained;
      const grade = r.grade || gradeForMarks(marksObtained, max);

      // Find existing record (examId + studentId + subjectId)
      const { data: existing } = await supabaseAdmin
        .from("exam_results")
        .select("id")
        .eq("exam_id", id)
        .eq("student_id", r.studentId)
        .eq("subject_id", r.subjectId)
        .maybeSingle();

      const row = {
        exam_id: id,
        student_id: r.studentId,
        subject_id: r.subjectId,
        marks_obtained: marksObtained,
        max_marks: max,
        grade,
        remarks: r.remarks || null,
      };

      if (existing) {
        await supabaseAdmin
          .from("exam_results")
          .update({
            marks_obtained: marksObtained,
            max_marks: max,
            grade,
            remarks: r.remarks || null,
          })
          .eq("id", (existing as { id: string }).id);
      } else {
        await supabaseAdmin.from("exam_results").insert(row);
      }
      upserted++;
    }

    return NextResponse.json({ upserted, total: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
