import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/transport/routes — list with vehicles + student count
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: routesRaw, error } = await supabaseAdmin
    .from("transport_routes")
    .select("*, vehicles(*)")
    .eq("school_id", user.schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 });
  }

  // Compute student count and vehicle count for each route
  const routes = await Promise.all(
    (routesRaw || []).map(async (r: Record<string, unknown>) => {
      const routeId = r.id as string;
      const { count: studentCount } = await supabaseAdmin
        .from("student_transport")
        .select("*", { count: "exact", head: true })
        .eq("route_id", routeId);
      const { count: vehicleCount } = await supabaseAdmin
        .from("vehicles")
        .select("*", { count: "exact", head: true })
        .eq("route_id", routeId);
      r._count = {
        studentTransport: studentCount || 0,
        vehicles: vehicleCount || 0,
      };
      return r;
    })
  );

  return NextResponse.json(toCamelCase(routes as Record<string, unknown>[]));
}

// POST /api/transport/routes — create route
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Route name is required" }, { status: 400 });
  }

  // Stops: accept either a CSV string or an array of strings; store as CSV string
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
    const { data: route, error } = await supabaseAdmin
      .from("transport_routes")
      .insert({
        name: body.name.trim(),
        stops: stopsCsv,
        fare,
        school_id: user.schoolId,
      })
      .select("*, vehicles(*)")
      .single();

    if (error || !route) {
      return NextResponse.json(
        { error: "Failed to create route" },
        { status: 500 }
      );
    }

    // Compute counts
    const { count: studentCount } = await supabaseAdmin
      .from("student_transport")
      .select("*", { count: "exact", head: true })
      .eq("route_id", route.id);
    (route as Record<string, unknown>)._count = {
      studentTransport: studentCount || 0,
      vehicles: ((route as Record<string, unknown>).vehicles as unknown[])?.length || 0,
    };

    return NextResponse.json(
      toCamelCase(route as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
