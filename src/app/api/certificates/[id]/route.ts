import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/certificates/[id] — single certificate with full student data for printing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const certificate = await db.certificate.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          rollNumber: true,
          dob: true,
          gender: true,
          bloodGroup: true,
          address: true,
          fatherName: true,
          motherName: true,
          parentPhone: true,
          admissionDate: true,
          classId: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      school: { select: { id: true, name: true, address: true, phone: true, email: true, logo: true } },
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  // Role-based scoping for student/parent
  if (user.role === "student" || user.role === "parent") {
    if (user.studentId !== certificate.studentId) {
      return NextResponse.json(
        { error: "Forbidden: you can only view your own certificates" },
        { status: 403 }
      );
    }
  }

  return NextResponse.json(certificate);
}

// DELETE /api/certificates/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.certificate.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  await db.certificate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
