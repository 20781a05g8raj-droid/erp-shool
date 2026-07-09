import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/transport/routes/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("transport_routes")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Route name is required" }, { status: 400 });
  }

  let stopsCsv: string | null = null;
  if (typeof body.stops === "string" && body.stops.trim()) {
    stopsCsv = body.stops
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .join(", ");
  } else if (Array.isArray(body.stops) && body.stops.length > 0) {
    stopsCsv = body.stops
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .join(", ");
  }

  const fare = typeof body.fare === "number" ? body.fare : Number(body.fare) || 0;

  try {
    const { data: updated, error } = await supabaseAdmin
      .from("transport_routes")
      .update({
        name: body.name.trim(),
        stops: stopsCsv,
        fare,
      })
      .eq("id", id)
      .select("*, vehicles(*)")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Failed to update route" },
        { status: 500 }
      );
    }

    // Compute counts
    const { count: studentCount } = await supabaseAdmin
      .from("student_transport")
      .select("*", { count: "exact", head: true })
      .eq("route_id", id);
    (updated as Record<string, unknown>)._count = {
      studentTransport: studentCount || 0,
      vehicles: ((updated as Record<string, unknown>).vehicles as unknown[])?.length || 0,
    };

    return NextResponse.json(
      toCamelCase(updated as Record<string, unknown>)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/transport/routes/[id] — block if any vehicles or students assigned
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("transport_routes")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const { count: studentTransportCount } = await supabaseAdmin
    .from("student_transport")
    .select("*", { count: "exact", head: true })
    .eq("route_id", id);

  if ((studentTransportCount || 0) > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete route: ${studentTransportCount} student(s) are still assigned`,
      },
      { status: 400 }
    );
  }

  try {
    // Unassign any vehicles still linked to this route (so we can delete cleanly)
    await supabaseAdmin
      .from("vehicles")
      .update({ route_id: null })
      .eq("route_id", id);

    const { error } = await supabaseAdmin
      .from("transport_routes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete route" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
