import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/events/[id] — update an event
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles: Role[] = ["super_admin", "school_admin", "teacher"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("school_events")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }
  if (body.date !== undefined && (typeof body.date !== "string" || !body.date)) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  if (body.type && !["holiday", "ptm", "exam", "function", "event"].includes(body.type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }
  if (body.endDate && body.date && body.endDate < body.date) {
    return NextResponse.json(
      { error: "End date cannot be before start date" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.date !== undefined) data.date = body.date;
  if (body.endDate !== undefined) data.end_date = body.endDate || null;
  if (body.type !== undefined) data.type = body.type;

  try {
    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from("school_events")
      .update(data)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedRaw) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update event" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(updatedRaw as Record<string, unknown>)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/events/[id] — delete an event
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles: Role[] = ["super_admin", "school_admin"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("school_events")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("school_events")
      .delete()
      .eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
