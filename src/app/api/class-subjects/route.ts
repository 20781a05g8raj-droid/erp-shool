import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// POST /api/class-subjects — assign a subject to a class.
// Body: { classId, subjectId }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; subjectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const subjectId = (body.subjectId ?? "").toString().trim();
  if (!classId || !subjectId) {
    return NextResponse.json(
      { error: "classId and subjectId are required" },
      { status: 400 }
    );
  }

  // Validate class + subject belong to this school.
  const [{ data: cls }, { data: subject }] = await Promise.all([
    supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("subjects")
      .select("id")
      .eq("id", subjectId)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
  ]);
  if (!cls || !subject) {
    return NextResponse.json(
      { error: "Class or subject not found" },
      { status: 404 }
    );
  }

  // Upsert on (class_id, subject_id). If the row already exists, this is a
  // no-op update and returns the existing row.
  const { data: cs, error } = await supabaseAdmin
    .from("class_subjects")
    .upsert(
      { class_id: classId, subject_id: subjectId },
      { onConflict: "class_id,subject_id" }
    )
    .select("id, class_id, subject_id")
    .single();

  if (error || !cs) {
    return NextResponse.json(
      { error: "Failed to assign subject" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { classSubject: toCamelCase(cs as unknown as Record<string, unknown>) },
    { status: 201 }
  );
}

// DELETE /api/class-subjects — unassign a subject from a class.
// Body: { classId, subjectId }
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; subjectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const subjectId = (body.subjectId ?? "").toString().trim();
  if (!classId || !subjectId) {
    return NextResponse.json(
      { error: "classId and subjectId are required" },
      { status: 400 }
    );
  }

  // Verify school scope via the class.
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("class_subjects")
    .delete()
    .eq("class_id", classId)
    .eq("subject_id", subjectId);
  if (error) {
    return NextResponse.json(
      { error: "Failed to unassign subject" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
