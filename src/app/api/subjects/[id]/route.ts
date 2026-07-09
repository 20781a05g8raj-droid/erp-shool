import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/subjects/[id] — update a subject.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: existing } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  let body: { name?: string; code?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim();
  }
  if (body.code === null || (typeof body.code === "string" && body.code.trim())) {
    updateData.code = body.code === null ? null : body.code.trim();
  }

  const { data: updated, error } = await supabaseAdmin
    .from("subjects")
    .update(updateData)
    .eq("id", id)
    .select("id, name, code, school_id, created_at")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: "Failed to update subject" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    subject: toCamelCase(updated as unknown as Record<string, unknown>),
  });
}

// DELETE /api/subjects/[id] — delete a subject.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: existing } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("subjects")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Failed to delete subject" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
