import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/transport/vehicles/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("vehicles")
    .select("id, bus_number")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const body = await req.json();

  if (!body.busNumber || typeof body.busNumber !== "string" || !body.busNumber.trim()) {
    return NextResponse.json({ error: "Bus number is required" }, { status: 400 });
  }
  if (!body.driverName || typeof body.driverName !== "string" || !body.driverName.trim()) {
    return NextResponse.json({ error: "Driver name is required" }, { status: 400 });
  }

  // busNumber uniqueness within school (excluding current id)
  if (body.busNumber.trim() !== (existing as { bus_number: string }).bus_number) {
    const { data: conflict } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("bus_number", body.busNumber.trim())
      .neq("id", id)
      .maybeSingle();
    if (conflict) {
      return NextResponse.json(
        { error: "A vehicle with this bus number already exists" },
        { status: 400 }
      );
    }
  }

  const capacity = Number(body.capacity) || 30;
  let routeId: string | null = null;
  if (body.routeId) {
    const { data: route } = await supabaseAdmin
      .from("transport_routes")
      .select("id")
      .eq("id", body.routeId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (route) routeId = (route as { id: string }).id;
  }

  try {
    const { data: updated, error } = await supabaseAdmin
      .from("vehicles")
      .update({
        bus_number: body.busNumber.trim(),
        driver_name: body.driverName.trim(),
        driver_phone: body.driverPhone?.trim() || "",
        capacity,
        route_id: routeId,
      })
      .eq("id", id)
      .select("*, transport_routes(id, name, fare)")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Failed to update vehicle" },
        { status: 500 }
      );
    }

    // Compute student count
    const { count } = await supabaseAdmin
      .from("student_transport")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", id);
    (updated as Record<string, unknown>)._count = {
      studentTransport: count || 0,
    };
    (updated as Record<string, unknown>).route = (updated as Record<string, unknown>).transport_routes;
    delete (updated as Record<string, unknown>).transport_routes;

    return NextResponse.json(
      toCamelCase(updated as Record<string, unknown>)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/transport/vehicles/[id] — block if any students assigned
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const { count: studentTransportCount } = await supabaseAdmin
    .from("student_transport")
    .select("*", { count: "exact", head: true })
    .eq("vehicle_id", id);

  if ((studentTransportCount || 0) > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete vehicle: ${studentTransportCount} student(s) are still assigned`,
      },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabaseAdmin
      .from("vehicles")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete vehicle" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
