import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — single payment (for receipt view)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await db.feePayment.findFirst({
    where: {
      id,
      studentFee: { student: { schoolId: user.schoolId } },
    },
    include: {
      studentFee: {
        include: {
          student: { include: { class: true } },
          feeStructure: { include: { items: true } },
          payments: { orderBy: { paymentDate: "asc" } },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Role-based access for student/parent
  if (
    (user.role === "student" || user.role === "parent") &&
    user.studentId &&
    payment.studentFee.studentId !== user.studentId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ payment });
}
