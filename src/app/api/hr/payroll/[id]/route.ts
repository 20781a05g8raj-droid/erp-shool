import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

const STAFF_FIELDS_GET =
  "id, employee_id, first_name, last_name, email, phone, designation, department, type, photo, joining_date";

const PAYROLL_SELECT_GET = `*, staff:staff(${STAFF_FIELDS_GET})`;

// Helper: confirm payroll belongs to a staff in this school
async function getPayrollInSchool(
  payrollId: string,
  schoolId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin
    .from("payrolls")
    .select(PAYROLL_SELECT_GET)
    .eq("id", payrollId)
    .maybeSingle();

  if (error || !data) return null;
  const payroll = data as Record<string, unknown>;
  const staff = payroll.staff as Record<string, unknown> | null;
  if (!staff) return null;
  const staffId = staff.id as string;
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("school_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!staffRow) return null;
  if ((staffRow as { school_id: string }).school_id !== schoolId) return null;
  return payroll;
}

// GET /api/hr/payroll/[id] — single payroll for payslip view
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payroll = await getPayrollInSchool(id, user.schoolId);
  if (!payroll) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  // Teacher role: allow viewing own payslip only
  if (user.role === "teacher" && user.staffId) {
    if ((payroll.staff_id as string) !== user.staffId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Include school info for payslip header
  const { data: schoolRaw } = await supabaseAdmin
    .from("schools")
    .select("name, address, phone, email, logo")
    .eq("id", user.schoolId)
    .maybeSingle();

  return NextResponse.json({
    payroll: toCamelCase(payroll),
    school: schoolRaw ? toCamelCase(schoolRaw as Record<string, unknown>) : null,
  });
}

// PUT /api/hr/payroll/[id] — mark as paid { paidDate }
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getPayrollInSchool(id, user.schoolId);
  if (!existing) {
    return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
  }

  const body = await req.json();
  const { paidDate } = body as { paidDate?: string };

  const STAFF_FIELDS_PUT =
    "id, employee_id, first_name, last_name, email, phone, designation, department, type, photo";
  const PAYROLL_SELECT_PUT = `*, staff:staff(${STAFF_FIELDS_PUT})`;

  try {
    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from("payrolls")
      .update({
        status: "paid",
        paid_date: paidDate || new Date().toISOString().split("T")[0],
      })
      .eq("id", id)
      .select(PAYROLL_SELECT_PUT)
      .single();

    if (updateError || !updatedRaw) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update payroll" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(updatedRaw as Record<string, unknown>)
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update payroll";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
