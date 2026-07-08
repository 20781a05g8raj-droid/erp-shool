import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const paymentWhere = {
    paymentDate: { gte: from, lte: to },
    studentFee: scopedStudentId
      ? { studentId: scopedStudentId }
      : { student: { schoolId: user.schoolId } },
  };

  const payments = await db.feePayment.findMany({
    where: paymentWhere,
    include: {
      studentFee: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { name: true } },
            },
          },
          feeStructure: { select: { name: true, term: true } },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  });

  // Total collected + breakdown by method
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  const breakdown: Record<string, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    online: { amount: 0, count: 0 },
    cheque: { amount: 0, count: 0 },
  };
  for (const p of payments) {
    const m = breakdown[p.paymentMethod] || { amount: 0, count: 0 };
    m.amount += p.amount;
    m.count += 1;
    breakdown[p.paymentMethod] = m;
  }

  // Daily breakdown (for chart)
  const byDay: Record<string, { date: string; amount: number; count: number }> = {};
  for (const p of payments) {
    const d = p.paymentDate;
    if (!byDay[d]) byDay[d] = { date: d, amount: 0, count: 0 };
    byDay[d].amount += p.amount;
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
  const paymentList = payments.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate,
    collectedBy: p.collectedBy,
    transactionId: p.transactionId,
    remarks: p.remarks,
    student: p.studentFee.student
      ? {
          id: p.studentFee.student.id,
          name: `${p.studentFee.student.firstName} ${p.studentFee.student.lastName}`,
          admissionNumber: p.studentFee.student.admissionNumber,
          className: p.studentFee.student.class?.name || "—",
        }
      : null,
    feeStructure: p.studentFee.feeStructure
      ? {
          name: p.studentFee.feeStructure.name,
          term: p.studentFee.feeStructure.term,
        }
      : null,
  }));

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
