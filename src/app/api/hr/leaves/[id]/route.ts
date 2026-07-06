import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/hr/leaves/[id] — approve/reject { status, approvedBy }
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the leave belongs to a staff in this school
  const existing = await db.staffLeave.findFirst({
    where: { id, staff: { schoolId: user.schoolId } },
    select: { id: true },
  });
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
    const updated = await db.staffLeave.update({
      where: { id },
      data: {
        status,
        approvedBy: approvedBy?.trim() || user.name || null,
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
  const existing = await db.staffLeave.findFirst({
    where: { id, staff: { schoolId: user.schoolId } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 });
  }

  try {
    await db.staffLeave.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete leave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
