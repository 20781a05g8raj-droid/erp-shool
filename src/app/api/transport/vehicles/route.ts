import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/transport/vehicles — list with route + student count
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: vehiclesRaw, error } = await supabaseAdmin
    .from("vehicles")
    .select("*, transport_routes(id, name, fare)")
    .eq("school_id", user.schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 });
  }

  // Compute student count for each vehicle
  const vehicles = await Promise.all(
    (vehiclesRaw || []).map(async (v: Record<string, unknown>) => {
      const { count } = await supabaseAdmin
        .from("student_transport")
        .select("*", { count: "exact", head: true })
        .eq("vehicle_id", v.id as string);
      v._count = { studentTransport: count || 0 };
      // Rename relation for camelCase mapping (transport_routes → route)
      v.route = v.transport_routes;
      delete v.transport_routes;
      return v;
    })
  );

  return NextResponse.json(toCamelCase(vehicles as Record<string, unknown>[]));
}

// POST /api/transport/vehicles — create vehicle
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.busNumber || typeof body.busNumber !== "string" || !body.busNumber.trim()) {
    return NextResponse.json({ error: "Bus number is required" }, { status: 400 });
  }
  if (!body.driverName || typeof body.driverName !== "string" || !body.driverName.trim()) {
    return NextResponse.json({ error: "Driver name is required" }, { status: 400 });
  }

  // busNumber uniqueness within school
  const { data: conflict } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("school_id", user.schoolId)
    .eq("bus_number", body.busNumber.trim())
    .maybeSingle();
  if (conflict) {
    return NextResponse.json(
      { error: "A vehicle with this bus number already exists" },
      { status: 400 }
    );
  }

  const capacity = Number(body.capacity) || 30;
  // Validate routeId belongs to same school (if provided)
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
    const { data: vehicle, error } = await supabaseAdmin
      .from("vehicles")
      .insert({
        bus_number: body.busNumber.trim(),
        driver_name: body.driverName.trim(),
        driver_phone: body.driverPhone?.trim() || "",
        capacity,
        route_id: routeId,
        school_id: user.schoolId,
      })
      .select("*, transport_routes(id, name, fare)")
      .single();

    if (error || !vehicle) {
      return NextResponse.json(
        { error: "Failed to create vehicle" },
        { status: 500 }
      );
    }

    (vehicle as Record<string, unknown>)._count = { studentTransport: 0 };
    (vehicle as Record<string, unknown>).route = (vehicle as Record<string, unknown>).transport_routes;
    delete (vehicle as Record<string, unknown>).transport_routes;

    return NextResponse.json(
      toCamelCase(vehicle as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
