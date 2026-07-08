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

// GET — accountant's master ledger: complete fee picture for ALL students
// Filters: ?classId=&status=&search=
// Sorted by student name (firstName asc, then lastName)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.toLowerCase();

  // Role-based scoping: student/parent only see their own
  const scopedStudentId =
    user.role === "student" || user.role === "parent"
      ? user.studentId
      : null;

  // Refresh overdue statuses based on due date (cheap pass)
  const allFees = await db.studentFee.findMany({
    where: { student: { schoolId: user.schoolId } },
    select: { id: true, paidAmount: true, totalAmount: true, dueDate: true, status: true },
  });
  for (const sf of allFees) {
    const correct = computeStatus(sf.paidAmount, sf.totalAmount, sf.dueDate);
    if (correct !== sf.status) {
      await db.studentFee.update({
        where: { id: sf.id },
        data: { status: correct },
      });
    }
  }

  // Build student filter
  const studentWhere: {
    schoolId: string;
    classId?: string;
    id?: string;
    OR?: { firstName?: { contains: string }; lastName?: { contains: string }; admissionNumber?: { contains: string } }[];
  } = { schoolId: user.schoolId };

  if (scopedStudentId) {
    studentWhere.id = scopedStudentId;
  }
  if (classId && classId !== "all") {
    studentWhere.classId = classId;
  }
  if (search) {
    studentWhere.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { admissionNumber: { contains: search } },
    ];
  }

  const where: { student: typeof studentWhere; status?: string } = {
    student: studentWhere,
  };
  if (status && status !== "all") {
    where.status = status;
  }

  const studentFees = await db.studentFee.findMany({
    where,
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      feeStructure: { select: { id: true, name: true, term: true, totalAmount: true } },
      payments: {
        orderBy: { paymentDate: "desc" },
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paymentDate: true,
          receiptNumber: true,
          transactionId: true,
          collectedBy: true,
          remarks: true,
        },
      },
    },
    orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
  });

  const today = new Date().toISOString().split("T")[0];

  const ledger = studentFees.map((sf) => {
    const lastPayment =
      sf.payments.length > 0 ? sf.payments[0] : null;
    const daysOverdue =
      sf.dueDate && sf.status !== "paid" && sf.dueDate < today
        ? Math.floor(
            (new Date(today).getTime() - new Date(sf.dueDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
    return {
      id: sf.id,
      studentId: sf.studentId,
      student: {
        id: sf.student.id,
        firstName: sf.student.firstName,
        lastName: sf.student.lastName,
        admissionNumber: sf.student.admissionNumber,
        fatherName: sf.student.fatherName,
        parentPhone: sf.student.parentPhone,
        parentEmail: sf.student.parentEmail,
        class: sf.student.class,
        section: sf.student.section,
      },
      feeStructure: sf.feeStructure,
      totalAmount: sf.totalAmount,
      paidAmount: sf.paidAmount,
      dueAmount: sf.dueAmount,
      dueDate: sf.dueDate,
      status: sf.status,
      daysOverdue,
      lastPayment: lastPayment
        ? {
            id: lastPayment.id,
            receiptNumber: lastPayment.receiptNumber,
            amount: lastPayment.amount,
            paymentMethod: lastPayment.paymentMethod,
            paymentDate: lastPayment.paymentDate,
            collectedBy: lastPayment.collectedBy,
          }
        : null,
      payments: sf.payments,
    };
  });

  return NextResponse.json({
    ledger,
    count: ledger.length,
    summary: {
      totalExpected: ledger.reduce((s, l) => s + l.totalAmount, 0),
      totalPaid: ledger.reduce((s, l) => s + l.paidAmount, 0),
      totalDue: ledger.reduce((s, l) => s + l.dueAmount, 0),
    },
  });
}
