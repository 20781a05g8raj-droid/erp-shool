import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/exams/[id] — single exam with results grouped by student+subject
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: examRaw, error } = await supabaseAdmin
    .from("exams")
    .select(
      "*, class:classes(id, name), exam_results(*, subject:subjects(id, name, code), student:students(id, first_name, last_name, admission_number, roll_number))"
    )
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (error || !examRaw) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const exam = examRaw as Record<string, unknown>;
  const examResults = (exam.exam_results as Array<Record<string, unknown>>) || [];

  // Sort results by student first name asc (Prisma did orderBy: student.firstName asc)
  examResults.sort((a, b) => {
    const sa = (a.student as Record<string, unknown> | null)?.first_name as string || "";
    const sb = (b.student as Record<string, unknown> | null)?.first_name as string || "";
    return sa.localeCompare(sb);
  });

  // Get subjects for this class (via class_subjects)
  const { data: classSubjectsRaw } = await supabaseAdmin
    .from("class_subjects")
    .select("*, subject:subjects(id, name, code)")
    .eq("class_id", exam.class_id as string);

  const classSubjects = (classSubjectsRaw || []) as Array<Record<string, unknown>>;
  classSubjects.sort((a, b) => {
    const sa = (a.subject as Record<string, unknown> | null)?.name as string || "";
    const sb = (b.subject as Record<string, unknown> | null)?.name as string || "";
    return sa.localeCompare(sb);
  });

  // Get students of this class
  const { data: studentsRaw } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, admission_number, roll_number")
    .eq("class_id", exam.class_id as string)
    .eq("status", "active");

  const students = (studentsRaw || []) as Array<Record<string, unknown>>;
  students.sort((a, b) => {
    const ra = (a.roll_number as string) || "";
    const rb = (b.roll_number as string) || "";
    if (ra !== rb) return ra.localeCompare(rb);
    const fa = (a.first_name as string) || "";
    const fb = (b.first_name as string) || "";
    return fa.localeCompare(fb);
  });

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      classId: exam.class_id,
      startDate: exam.start_date,
      endDate: exam.end_date,
      maxMarks: exam.max_marks,
      class: toCamelCase(exam.class as Record<string, unknown>),
      createdAt: exam.created_at,
    },
    subjects: classSubjects.map((cs) =>
      toCamelCase(cs.subject as Record<string, unknown>)
    ),
    students: students.map((s) => toCamelCase(s)),
    results: examResults.map((r) => toCamelCase(r)),
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
    const { data: existing, error: existError } = await supabaseAdmin
      .from("exams")
      .select("id")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (existError || !existing) {
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
    if (startDate) data.start_date = startDate;
    if (endDate) data.end_date = endDate;
    if (typeof maxMarks === "number" && maxMarks > 0) data.max_marks = maxMarks;

    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from("exams")
      .update(data)
      .eq("id", id)
      .select("*, class:classes(id, name)")
      .single();

    if (updateError || !updatedRaw) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update exam" },
        { status: 500 }
      );
    }
    return NextResponse.json(toCamelCase(updatedRaw as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update exam";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/exams/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { data: existing, error: existError } = await supabaseAdmin
      .from("exams")
      .select("id")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (existError || !existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Results cascade-delete via FK ON DELETE CASCADE
    const { error: deleteError } = await supabaseAdmin
      .from("exams")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete exam";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
