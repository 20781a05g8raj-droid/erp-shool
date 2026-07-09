import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/classes/[id] — update a class (name, order).
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: existing } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  let body: { name?: string; order?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim();
  }
  if (typeof body.order === "number" && !Number.isNaN(body.order)) {
    updateData.order = body.order;
  }

  const { data, error } = await supabaseAdmin
    .from("classes")
    .update(updateData)
    .eq("id", id)
    .select("id, name, \"order\"")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to update class" }, { status: 500 });
  }

  return NextResponse.json({
    class: {
      id: data.id,
      name: (data as any).name,
      order: (data as any).order,
    },
  });
}

// DELETE /api/classes/[id] — delete a class (sections + class_subjects cascade).
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: existing } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("classes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
