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

  // Fetch school info for the receipt letterhead
  const { data: school } = await supabaseAdmin
    .from("schools")
    .select("id, name, address, phone, email, logo")
    .eq("id", user.schoolId)
    .single();

  return NextResponse.json({
    payment: toCamelCase(payment as Record<string, unknown>),
    school: toCamelCase(school as Record<string, unknown> | null),
  });
}
