import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/hr/payroll/[id] — single payroll for payslip view
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Teacher role: allow viewing own payslip only
  if (user.role === "teacher" && user.staffId) {
    const target = await db.payroll.findFirst({
      where: { id, staff: { schoolId: user.schoolId } },
      select: { staffId: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }
    if (target.staffId !== user.staffId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const payroll = await db.payroll.findFirst({
    where: { id, staff: { schoolId: user.schoolId } },
    include: {
      staff: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          designation: true,
          department: true,
          type: true,
          photo: true,
          joiningDate: true,
        },
      },
    },
  });

  if (!payroll) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  // Include school info for payslip header
  const school = await db.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, address: true, phone: true, email: true, logo: true },
  });

  return NextResponse.json({ payroll, school });
}

// PUT /api/hr/payroll/[id] — mark as paid { paidDate }
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.payroll.findFirst({
    where: { id, staff: { schoolId: user.schoolId } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  const body = await req.json();
  const { paidDate } = body as { paidDate?: string };

  try {
    const updated = await db.payroll.update({
      where: { id },
      data: {
        status: "paid",
        paidDate: paidDate || new Date().toISOString().split("T")[0],
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            designation: true,
            department: true,
            type: true,
            photo: true,
          },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update payroll";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
