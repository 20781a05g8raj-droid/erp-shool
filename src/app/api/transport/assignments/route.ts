import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/transport/assignments — list student-transport (include student + route + vehicle)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  let query = supabaseAdmin
    .from("student_transport")
    .select(
      "*, transport_routes!inner(id, school_id, name, stops, fare), students(id, first_name, last_name, admission_number, classes(id, name), sections(id, name), parent_phone, father_name), vehicles(id, bus_number, driver_name, driver_phone, capacity)"
    )
    .eq("transport_routes.school_id", user.schoolId)
    .order("created_at", { ascending: false });

  if (studentId) query = query.eq("student_id", studentId);

  const { data: assignmentsRaw, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }

  // Remap relations: transport_routes → route, vehicles → vehicle
  const assignments = (assignmentsRaw || []).map((a: Record<string, unknown>) => {
    a.route = a.transport_routes;
    a.vehicle = a.vehicles;
    delete a.transport_routes;
    delete a.vehicles;
    return a;
  });

  return NextResponse.json(
    toCamelCase(assignments as Record<string, unknown>[])
  );
}

// POST /api/transport/assignments — assign student to route+vehicle+pickupPoint
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { studentId, routeId, vehicleId, pickupPoint } = body;

  if (!studentId) {
    return NextResponse.json({ error: "Student is required" }, { status: 400 });
  }
  if (!routeId) {
    return NextResponse.json({ error: "Route is required" }, { status: 400 });
  }

  // Validate student + route belong to school
  const [studentResult, routeResult] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("transport_routes")
      .select("id, name, stops")
      .eq("id", routeId)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
  ]);

  if (studentResult.error || !studentResult.data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (routeResult.error || !routeResult.data) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  // Validate vehicle (if provided) belongs to school and is on this route
  let vehicleIdToUse: string | null = null;
  if (vehicleId) {
    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from("vehicles")
      .select("id, route_id, capacity")
      .eq("id", vehicleId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    const v = vehicle as { id: string; route_id: string | null; capacity: number };
    if (v.route_id && v.route_id !== routeId) {
      return NextResponse.json(
        { error: "Selected vehicle is not on the chosen route" },
        { status: 400 }
      );
    }
    vehicleIdToUse = v.id;

    // Capacity check (optional but recommended)
    const { count: assignedCount } = await supabaseAdmin
      .from("student_transport")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", v.id);
    if ((assignedCount || 0) >= v.capacity) {
      return NextResponse.json(
        { error: "Vehicle is at full capacity" },
        { status: 400 }
      );
    }
  }

  // Prevent duplicate assignment for the same student (one active assignment per student)
  const { data: existingAssignment } = await supabaseAdmin
    .from("student_transport")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (existingAssignment) {
    return NextResponse.json(
      {
        error:
          "Student is already assigned to a transport route. Remove the existing assignment first.",
      },
      { status: 400 }
    );
  }

  try {
    const { data: assignment, error } = await supabaseAdmin
      .from("student_transport")
      .insert({
        student_id: studentId,
        route_id: routeId,
        vehicle_id: vehicleIdToUse,
        pickup_point: pickupPoint?.trim() || null,
      })
      .select(
        "*, transport_routes(id, name, stops, fare), students(id, first_name, last_name, admission_number, classes(id, name), sections(id, name), parent_phone, father_name), vehicles(id, bus_number, driver_name, driver_phone, capacity)"
      )
      .single();

    if (error || !assignment) {
      return NextResponse.json(
        { error: "Failed to assign transport" },
        { status: 500 }
      );
    }

    (assignment as Record<string, unknown>).route = (assignment as Record<string, unknown>).transport_routes;
    (assignment as Record<string, unknown>).vehicle = (assignment as Record<string, unknown>).vehicles;
    delete (assignment as Record<string, unknown>).transport_routes;
    delete (assignment as Record<string, unknown>).vehicles;

    return NextResponse.json(
      toCamelCase(assignment as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to assign transport";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
