import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("id", user.studentId)
        .maybeSingle();
      scopeClassId = student?.class_id || undefined;
    } else {
      return NextResponse.json({ exams: [] });
    }
  }

  let query = supabaseAdmin
    .from("exams")
    .select("*, class:classes(id, name)")
    .eq("school_id", user.schoolId)
    .order("created_at", { ascending: false });

  if (scopeClassId) {
    query = query.eq("class_id", scopeClassId);
  }

  const { data: examsRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
  const exams = (examsRaw || []) as Array<Record<string, unknown>>;

  const examIds = exams.map((e) => e.id as string);
  let studentCountByExam = new Map<string, number>();
  let resultCountByExam = new Map<string, number>();

  if (examIds.length > 0) {
    const { data: resultsRaw } = await supabaseAdmin
      .from("exam_results")
      .select("exam_id, student_id")
      .in("exam_id", examIds);
    const results = (resultsRaw || []) as Array<{
      exam_id: string;
      student_id: string;
    }>;

    const seen = new Set<string>();
    for (const r of results) {
      resultCountByExam.set(
        r.exam_id,
        (resultCountByExam.get(r.exam_id) || 0) + 1
      );
      const key = `${r.exam_id}|${r.student_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        studentCountByExam.set(
          r.exam_id,
          (studentCountByExam.get(r.exam_id) || 0) + 1
        );
      }
    }
  }

  return NextResponse.json({
    exams: exams.map((e) => {
      const camel = toCamelCase(e) as Record<string, unknown>;
      return {
        id: camel.id,
        name: camel.name,
        type: camel.type,
        schoolId: camel.schoolId,
        classId: camel.classId,
        startDate: camel.startDate,
        endDate: camel.endDate,
        maxMarks: camel.maxMarks,
        createdAt: camel.createdAt,
        class: camel.class,
        resultCount: resultCountByExam.get(camel.id as string) || 0,
        studentCount: studentCountByExam.get(camel.id as string) || 0,
      };
    }),
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
    const { data: cls, error: clsError } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (clsError || !cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const insertRow = {
      name: name.trim(),
      type,
      class_id: classId,
      start_date: startDate,
      end_date: endDate,
      max_marks: typeof maxMarks === "number" && maxMarks > 0 ? maxMarks : 100,
      school_id: user.schoolId,
    };

    const { data: examRaw, error: insertError } = await supabaseAdmin
      .from("exams")
      .insert(insertRow)
      .select("*, class:classes(id, name)")
      .single();

    if (insertError || !examRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create exam" },
        { status: 500 }
      );
    }

    return NextResponse.json(toCamelCase(examRaw as Record<string, unknown>), {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create exam";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
