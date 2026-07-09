import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

const HOMEWORK_SELECT =
  "*, class:classes(id, name), section:sections(id, name), subject:subjects(id, name, code), staff:staff(id, first_name, last_name, employee_id)";

// PUT /api/homework/[id] — update homework. Only the original poster (teacher)
// or admins may edit.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["teacher", "school_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: existingRaw, error: existError } = await supabaseAdmin
    .from("homework")
    .select("*")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existingRaw) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }

  const existing = existingRaw as { staff_id: string | null };

  // Only the original teacher or admins may edit.
  if (
    user.role === "teacher" &&
    existing.staff_id &&
    existing.staff_id !== user.staffId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string | null;
    sectionId?: string | null;
    subjectId?: string | null;
    staffId?: string | null;
    dueDate?: string;
    attachment?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description ?? null;
  if (body.sectionId !== undefined) data.section_id = body.sectionId || null;
  if (body.subjectId !== undefined) data.subject_id = body.subjectId || null;
  if (body.staffId !== undefined) data.staff_id = body.staffId || null;
  if (typeof body.dueDate === "string" && body.dueDate) data.due_date = body.dueDate;
  if (body.attachment !== undefined) data.attachment = body.attachment || null;

  const { data: updatedRaw, error: updateError } = await supabaseAdmin
    .from("homework")
    .update(data)
    .eq("id", id)
    .select(HOMEWORK_SELECT)
    .single();

  if (updateError || !updatedRaw) {
    return NextResponse.json(
      { error: updateError?.message || "Failed to update homework" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    homework: toCamelCase(updatedRaw as Record<string, unknown>),
  });
}

// DELETE /api/homework/[id] — delete homework. Only the original poster or
// admins may delete.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["teacher", "school_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: existingRaw, error: existError } = await supabaseAdmin
    .from("homework")
    .select("staff_id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existingRaw) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }

  const existing = existingRaw as { staff_id: string | null };

  if (
    user.role === "teacher" &&
    existing.staff_id &&
    existing.staff_id !== user.staffId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("homework")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
