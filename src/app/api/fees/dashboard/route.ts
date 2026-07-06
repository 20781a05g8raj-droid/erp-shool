import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const studentFeeWhere = scopedStudentId
    ? { studentId: scopedStudentId }
    : { student: { schoolId } };

  const studentFees = await db.studentFee.findMany({
    where: studentFeeWhere,
    select: {
      totalAmount: true,
      paidAmount: true,
      dueAmount: true,
      status: true,
      dueDate: true,
    },
  });

  const totalExpected = studentFees.reduce((s, f) => s + f.totalAmount, 0);
  const totalCollected = studentFees.reduce((s, f) => s + f.paidAmount, 0);
  const totalDue = studentFees.reduce((s, f) => s + f.dueAmount, 0);
  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // This month's collection
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthPayments = await db.feePayment.findMany({
    where: {
      paymentDate: { startsWith: monthPrefix },
      studentFee: scopedStudentId
        ? { studentId: scopedStudentId }
        : { student: { schoolId } },
    },
    select: { amount: true },
  });
  const collectedThisMonth = monthPayments.reduce((s, p) => s + p.amount, 0);

  // Defaulters: students with non-paid fees (and dueAmount > 0)
  const defaulters = studentFees.filter(
    (f) => f.status !== "paid" && f.dueAmount > 0
  ).length;

  // Status breakdown
  const statusCounts = { paid: 0, partial: 0, pending: 0, overdue: 0 };
  for (const f of studentFees) {
    if (f.status in statusCounts) {
      statusCounts[f.status as keyof typeof statusCounts]++;
    }
  }

  // Collection by month (last 6 months)
  const collectionByMonth: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const payments = await db.feePayment.findMany({
      where: {
        paymentDate: { startsWith: prefix },
        studentFee: scopedStudentId
          ? { studentId: scopedStudentId }
          : { student: { schoolId } },
      },
      select: { amount: true },
    });
    const amount = payments.reduce((s, p) => s + p.amount, 0);
    collectionByMonth.push({ month: monthName, amount });
  }

  // Recent payments (last 10)
  const recentPayments = await db.feePayment.findMany({
    where: {
      studentFee: scopedStudentId
        ? { studentId: scopedStudentId }
        : { student: { schoolId } },
    },
    include: {
      studentFee: {
        include: {
          student: { select: { firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } },
          feeStructure: { select: { name: true, term: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    totalCollected,
    totalDue,
    totalExpected,
    collectedThisMonth,
    collectionRate,
    defaulters,
    statusBreakdown: statusCounts,
    collectionByMonth,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      collectedBy: p.collectedBy,
      student: p.studentFee.student
        ? {
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
    })),
  });
}
