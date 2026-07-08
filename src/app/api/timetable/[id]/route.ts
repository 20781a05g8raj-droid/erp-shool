import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    return NextResponse.json({ error: "You don't have permission to edit the timetable" }, { status: 403 });
  }

  const { id } = await params;

  // Verify the slot belongs to a class in this school.
  const slot = await db.timetableSlot.findUnique({
    where: { id },
    include: { class: { select: { schoolId: true } } },
  });
  if (!slot || slot.class.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  await db.timetableSlot.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
