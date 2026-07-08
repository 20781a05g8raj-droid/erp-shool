import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

const STAFF_FIELDS =
  "id, employee_id, first_name, last_name, email, phone, designation, department, type, photo, salary";

const PAYROLL_SELECT = `*, staff:staff(${STAFF_FIELDS})`;

// GET /api/hr/payroll — list payrolls with filters (month, year, status)
// Role scoping: teacher sees only their own payrolls
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");

  // Teacher role: lock to their own staffId
  const scopedStaffId =
    user.role === "teacher" && user.staffId ? user.staffId : staffId;

  // Get school's staff IDs
  const { data: schoolStaff, error: ssError } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("school_id", user.schoolId);

  if (ssError) {
    return NextResponse.json({ error: "Failed to fetch payrolls" }, { status: 500 });
  }

  const schoolStaffIds = (schoolStaff || []).map((s) => (s as { id: string }).id);
  if (schoolStaffIds.length === 0) {
    return NextResponse.json({ payrolls: [] });
  }

  let query = supabaseAdmin
    .from("payrolls")
    .select(PAYROLL_SELECT)
    .in("staff_id", schoolStaffIds);

  if (scopedStaffId) {
    query = query.eq("staff_id", scopedStaffId);
  }
  if (month && !isNaN(parseInt(month, 10))) {
    query = query.eq("month", parseInt(month, 10));
  }
  if (year && !isNaN(parseInt(year, 10))) {
    query = query.eq("year", parseInt(year, 10));
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  query = query
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: payrollsRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch payrolls" }, { status: 500 });
  }

  const payrolls = (payrollsRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({ payrolls: payrolls.map((p) => toCamelCase(p)) });
}

// POST /api/hr/payroll — generate payroll for a staff or all
// Body: { staffId?, month, year }
// Computation: basic = staff.salary, allowances = basic*0.20, deductions = basic*0.12, net = basic + allowances - deductions
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { staffId, month, year } = body as {
      staffId?: string;
      month?: number;
      year?: number;
    };

    if (
      typeof month !== "number" ||
      month < 1 ||
      month > 12 ||
      typeof year !== "number"
    ) {
      return NextResponse.json(
        { error: "Valid month (1-12) and year are required" },
        { status: 400 }
      );
    }

    // Gather target staff list
    let staffQuery = supabaseAdmin
      .from("staff")
      .select("id, salary, employee_id")
      .eq("school_id", user.schoolId);

    if (staffId) {
      staffQuery = staffQuery.eq("id", staffId);
    }

    const { data: staffListRaw, error: staffError } = await staffQuery;
    if (staffError) {
      return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
    }

    const staffList = (staffListRaw || []) as Array<{
      id: string;
      salary: number;
      employee_id: string;
    }>;

    if (staffList.length === 0) {
      return NextResponse.json(
        { error: "No staff found" },
        { status: 404 }
      );
    }

    // Determine which staff already have a payroll for this month/year
    const { data: existingRaw } = await supabaseAdmin
      .from("payrolls")
      .select("staff_id")
      .in(
        "staff_id",
        staffList.map((s) => s.id)
      )
      .eq("month", month)
      .eq("year", year);

    const existing = (existingRaw || []) as Array<{ staff_id: string }>;
    const existingSet = new Set(existing.map((e) => e.staff_id));
    const newStaff = staffList.filter((s) => !existingSet.has(s.id));

    if (newStaff.length === 0) {
      return NextResponse.json({
        generated: 0,
        skipped: staffList.length,
        message: "Payroll already generated for the selected staff/month.",
      });
    }

    const toCreate = newStaff.map((s) => {
      const basic = Number(s.salary) || 0;
      const allowances = Math.round(basic * 0.2 * 100) / 100;
      const deductions = Math.round(basic * 0.12 * 100) / 100;
      const net = Math.round((basic + allowances - deductions) * 100) / 100;
      return {
        staff_id: s.id,
        month,
        year,
        basic_salary: basic,
        allowances,
        deductions,
        net_salary: net,
        status: "pending",
        paid_date: null,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from("payrolls")
      .insert(toCreate);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      generated: toCreate.length,
      skipped: existingSet.size,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate payroll";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
