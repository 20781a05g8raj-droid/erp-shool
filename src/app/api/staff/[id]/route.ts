import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/staff/[id] — single staff with leaves + payroll
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // For teacher role, allow viewing own profile only
  if (user.role === "teacher" && user.staffId && user.staffId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await db.staff.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      leaves: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      payrolls: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 24,
      },
    },
  });

  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  // Compute leave + payroll summary
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const today = now.toISOString().split("T")[0];

  const leaveSummary = {
    total: staff.leaves.length,
    approved: staff.leaves.filter((l) => l.status === "approved").length,
    pending: staff.leaves.filter((l) => l.status === "pending").length,
    rejected: staff.leaves.filter((l) => l.status === "rejected").length,
    onLeaveToday: staff.leaves.some(
      (l) =>
        l.status === "approved" && l.fromDate <= today && l.toDate >= today
    ),
  };

  const currentPayroll = staff.payrolls.find(
    (p) => p.month === currentMonth && p.year === currentYear
  );

  const payrollSummary = {
    totalGenerated: staff.payrolls.length,
    totalPaid: staff.payrolls.filter((p) => p.status === "paid").length,
    totalNetSalary: staff.payrolls.reduce((s, p) => s + p.netSalary, 0),
    currentMonthPayroll: currentPayroll
      ? {
          id: currentPayroll.id,
          status: currentPayroll.status,
          netSalary: currentPayroll.netSalary,
          paidDate: currentPayroll.paidDate,
        }
      : null,
  };

  return NextResponse.json({
    ...staff,
    leaveSummary,
    payrollSummary,
  });
}

// PUT /api/staff/[id] — update staff
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.staff.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, employeeId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const body = await req.json();

  if (
    !body.firstName ||
    typeof body.firstName !== "string" ||
    !body.firstName.trim()
  ) {
    return NextResponse.json(
      { error: "First name is required" },
      { status: 400 }
    );
  }
  if (
    !body.lastName ||
    typeof body.lastName !== "string" ||
    !body.lastName.trim()
  ) {
    return NextResponse.json(
      { error: "Last name is required" },
      { status: 400 }
    );
  }

  // If employeeId changed, ensure global uniqueness
  const newEmployeeId = (body.employeeId || "").trim();
  if (newEmployeeId && newEmployeeId !== existing.employeeId) {
    const conflict = await db.staff.findUnique({
      where: { employeeId: newEmployeeId },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Employee ID already exists" },
        { status: 400 }
      );
    }
  }

  const salary =
    typeof body.salary === "number" && !isNaN(body.salary)
      ? body.salary
      : parseFloat(body.salary) || 0;

  try {
    const updated = await db.staff.update({
      where: { id },
      data: {
        employeeId: newEmployeeId || existing.employeeId,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        dob: body.dob || null,
        gender: body.gender || null,
        designation: body.designation?.trim() || null,
        department: body.department?.trim() || null,
        qualification: body.qualification?.trim() || null,
        joiningDate: body.joiningDate || null,
        type: body.type === "non_teaching" ? "non_teaching" : "teaching",
        photo: body.photo?.trim() || null,
        salary,
        status: body.status || "active",
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update staff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/staff/[id] — remove staff (cascade handled by Prisma onDelete)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.staff.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  try {
    await db.staff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete staff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
