import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET — daily collection report
// Query params:
//   from=YYYY-MM-DD  (default: today)
//   to=YYYY-MM-DD    (default: today)
//   preset=today|thisWeek|thisMonth|custom
// Returns: total collected, breakdown by method, count, list of all payments
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const preset = searchParams.get("preset") || "today";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Determine date range
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  let from: string;
  let to: string;

  if (preset === "custom" && fromParam && toParam) {
    from = fromParam;
    to = toParam;
  } else if (preset === "today") {
    from = todayStr;
    to = todayStr;
  } else if (preset === "thisWeek") {
    // Week starts Monday
    const day = today.getDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    from = monday.toISOString().split("T")[0];
    to = todayStr;
  } else if (preset === "thisMonth") {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    from = firstOfMonth.toISOString().split("T")[0];
    to = todayStr;
  } else if (fromParam && toParam) {
    from = fromParam;
    to = toParam;
  } else {
    from = todayStr;
    to = todayStr;
  }

  // Role-based scoping: student/parent only see their own payments
  const scopedStudentId =
    user.role === "student" || user.role === "parent"
      ? user.studentId
      : null;

  let paymentQuery = supabaseAdmin
    .from("fee_payments")
    .select(
      "id, receipt_number, amount, payment_method, payment_date, collected_by, transaction_id, remarks, student_fees!inner(student_id, students!inner(id, school_id, first_name, last_name, admission_number, classes(name)), fee_structures(name, term))"
    )
    .gte("payment_date", from)
    .lte("payment_date", to)
    .order("payment_date", { ascending: false });

  if (scopedStudentId) {
    paymentQuery = paymentQuery.eq("student_fees.student_id", scopedStudentId);
  } else {
    paymentQuery = paymentQuery.eq("student_fees.students.school_id", user.schoolId);
  }

  const { data: paymentsRaw, error } = await paymentQuery;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch collection report" },
      { status: 500 }
    );
  }

  const payments = (paymentsRaw || []) as Array<Record<string, unknown>>;

  // Total collected + breakdown by method
  const totalCollected = payments.reduce(
    (s, p) => s + (p.amount as number),
    0
  );

  const breakdown: Record<string, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    online: { amount: 0, count: 0 },
    cheque: { amount: 0, count: 0 },
  };
  for (const p of payments) {
    const method = (p.payment_method as string) || "cash";
    if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
    breakdown[method].amount += p.amount as number;
    breakdown[method].count += 1;
  }

  // Daily breakdown (for chart)
  const byDay: Record<string, { date: string; amount: number; count: number }> = {};
  for (const p of payments) {
    const d = (p.payment_date as string) || "";
    if (!d) continue;
    if (!byDay[d]) byDay[d] = { date: d, amount: 0, count: 0 };
    byDay[d].amount += p.amount as number;
    byDay[d].count += 1;
  }
  // Fill missing days in the range
  const dailyChart: { date: string; label: string; amount: number; count: number }[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split("T")[0];
    const entry = byDay[ds] || { date: ds, amount: 0, count: 0 };
    const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    dailyChart.push({ date: ds, label, amount: entry.amount, count: entry.count });
  }

  // List of payments for the table
  const paymentList = payments.map((p) => {
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
      transactionId: p.transaction_id,
      remarks: p.remarks,
      student: student
        ? {
            id: student.id,
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
  });

  return NextResponse.json({
    period: { from, to, preset },
    totalCollected,
    transactions: payments.length,
    breakdown: {
      cash: { amount: breakdown.cash.amount, count: breakdown.cash.count },
      online: { amount: breakdown.online.amount, count: breakdown.online.count },
      cheque: { amount: breakdown.cheque.amount, count: breakdown.cheque.count },
    },
    dailyChart,
    payments: paymentList,
  });
}
