import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

  const where: {
    staff: { schoolId: string; id?: string };
    status?: string;
  } = {
    staff: { schoolId: user.schoolId },
  };

  if (scopedStaffId) {
    where.staff.id = scopedStaffId;
  }
  if (status && status !== "all") {
    where.status = status;
  }

  const leaves = await db.staffLeave.findMany({
    where,
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
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leaves });
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
    const staff = await db.staff.findFirst({
      where: { id: staffId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json(
        { error: "Staff not found" },
        { status: 404 }
      );
    }

    const created = await db.staffLeave.create({
      data: {
        staffId,
        fromDate,
        toDate,
        reason: reason?.trim() || null,
        type: leaveType,
        status: "pending",
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

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to apply leave";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
