import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/schools/[id] — super_admin only: single school with counts
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: schoolRaw, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !schoolRaw) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const school = schoolRaw as Record<string, unknown>;

  // Compute counts
  const [studentsCountRes, staffCountRes, classesCountRes] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", id),
    supabaseAdmin
      .from("staff")
      .select("*", { count: "exact", head: true })
      .eq("school_id", id),
    supabaseAdmin
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("school_id", id),
  ]);

  const schoolCamel = toCamelCase(school) as Record<string, unknown>;
  return NextResponse.json({
    ...schoolCamel,
    counts: {
      students: studentsCountRes.count || 0,
      staff: staffCountRes.count || 0,
      classes: classesCountRes.count || 0,
    },
  });
}

// PUT /api/schools/[id] — super_admin only: update school details
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("schools")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const body = await req.json();

  if (
    body.name !== undefined &&
    (typeof body.name !== "string" || !body.name.trim())
  ) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.address !== undefined) data.address = body.address?.trim() || null;
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.email !== undefined) data.email = body.email?.trim() || null;
  if (body.logo !== undefined) data.logo = body.logo?.trim() || null;
  if (body.establishedDate !== undefined)
    data.established_date = body.establishedDate || null;

  try {
    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from("schools")
      .update(data)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedRaw) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update school" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(updatedRaw as Record<string, unknown>)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/schools/[id] — super_admin only: delete a school (cascade-deletes its data)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("schools")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("schools")
      .delete()
      .eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
