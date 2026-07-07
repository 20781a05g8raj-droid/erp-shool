import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/transport/routes/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.transportRoute.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
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
    const updated = await db.transportRoute.update({
      where: { id },
      data: {
        name: body.name.trim(),
        stops: stopsCsv,
        fare,
      },
      include: {
        vehicles: true,
        _count: { select: { studentTransport: true, vehicles: true } },
      },
    });
    return NextResponse.json(updated);
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
  const existing = await db.transportRoute.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true,
      _count: { select: { vehicles: true, studentTransport: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  if (existing._count.studentTransport > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete route: ${existing._count.studentTransport} student(s) are still assigned`,
      },
      { status: 400 }
    );
  }

  try {
    // Unassign any vehicles still linked to this route (so we can delete cleanly)
    await db.vehicle.updateMany({
      where: { routeId: id },
      data: { routeId: null },
    });
    await db.transportRoute.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
