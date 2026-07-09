import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  const { data: studentFee, error } = await supabaseAdmin
    .from("student_fees")
    .select(
      "*, students!inner(id, school_id, first_name, last_name, admission_number, classes(id, name)), fee_structures(*, fee_items(*)), fee_payments(*)"
    )
    .eq("id", id)
    .eq("students.school_id", user.schoolId)
    .maybeSingle();

  if (error || !studentFee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sort payments desc by payment_date
  const payments = (studentFee.fee_payments as Array<Record<string, unknown>>) || [];
  payments.sort((a, b) => {
    const pa = (a.payment_date as string) || "";
    const pb = (b.payment_date as string) || "";
    return pb.localeCompare(pa);
  });
  studentFee.fee_payments = payments;

  // Role-based: student/parent can only view their own
  if (
    (user.role === "student" || user.role === "parent") &&
    user.studentId &&
    (studentFee.student_id as string) !== user.studentId
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentFeeWithCompat = {
    ...studentFee,
    student: studentFee.students,
    feeStructure: studentFee.fee_structures,
    payments: studentFee.fee_payments || [],
  };
  if (studentFeeWithCompat.student) {
    (studentFeeWithCompat.student as any).class = (studentFee.students as any).classes;
    (studentFeeWithCompat.student as any).section = (studentFee.students as any).sections;
  }

  return NextResponse.json({ studentFee: toCamelCase(studentFeeWithCompat as Record<string, unknown>) });
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

    const { data: existing, error: existError } = await supabaseAdmin
      .from("student_fees")
      .select("*, students!inner(school_id)")
      .eq("id", id)
      .eq("students.school_id", user.schoolId)
      .maybeSingle();

    if (existError || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newTotal =
      totalAmount !== undefined ? Number(totalAmount) : (existing.total_amount as number);
    const newDue =
      totalAmount !== undefined
        ? Math.max(0, newTotal - (existing.paid_amount as number))
        : (existing.due_amount as number);

    let newStatus = existing.status as string;
    if (status) newStatus = status;
    else if (totalAmount !== undefined) {
      if ((existing.paid_amount as number) >= newTotal && newTotal > 0) newStatus = "paid";
      else if ((existing.paid_amount as number) > 0) newStatus = "partial";
      else newStatus = "pending";
    }

    const updateData: Record<string, unknown> = {
      due_date: dueDate !== undefined ? dueDate || null : existing.due_date,
      total_amount: newTotal,
      due_amount: newDue,
      status: newStatus,
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("student_fees")
      .update(updateData)
      .eq("id", id)
      .select(
        "*, students(id, first_name, last_name, admission_number, classes(id, name)), fee_structures(*), fee_payments(*)"
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to update student fee" },
        { status: 500 }
      );
    }

    // Sort payments desc
    const payments = (updated.fee_payments as Array<Record<string, unknown>>) || [];
    payments.sort((a, b) => {
      const pa = (a.payment_date as string) || "";
      const pb = (b.payment_date as string) || "";
      return pb.localeCompare(pa);
    });
    updated.fee_payments = payments;

    const updatedWithCompat = {
      ...updated,
      student: updated.students,
      feeStructure: updated.fee_structures,
      payments: updated.fee_payments || [],
    };
    if (updatedWithCompat.student) {
      (updatedWithCompat.student as any).class = (updated.students as any).classes;
      (updatedWithCompat.student as any).section = (updated.students as any).sections;
    }

    return NextResponse.json({ studentFee: toCamelCase(updatedWithCompat as Record<string, unknown>) });
  } catch {
    return NextResponse.json(
      { error: "Failed to update student fee" },
      { status: 500 }
    );
  }
}
