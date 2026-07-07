import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — single student fee with payments
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const studentFee = await db.studentFee.findFirst({
    where: {
      id,
      student: { schoolId: user.schoolId },
    },
    include: {
      student: { include: { class: true } },
      feeStructure: { include: { items: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });

  if (!studentFee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Role-based: student/parent can only view their own
  if (
    (user.role === "student" || user.role === "parent") &&
    user.studentId &&
    studentFee.studentId !== user.studentId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ studentFee });
}

// PUT — update student fee (rare: e.g. adjust total/due date)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { dueDate, totalAmount, status } = body as {
      dueDate?: string | null;
      totalAmount?: number;
      status?: string;
    };

    const existing = await db.studentFee.findFirst({
      where: { id, student: { schoolId: user.schoolId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newTotal =
      totalAmount !== undefined ? Number(totalAmount) : existing.totalAmount;
    const newDue =
      totalAmount !== undefined
        ? Math.max(0, newTotal - existing.paidAmount)
        : existing.dueAmount;

    let newStatus = existing.status;
    if (status) newStatus = status;
    else if (totalAmount !== undefined) {
      if (existing.paidAmount >= newTotal && newTotal > 0) newStatus = "paid";
      else if (existing.paidAmount > 0) newStatus = "partial";
      else newStatus = "pending";
    }

    const updated = await db.studentFee.update({
      where: { id },
      data: {
        dueDate: dueDate !== undefined ? dueDate || null : existing.dueDate,
        totalAmount: newTotal,
        dueAmount: newDue,
        status: newStatus,
      },
      include: {
        student: { include: { class: true } },
        feeStructure: true,
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });

    return NextResponse.json({ studentFee: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update student fee" },
      { status: 500 }
    );
  }
}
