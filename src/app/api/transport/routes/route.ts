import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/transport/routes — list with vehicles + student count
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routes = await db.transportRoute.findMany({
    where: { schoolId: user.schoolId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      vehicles: {
        select: {
          id: true,
          busNumber: true,
          driverName: true,
          driverPhone: true,
          capacity: true,
        },
      },
      _count: { select: { studentTransport: true, vehicles: true } },
    },
  });

  return NextResponse.json(routes);
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
    const route = await db.transportRoute.create({
      data: {
        name: body.name.trim(),
        stops: stopsCsv,
        fare,
        schoolId: user.schoolId,
      },
      include: {
        vehicles: true,
        _count: { select: { studentTransport: true, vehicles: true } },
      },
    });
    return NextResponse.json(route, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
