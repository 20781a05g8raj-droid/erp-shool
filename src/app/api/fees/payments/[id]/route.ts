import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — single payment (for receipt view)
// Returns: payment + studentFee (with student, feeStructure, items, all previous payments) + school info
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
          student: {
            include: {
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
          feeStructure: { include: { items: true } },
          // All payments on this student fee — for payment history on the receipt
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

  // Fetch school info for the receipt letterhead
  const school = await db.school.findUnique({
    where: { id: user.schoolId },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      logo: true,
    },
  });

  return NextResponse.json({ payment, school });
}
