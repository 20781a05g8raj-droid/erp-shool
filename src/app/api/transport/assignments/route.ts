import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/transport/assignments — list student-transport (include student + route + vehicle)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  const where: Record<string, unknown> = {
    route: { schoolId: user.schoolId },
  };
  if (studentId) where.studentId = studentId;

  const assignments = await db.studentTransport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          parentPhone: true,
          fatherName: true,
        },
      },
      route: { select: { id: true, name: true, stops: true, fare: true } },
      vehicle: {
        select: {
          id: true,
          busNumber: true,
          driverName: true,
          driverPhone: true,
          capacity: true,
        },
      },
    },
  });

  return NextResponse.json(assignments);
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
  const [student, route] = await Promise.all([
    db.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: { id: true },
    }),
    db.transportRoute.findFirst({
      where: { id: routeId, schoolId: user.schoolId },
      select: { id: true, name: true, stops: true },
    }),
  ]);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  // Validate vehicle (if provided) belongs to school and is on this route
  let vehicleIdToUse: string | null = null;
  if (vehicleId) {
    const vehicle = await db.vehicle.findFirst({
      where: { id: vehicleId, schoolId: user.schoolId },
      select: { id: true, routeId: true, capacity: true },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    if (vehicle.routeId && vehicle.routeId !== routeId) {
      return NextResponse.json(
        { error: "Selected vehicle is not on the chosen route" },
        { status: 400 }
      );
    }
    vehicleIdToUse = vehicle.id;

    // Capacity check (optional but recommended)
    const assignedCount = await db.studentTransport.count({
      where: { vehicleId: vehicle.id },
    });
    if (assignedCount >= vehicle.capacity) {
      return NextResponse.json(
        { error: "Vehicle is at full capacity" },
        { status: 400 }
      );
    }
  }

  // Prevent duplicate assignment for the same student (one active assignment per student)
  const existingAssignment = await db.studentTransport.findFirst({
    where: { studentId },
    select: { id: true },
  });
  if (existingAssignment) {
    return NextResponse.json(
      { error: "Student is already assigned to a transport route. Remove the existing assignment first." },
      { status: 400 }
    );
  }

  try {
    const assignment = await db.studentTransport.create({
      data: {
        studentId,
        routeId,
        vehicleId: vehicleIdToUse,
        pickupPoint: pickupPoint?.trim() || null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            parentPhone: true,
            fatherName: true,
          },
        },
        route: { select: { id: true, name: true, stops: true, fare: true } },
        vehicle: {
          select: {
            id: true,
            busNumber: true,
            driverName: true,
            driverPhone: true,
            capacity: true,
          },
        },
      },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assign transport";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
