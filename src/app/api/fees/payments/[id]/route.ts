import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  const { data: payment, error } = await supabaseAdmin
    .from("fee_payments")
    .select(
      "*, student_fees!inner(*, students(id, school_id, first_name, last_name, admission_number, classes(id, name), sections(id, name)), fee_structures(*, fee_items(*)), fee_payments(*))"
    )
    .eq("id", id)
    .eq("student_fees.students.school_id", user.schoolId)
    .maybeSingle();

  if (error || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const studentFee = payment.student_fees as Record<string, unknown>;

  // Role-based access for student/parent
  if (
    (user.role === "student" || user.role === "parent") &&
    user.studentId &&
    (studentFee.student_id as string) !== user.studentId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sort payments asc by payment_date for the receipt history
  const payments = (studentFee.fee_payments as Array<Record<string, unknown>>) || [];
  payments.sort((a, b) => {
    const pa = (a.payment_date as string) || "";
    const pb = (b.payment_date as string) || "";
    return pa.localeCompare(pb);
  });
  studentFee.fee_payments = payments;

  // Map relations for frontend compatibility
  const paymentWithCompat = {
    ...payment,
    studentFee: payment.student_fees,
  };

  if (paymentWithCompat.studentFee) {
    const sf = paymentWithCompat.studentFee as any;
    sf.student = sf.students;
    if (sf.student) {
      sf.student.class = sf.students.classes;
      sf.student.section = sf.students.sections;
    }
    sf.feeStructure = sf.fee_structures;
    if (sf.feeStructure) {
      sf.feeStructure.items = sf.fee_structures.fee_items || [];
    }
    sf.payments = sf.fee_payments || [];
  }

  // Fetch school info for the receipt letterhead
  const { data: school } = await supabaseAdmin
    .from("schools")
    .select("id, name, address, phone, email, logo")
    .eq("id", user.schoolId)
    .single();

  return NextResponse.json({
    payment: toCamelCase(paymentWithCompat as Record<string, unknown>),
    school: toCamelCase(school as Record<string, unknown> | null),
  });
}

function computeStatus(paid: number, total: number, dueDate: string | null): string {
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) return "partial";
  if (dueDate) {
    const today = new Date().toISOString().split("T")[0];
    if (dueDate < today) return "overdue";
  }
  return "pending";
}

// PUT — approve or reject a pending payment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only school_admin, super_admin, accountant can approve payments
  const canApprove = ["school_admin", "super_admin", "accountant"].includes(user.role);
  if (!canApprove) {
    return NextResponse.json(
      { error: "You don't have permission to manage payment approvals" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action?: "approve" | "reject" };

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch the payment
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from("fee_payments")
      .select("*, student_fees!inner(*, students(id, school_id))")
      .eq("id", id)
      .eq("student_fees.students.school_id", user.schoolId)
      .maybeSingle();

    if (fetchErr || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: `Payment is already ${payment.status}` },
        { status: 400 }
      );
    }

    if (action === "reject") {
      // Just update status to rejected
      const { data: updatedPayment } = await supabaseAdmin
        .from("fee_payments")
        .update({ status: "rejected" })
        .eq("id", id)
        .select("*")
        .single();

      return NextResponse.json({
        success: true,
        payment: toCamelCase(updatedPayment as Record<string, unknown>),
      });
    }

    // Approve:
    // 1. Update payment status to approved
    const { data: updatedPayment, error: payUpdateErr } = await supabaseAdmin
      .from("fee_payments")
      .update({ status: "approved" })
      .eq("id", id)
      .select("*")
      .single();

    if (payUpdateErr || !updatedPayment) {
      return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 });
    }

    // 2. Fetch the current student fee state
    const { data: latestFee, error: feeErr } = await supabaseAdmin
      .from("student_fees")
      .select("*")
      .eq("id", payment.student_fee_id)
      .single();

    if (feeErr || !latestFee) {
      return NextResponse.json({ error: "Associated student fee record not found" }, { status: 404 });
    }

    const payAmount = Number(payment.amount);

    // 3. Calculate new paid and due amounts
    const newPaid = (latestFee.paid_amount as number) + payAmount;
    const newDue = Math.max(0, (latestFee.total_amount as number) - newPaid);
    const newStatus = computeStatus(
      newPaid,
      latestFee.total_amount as number,
      latestFee.due_date as string | null
    );

    // 4. Update the student fee
    const { data: updatedStudentFee, error: updateError } = await supabaseAdmin
      .from("student_fees")
      .update({
        paid_amount: newPaid,
        due_amount: newDue,
        status: newStatus,
      })
      .eq("id", latestFee.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update student fee" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      payment: toCamelCase(updatedPayment as Record<string, unknown>),
      studentFee: toCamelCase(updatedStudentFee as Record<string, unknown>),
    });
  } catch (err) {
    console.error("Approve payment error:", err);
    return NextResponse.json(
      { error: "Failed to process payment approval" },
      { status: 500 }
    );
  }
}
