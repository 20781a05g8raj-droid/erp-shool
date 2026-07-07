import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/reports/fees — fee collection summary by class, defaulters list, monthly trend
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const now = new Date();

  // Get classes
  const classes = await db.class.findMany({
    where: { schoolId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  // Get all student fees with student + class info
  const studentFees = await db.studentFee.findMany({
    where: { student: { schoolId } },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          classId: true,
          class: { select: { name: true } },
          fatherName: true,
          parentPhone: true,
        },
      },
      feeStructure: { select: { name: true, term: true } },
    },
  });

  // Get all payments for monthly trend (last 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startPrefix = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`;
  const payments = await db.feePayment.findMany({
    where: {
      paymentDate: { gte: startPrefix },
      studentFee: { student: { schoolId } },
    },
    select: { amount: true, paymentDate: true },
  });

  // Overall totals
  const totalExpected = studentFees.reduce((s, f) => s + f.totalAmount, 0);
  const totalCollected = studentFees.reduce((s, f) => s + f.paidAmount, 0);
  const totalDue = studentFees.reduce((s, f) => s + f.dueAmount, 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // By class
  const classMap: Record<string, { name: string; expected: number; collected: number; due: number }> = {};
  for (const cls of classes) {
    classMap[cls.id] = { name: cls.name, expected: 0, collected: 0, due: 0 };
  }
  for (const sf of studentFees) {
    const entry = sf.student.classId ? classMap[sf.student.classId] : null;
    if (entry) {
      entry.expected += sf.totalAmount;
      entry.collected += sf.paidAmount;
      entry.due += sf.dueAmount;
    }
  }
  const byClass = Object.values(classMap).map((c) => ({
    class: c.name,
    expected: Math.round(c.expected),
    collected: Math.round(c.collected),
    due: Math.round(c.due),
    rate: c.expected > 0 ? Math.round((c.collected / c.expected) * 100) : 0,
  }));

  // Status breakdown
  const statusBreakdown: Record<string, number> = {
    paid: 0,
    partial: 0,
    pending: 0,
    overdue: 0,
  };
  for (const sf of studentFees) {
    if (sf.status in statusBreakdown) {
      statusBreakdown[sf.status]++;
    }
  }

  // Monthly trend (last 6 months)
  const monthlyTrend: { month: string; collected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const monthPayments = payments.filter((p) => p.paymentDate.startsWith(prefix));
    const collected = monthPayments.reduce((s, p) => s + p.amount, 0);
    monthlyTrend.push({ month: monthName, collected: Math.round(collected) });
  }

  // Defaulters: students with overdue or pending status (dueAmount > 0)
  const defaulters = studentFees
    .filter((sf) => sf.status !== "paid" && sf.dueAmount > 0)
    .map((sf) => ({
      id: sf.id,
      studentName: `${sf.student.firstName} ${sf.student.lastName}`,
      admissionNumber: sf.student.admissionNumber,
      className: sf.student.class?.name || "—",
      fatherName: sf.student.fatherName || "—",
      parentPhone: sf.student.parentPhone || "—",
      feeStructure: sf.feeStructure?.name || "—",
      term: sf.feeStructure?.term || "—",
      dueDate: sf.dueDate,
      dueAmount: Math.round(sf.dueAmount),
      status: sf.status,
    }))
    .sort((a, b) => b.dueAmount - a.dueAmount);

  return NextResponse.json({
    totalExpected: Math.round(totalExpected),
    totalCollected: Math.round(totalCollected),
    totalDue: Math.round(totalDue),
    collectionRate,
    statusBreakdown,
    byClass,
    monthlyTrend,
    defaulters,
    defaulterCount: defaulters.length,
  });
}
