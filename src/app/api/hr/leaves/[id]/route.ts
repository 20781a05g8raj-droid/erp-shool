import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

const STAFF_FIELDS =
  "id, employee_id, first_name, last_name, email, phone, designation, department, type, photo";

const LEAVE_SELECT = `*, staff:staff(${STAFF_FIELDS})`;

// Helper: confirm leave belongs to a staff in this school
async function getLeaveInSchool(
  leaveId: string,
  schoolId: string
): Promise<Record<string, unknown> | null> {
  // staff_leaves has no school_id directly; verify via staff relation.
  const { data, error } = await supabaseAdmin
    .from("staff_leaves")
    .select(LEAVE_SELECT)
    .eq("id", leaveId)
    .maybeSingle();

  if (error || !data) return null;
  const leave = data as Record<string, unknown>;
  const staff = leave.staff as Record<string, unknown> | null;
  // We need to verify school_id, but the staff select doesn't include it.
  // Re-fetch staff directly to confirm school.
  if (!staff) return null;
  const staffId = staff.id as string;
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("school_id")
    .eq("id", staffId)
    .maybeSingle();
  if (!staffRow) return null;
  if ((staffRow as { school_id: string }).school_id !== schoolId) return null;
  return leave;
}

// PUT /api/hr/leaves/[id] — approve/reject { status, approvedBy }
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getLeaveInSchool(id, user.schoolId);
  if (!existing) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 });
  }

  const body = await req.json();
  const { status, approvedBy } = body as {
    status?: string;
    approvedBy?: string;
  };

  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected' (or 'pending')" },
      { status: 400 }
    );
  }

  try {
    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from("staff_leaves")
      .update({
        status,
        approved_by: approvedBy?.trim() || user.name || null,
      })
      .eq("id", id)
      .select(LEAVE_SELECT)
      .single();

    if (updateError || !updatedRaw) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update leave" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(updatedRaw as Record<string, unknown>)
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update leave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/hr/leaves/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getLeaveInSchool(id, user.schoolId);
  if (!existing) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 });
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("staff_leaves")
      .delete()
      .eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete leave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
