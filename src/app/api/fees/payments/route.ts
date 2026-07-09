import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

    const { data: studentFee, error: sfError } = await supabaseAdmin
      .from("student_fees")
      .select("*, students!inner(school_id)")
      .eq("id", studentFeeId)
      .eq("students.school_id", user.schoolId)
      .maybeSingle();

    if (sfError || !studentFee) {
      return NextResponse.json(
        { error: "Student fee record not found" },
        { status: 404 }
      );
    }

    const payAmount = Number(amount);
    if (payAmount > (studentFee.due_amount as number) + 0.01) {
      return NextResponse.json(
        {
          error: `Amount exceeds outstanding due of ${studentFee.due_amount}`,
        },
        { status: 400 }
      );
    }

    // Generate receipt number: RCP + incrementing (year + sequential)
    const year = new Date().getFullYear();
    const prefix = `RCP${year}`;
    const { data: lastPayments } = await supabaseAdmin
      .from("fee_payments")
      .select("receipt_number")
      .like("receipt_number", `${prefix}%`)
      .order("receipt_number", { ascending: false })
      .limit(1);

    let seq = 1;
    const lastPayment = (lastPayments || [])[0] as
      | { receipt_number: string | null }
      | undefined;
    if (lastPayment && lastPayment.receipt_number) {
      const parts = lastPayment.receipt_number.split("-");
      if (parts.length === 2) {
        const n = parseInt(parts[1], 10);
        if (!isNaN(n)) seq = n + 1;
      }
    }
    const receiptNumber = `${prefix}-${String(seq).padStart(5, "0")}`;

    const isStudentOrParent = user.role === "student" || user.role === "parent";
    const paymentStatus = isStudentOrParent ? "pending" : "approved";

    const { data: payment, error: payError } = await supabaseAdmin
      .from("fee_payments")
      .insert({
        student_fee_id: studentFeeId,
        amount: payAmount,
        payment_method: paymentMethod || "cash",
        payment_date:
          paymentDate || new Date().toISOString().split("T")[0],
        receipt_number: receiptNumber,
        transaction_id: transactionId || null,
        collected_by: user.name,
        remarks: remarks || null,
        status: paymentStatus,
      })
      .select("*")
      .single();

    if (payError || !payment) {
      console.error("Pay insert error:", payError);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    if (isStudentOrParent) {
      return NextResponse.json(
        {
          payment: toCamelCase(payment as Record<string, unknown>),
          message: "Payment recorded successfully and is pending approval.",
        },
        { status: 201 }
      );
    }

    // Update studentFee (Admin / Accountant only)
    const newPaid = (studentFee.paid_amount as number) + payAmount;
    const newDue = Math.max(0, (studentFee.total_amount as number) - newPaid);
    const newStatus = computeStatus(
      newPaid,
      studentFee.total_amount as number,
      studentFee.due_date as string | null
    );

    const { data: updatedStudentFee, error: updateError } = await supabaseAdmin
      .from("student_fees")
      .update({
        paid_amount: newPaid,
        due_amount: newDue,
        status: newStatus,
      })
      .eq("id", studentFeeId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update student fee" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        payment: toCamelCase(payment as Record<string, unknown>),
        studentFee: toCamelCase(updatedStudentFee as Record<string, unknown>),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
