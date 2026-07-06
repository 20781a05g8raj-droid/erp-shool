import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/transport/vehicles — list with route + student count
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicles = await db.vehicle.findMany({
    where: { schoolId: user.schoolId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      route: { select: { id: true, name: true, fare: true } },
      _count: { select: { studentTransport: true } },
    },
  });

  return NextResponse.json(vehicles);
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
  const conflict = await db.vehicle.findFirst({
    where: { schoolId: user.schoolId, busNumber: body.busNumber.trim() },
    select: { id: true },
  });
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
    const route = await db.transportRoute.findFirst({
      where: { id: body.routeId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (route) routeId = route.id;
  }

  try {
    const vehicle = await db.vehicle.create({
      data: {
        busNumber: body.busNumber.trim(),
        driverName: body.driverName.trim(),
        driverPhone: body.driverPhone?.trim() || "",
        capacity,
        routeId,
        schoolId: user.schoolId,
      },
      include: {
        route: { select: { id: true, name: true, fare: true } },
        _count: { select: { studentTransport: true } },
      },
    });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
