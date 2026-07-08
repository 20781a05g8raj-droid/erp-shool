import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

const STAFF_FIELDS =
  "id, employee_id, first_name, last_name, email, phone, designation, department, type, photo";

const LEAVE_SELECT = `*, staff:staff(${STAFF_FIELDS})`;

// GET /api/hr/leaves — list leaves with optional filters (status, staffId)
// Role scoping: teacher sees only their own leaves
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");

  // Teacher role: lock to their own staffId
  const scopedStaffId =
    user.role === "teacher" && user.staffId ? user.staffId : staffId;

  // First, fetch staff IDs that belong to the school
  const { data: schoolStaffIds, error: ssError } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("school_id", user.schoolId);

  if (ssError) {
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }

  const schoolStaffIdArr = (schoolStaffIds || []).map(
    (s) => (s as { id: string }).id
  );

  if (schoolStaffIdArr.length === 0) {
    return NextResponse.json({ leaves: [] });
  }

  let query = supabaseAdmin
    .from("staff_leaves")
    .select(LEAVE_SELECT)
    .in("staff_id", schoolStaffIdArr)
    .order("created_at", { ascending: false });

  if (scopedStaffId) {
    query = query.eq("staff_id", scopedStaffId);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: leavesRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }

  const leaves = (leavesRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({ leaves: leaves.map((l) => toCamelCase(l)) });
}

// POST /api/hr/leaves — apply leave { staffId, fromDate, toDate, reason, type }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { staffId, fromDate, toDate, reason, type } = body as {
      staffId?: string;
      fromDate?: string;
      toDate?: string;
      reason?: string;
      type?: string;
    };

    if (!staffId) {
      return NextResponse.json(
        { error: "staffId is required" },
        { status: 400 }
      );
    }
    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "fromDate and toDate are required" },
        { status: 400 }
      );
    }
    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "fromDate cannot be after toDate" },
        { status: 400 }
      );
    }

    const validTypes = ["casual", "sick", "earned", "unpaid"];
    const leaveType =
      typeof type === "string" && validTypes.includes(type) ? type : "casual";

    // Validate staff belongs to school
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("id", staffId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: "Staff not found" },
        { status: 404 }
      );
    }

    const insertRow = {
      staff_id: staffId,
      from_date: fromDate,
      to_date: toDate,
      reason: reason?.trim() || null,
      type: leaveType,
      status: "pending",
    };

    const { data: createdRaw, error: insertError } = await supabaseAdmin
      .from("staff_leaves")
      .insert(insertRow)
      .select(LEAVE_SELECT)
      .single();

    if (insertError || !createdRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to apply leave" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      toCamelCase(createdRaw as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to apply leave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
