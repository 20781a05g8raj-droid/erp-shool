import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canEditTimetable } from "@/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// DELETE /api/timetable/[id] — delete a single timetable slot.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only HR, school_admin, super_admin can edit timetable
  if (!canEditTimetable(user.role)) {
    return NextResponse.json(
      { error: "You don't have permission to edit the timetable" },
      { status: 403 }
    );
  }

  const { id } = await params;

  // Verify the slot belongs to a class in this school.
  const { data: slot } = await supabaseAdmin
    .from("timetable_slots")
    .select("id, class:classes(school_id)")
    .eq("id", id)
    .maybeSingle();

  const classRow = slot?.class as { school_id?: string } | null | undefined;
  if (!slot || !classRow || classRow.school_id !== user.schoolId) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("timetable_slots")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Failed to delete slot" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
