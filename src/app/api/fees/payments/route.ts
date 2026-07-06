import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function computeStatus(paid: number, total: number, dueDate: string | null): string {
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) return "partial";
  if (dueDate) {
    const today = new Date().toISOString().split("T")[0];
    if (dueDate < today) return "overdue";
  }
  return "pending";
}

// POST — record a payment
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      studentFeeId,
      amount,
      paymentMethod,
      paymentDate,
      remarks,
      transactionId,
    } = body as {
      studentFeeId?: string;
      amount?: number;
      paymentMethod?: string;
      paymentDate?: string;
      remarks?: string;
      transactionId?: string;
    };

    if (!studentFeeId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "studentFeeId and a positive amount are required" },
        { status: 400 }
      );
    }

    const studentFee = await db.studentFee.findFirst({
      where: { id: studentFeeId, student: { schoolId: user.schoolId } },
    });
    if (!studentFee) {
      return NextResponse.json(
        { error: "Student fee record not found" },
        { status: 404 }
      );
    }

    const payAmount = Number(amount);
    if (payAmount > studentFee.dueAmount + 0.01) {
      return NextResponse.json(
        {
          error: `Amount exceeds outstanding due of ${studentFee.dueAmount}`,
        },
        { status: 400 }
      );
    }

    // Generate receipt number: RCP + incrementing (year + sequential)
    const year = new Date().getFullYear();
    const prefix = `RCP${year}`;
    const lastPayment = await db.feePayment.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
    });
    let seq = 1;
    if (lastPayment && lastPayment.receiptNumber) {
      const parts = lastPayment.receiptNumber.split("-");
      if (parts.length === 2) {
        const n = parseInt(parts[1], 10);
        if (!isNaN(n)) seq = n + 1;
      }
    }
    const receiptNumber = `${prefix}-${String(seq).padStart(5, "0")}`;

    const payment = await db.feePayment.create({
      data: {
        studentFeeId,
        amount: payAmount,
        paymentMethod: paymentMethod || "cash",
        paymentDate: paymentDate || new Date().toISOString().split("T")[0],
        receiptNumber,
        transactionId: transactionId || null,
        collectedBy: user.name,
        remarks: remarks || null,
      },
    });

    // Update studentFee
    const newPaid = studentFee.paidAmount + payAmount;
    const newDue = Math.max(0, studentFee.totalAmount - newPaid);
    const newStatus = computeStatus(newPaid, studentFee.totalAmount, studentFee.dueDate);

    const updatedStudentFee = await db.studentFee.update({
      where: { id: studentFeeId },
      data: {
        paidAmount: newPaid,
        dueAmount: newDue,
        status: newStatus,
      },
    });

    return NextResponse.json(
      { payment, studentFee: updatedStudentFee },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
