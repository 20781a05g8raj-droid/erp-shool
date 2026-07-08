import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

const SECTION_SELECT =
  "id, name, class_id, class_teacher_id, created_at, class_teacher:staff!sections_class_teacher_fk(id, first_name, last_name, employee_id)";

// PUT /api/sections/[id] — update a section. Supports renaming and assigning
// the class teacher. To unset the class teacher pass `classTeacherId: null`.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Find the section and verify school scope via the class relation.
  const { data: section } = await supabaseAdmin
    .from("sections")
    .select(`id, class:classes(school_id)`)
    .eq("id", id)
    .maybeSingle();

  const classRow = section?.class as { school_id?: string } | null | undefined;
  if (!section || !classRow || classRow.school_id !== user.schoolId) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  let body: { name?: string; classTeacherId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim();
  }
  if (body.classTeacherId === null) {
    updateData.class_teacher_id = null;
  } else if (typeof body.classTeacherId === "string" && body.classTeacherId) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("id", body.classTeacherId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (staff) updateData.class_teacher_id = staff.id;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("sections")
    .update(updateData)
    .eq("id", id)
    .select(SECTION_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: "Failed to update section" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    section: toCamelCase(updated as unknown as Record<string, unknown>),
  });
}

// DELETE /api/sections/[id] — delete a section.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: section } = await supabaseAdmin
    .from("sections")
    .select(`id, class:classes(school_id)`)
    .eq("id", id)
    .maybeSingle();

  const classRow = section?.class as { school_id?: string } | null | undefined;
  if (!section || !classRow || classRow.school_id !== user.schoolId) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("sections").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
