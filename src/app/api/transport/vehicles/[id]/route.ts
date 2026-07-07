import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/transport/vehicles/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.vehicle.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, busNumber: true },
  });
  if (!existing) {
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
  if (body.busNumber.trim() !== existing.busNumber) {
    const conflict = await db.vehicle.findFirst({
      where: {
        schoolId: user.schoolId,
        busNumber: body.busNumber.trim(),
        NOT: { id },
      },
      select: { id: true },
    });
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
    const route = await db.transportRoute.findFirst({
      where: { id: body.routeId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (route) routeId = route.id;
  }

  try {
    const updated = await db.vehicle.update({
      where: { id },
      data: {
        busNumber: body.busNumber.trim(),
        driverName: body.driverName.trim(),
        driverPhone: body.driverPhone?.trim() || "",
        capacity,
        routeId,
      },
      include: {
        route: { select: { id: true, name: true, fare: true } },
        _count: { select: { studentTransport: true } },
      },
    });
    return NextResponse.json(updated);
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
  const existing = await db.vehicle.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true,
      _count: { select: { studentTransport: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  if (existing._count.studentTransport > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete vehicle: ${existing._count.studentTransport} student(s) are still assigned`,
      },
      { status: 400 }
    );
  }

  try {
    await db.vehicle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
