import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET — aggregated fee stats
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Scoped studentId for student/parent
  const scopedStudentId =
    user.role === "student" || user.role === "parent" ? user.studentId : null;

  // Fetch student fees (scoped by student or by school via student relation)
  let studentFeesQuery = supabaseAdmin
    .from("student_fees")
    .select(
      "total_amount, paid_amount, due_amount, status, due_date, students!inner(school_id)"
    );

  if (scopedStudentId) {
    studentFeesQuery = studentFeesQuery.eq("student_id", scopedStudentId);
  } else {
    studentFeesQuery = studentFeesQuery.eq("students.school_id", schoolId);
  }

  const { data: studentFeesRaw } = await studentFeesQuery;
  const studentFees = (studentFeesRaw || []) as Array<{
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    status: string;
    due_date: string | null;
  }>;

  const totalExpected = studentFees.reduce((s, f) => s + f.total_amount, 0);
  const totalCollected = studentFees.reduce((s, f) => s + f.paid_amount, 0);
  const totalDue = studentFees.reduce((s, f) => s + f.due_amount, 0);
  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // This month's collection — fetch all payments and filter in JS
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let monthPaymentQuery = supabaseAdmin
    .from("fee_payments")
    .select("amount, payment_date, student_fees!inner(student_id, students!inner(school_id))");

  if (scopedStudentId) {
    monthPaymentQuery = monthPaymentQuery.eq("student_fees.student_id", scopedStudentId);
  } else {
    monthPaymentQuery = monthPaymentQuery.eq("student_fees.students.school_id", schoolId);
  }

  const { data: monthPaymentsRaw } = await monthPaymentQuery;
  const monthPayments = ((monthPaymentsRaw || []) as Array<{
    amount: number;
    payment_date: string | null;
  }>).filter((p) => p.payment_date && p.payment_date.startsWith(monthPrefix));
  const collectedThisMonth = monthPayments.reduce((s, p) => s + p.amount, 0);

  // Defaulters: students with non-paid fees (and dueAmount > 0)
  const defaulters = studentFees.filter(
    (f) => f.status !== "paid" && f.due_amount > 0
  ).length;

  // Status breakdown
  const statusCounts = { paid: 0, partial: 0, pending: 0, overdue: 0 };
  for (const f of studentFees) {
    if (f.status in statusCounts) {
      statusCounts[f.status as keyof typeof statusCounts]++;
    }
  }

  // Collection by month (last 6 months) — fetch all payments and group in JS
  let allPaymentsQuery = supabaseAdmin
    .from("fee_payments")
    .select("amount, payment_date, student_fees!inner(student_id, students!inner(school_id))");

  if (scopedStudentId) {
    allPaymentsQuery = allPaymentsQuery.eq("student_fees.student_id", scopedStudentId);
  } else {
    allPaymentsQuery = allPaymentsQuery.eq("student_fees.students.school_id", schoolId);
  }

  const { data: allPaymentsRaw } = await allPaymentsQuery;
  const allPayments = (allPaymentsRaw || []) as Array<{
    amount: number;
    payment_date: string | null;
  }>;

  const collectionByMonth: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const amount = allPayments
      .filter((p) => p.payment_date && p.payment_date.startsWith(prefix))
      .reduce((s, p) => s + p.amount, 0);
    collectionByMonth.push({ month: monthName, amount });
  }

  // Recent payments (last 10)
  let recentQuery = supabaseAdmin
    .from("fee_payments")
    .select(
      "id, receipt_number, amount, payment_method, payment_date, collected_by, created_at, student_fees!inner(student_id, students!inner(id, school_id, first_name, last_name, admission_number, classes(name)), fee_structures(name, term))"
    );

  if (scopedStudentId) {
    recentQuery = recentQuery.eq("student_fees.student_id", scopedStudentId);
  } else {
    recentQuery = recentQuery.eq("student_fees.students.school_id", schoolId);
  }
  recentQuery = recentQuery.order("created_at", { ascending: false }).limit(10);

  const { data: recentPaymentsRaw } = await recentQuery;
  const recentPayments = (recentPaymentsRaw || []) as Array<Record<string, unknown>>;

  return NextResponse.json({
    totalCollected,
    totalDue,
    totalExpected,
    collectedThisMonth,
    collectionRate,
    defaulters,
    statusBreakdown: statusCounts,
    collectionByMonth,
    recentPayments: recentPayments.map((p) => {
      const sf = (p.student_fees as Record<string, unknown>) || {};
      const student = (sf.students as Record<string, unknown>) || null;
      const feeStructure = (sf.fee_structures as Record<string, unknown>) || null;
      const classNameObj = (student?.classes as Record<string, unknown>) || null;
      return {
        id: p.id,
        receiptNumber: p.receipt_number,
        amount: p.amount,
        paymentMethod: p.payment_method,
        paymentDate: p.payment_date,
        collectedBy: p.collected_by,
        student: student
          ? {
              name: `${student.first_name} ${student.last_name}`,
              admissionNumber: student.admission_number,
              className: (classNameObj?.name as string) || "—",
            }
          : null,
        feeStructure: feeStructure
          ? {
              name: feeStructure.name,
              term: feeStructure.term,
            }
          : null,
      };
    }),
  });
}
