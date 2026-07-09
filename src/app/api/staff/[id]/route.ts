import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

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

  const [
    { data: staffRaw },
    { data: leavesRaw },
    { data: payrollsRaw },
  ] = await Promise.all([
    supabaseAdmin
      .from("staff")
      .select("*")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("staff_leaves")
      .select("*")
      .eq("staff_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("payrolls")
      .select("*")
      .eq("staff_id", id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(24),
  ]);

  if (!staffRaw) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const staff: any = staffRaw;
  const leaves: any[] = (leavesRaw ?? []) as any[];
  const payrolls: any[] = (payrollsRaw ?? []) as any[];

  // Compute leave + payroll summary
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const today = now.toISOString().split("T")[0];

  const leaveSummary = {
    total: leaves.length,
    approved: leaves.filter((l) => l.status === "approved").length,
    pending: leaves.filter((l) => l.status === "pending").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
    onLeaveToday: leaves.some(
      (l) =>
        l.status === "approved" && l.from_date <= today && l.to_date >= today
    ),
  };

  const currentPayroll = payrolls.find(
    (p) => p.month === currentMonth && p.year === currentYear
  );

  const payrollSummary = {
    totalGenerated: payrolls.length,
    totalPaid: payrolls.filter((p) => p.status === "paid").length,
    totalNetSalary: payrolls.reduce((s, p) => s + Number(p.net_salary ?? 0), 0),
    currentMonthPayroll: currentPayroll
      ? {
          id: currentPayroll.id,
          status: currentPayroll.status,
          netSalary: Number(currentPayroll.net_salary ?? 0),
          paidDate: currentPayroll.paid_date,
        }
      : null,
  };

  return NextResponse.json({
    ...toCamelCase(staff),
    leaves: leaves.map((l) => toCamelCase(l)),
    payrolls: payrolls.map((p) => toCamelCase(p)),
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
  if (!canManageStaff(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage staff" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("staff")
    .select("id, employee_id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
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

  // If employeeId changed, ensure uniqueness (within school)
  const newEmployeeId = (body.employeeId || "").trim();
  if (newEmployeeId && newEmployeeId !== existing.employee_id) {
    const { data: conflict } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("employee_id", newEmployeeId)
      .neq("id", id)
      .limit(1)
      .maybeSingle();
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
    const updateData = {
      employee_id: newEmployeeId || existing.employee_id,
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      dob: body.dob || null,
      gender: body.gender || null,
      designation: body.designation?.trim() || null,
      department: body.department?.trim() || null,
      qualification: body.qualification?.trim() || null,
      joining_date: body.joiningDate || null,
      type: body.type === "non_teaching" ? "non_teaching" : "teaching",
      photo: body.photo?.trim() || null,
      salary,
      status: body.status || "active",
    };

    const { data, error } = await supabaseAdmin
      .from("staff")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to update staff" },
        { status: 500 }
      );
    }
    return NextResponse.json(toCamelCase(data));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update staff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/staff/[id] — remove staff (cascade handled by FK ON DELETE CASCADE)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageStaff(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage staff" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  try {
    const { error } = await supabaseAdmin.from("staff").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete staff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
