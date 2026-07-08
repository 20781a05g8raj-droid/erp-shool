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

// GET — all students with pending/partial/overdue fees
// Filters: ?classId=&severity=
// Sorted by due amount DESC (biggest defaulters first)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const severity = searchParams.get("severity"); // overdue, critical, all

  // Student/parent cannot access defaulters list (no business seeing others)
  if (user.role === "student" || user.role === "parent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Refresh overdue statuses based on due date
  const allFees = await db.studentFee.findMany({
    where: { student: { schoolId: user.schoolId } },
    select: { id: true, paidAmount: true, totalAmount: true, dueDate: true, status: true },
  });
  const today = new Date().toISOString().split("T")[0];
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
  } = { schoolId: user.schoolId };
  if (classId && classId !== "all") {
    studentWhere.classId = classId;
  }

  // Get only non-paid fees with due > 0
  const defaultersFees = await db.studentFee.findMany({
    where: {
      student: studentWhere,
      status: { in: ["pending", "partial", "overdue"] },
      dueAmount: { gt: 0 },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          fatherName: true,
          parentPhone: true,
          parentEmail: true,
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
          collectedBy: true,
        },
        take: 1,
      },
    },
  });

  // Build enriched defaulters list with computed fields
  const defaulters = defaultersFees
    .map((sf) => {
      const daysOverdue =
        sf.dueDate && sf.dueDate < today
          ? Math.floor(
              (new Date(today).getTime() - new Date(sf.dueDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;
      const lastPayment =
        sf.payments.length > 0 ? sf.payments[0] : null;

      // Severity bucket: >30 days = critical, >7 = overdue, else pending
      let severityBucket: "critical" | "overdue" | "pending";
      if (daysOverdue > 30) severityBucket = "critical";
      else if (daysOverdue > 7) severityBucket = "overdue";
      else severityBucket = "pending";

      return {
        id: sf.id,
        student: sf.student,
        feeStructure: sf.feeStructure,
        totalAmount: sf.totalAmount,
        paidAmount: sf.paidAmount,
        dueAmount: sf.dueAmount,
        dueDate: sf.dueDate,
        status: sf.status,
        daysOverdue,
        severityBucket,
        lastPayment: lastPayment
          ? {
              id: lastPayment.id,
              receiptNumber: lastPayment.receiptNumber,
              amount: lastPayment.amount,
              paymentDate: lastPayment.paymentDate,
            }
          : null,
        remindedAt: null as string | null, // placeholder for future reminder tracking
      };
    })
    .filter((d) => {
      if (!severity || severity === "all") return true;
      if (severity === "overdue") return d.daysOverdue > 0;
      if (severity === "critical") return d.severityBucket === "critical";
      return true;
    })
    // Sort by due amount DESC (biggest defaulters first)
    .sort((a, b) => b.dueAmount - a.dueAmount);

  return NextResponse.json({
    defaulters,
    count: defaulters.length,
    summary: {
      totalDue: defaulters.reduce((s, d) => s + d.dueAmount, 0),
      avgDaysOverdue:
        defaulters.length > 0
          ? Math.round(
              defaulters.reduce((s, d) => s + d.daysOverdue, 0) / defaulters.length
            )
          : 0,
      critical: defaulters.filter((d) => d.severityBucket === "critical").length,
      overdue: defaulters.filter((d) => d.severityBucket === "overdue").length,
      pending: defaulters.filter((d) => d.severityBucket === "pending").length,
    },
  });
}

// POST — mark a defaulter as "reminded" (just record a timestamp in a notice-like way)
// For simplicity, we create a notice targeted to the student's parent role
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { studentFeeId, method } = body as {
      studentFeeId?: string;
      method?: "sms" | "email" | "call";
    };

    if (!studentFeeId) {
      return NextResponse.json(
        { error: "studentFeeId is required" },
        { status: 400 }
      );
    }

    const sf = await db.studentFee.findFirst({
      where: { id: studentFeeId, student: { schoolId: user.schoolId } },
      include: {
        student: { select: { firstName: true, lastName: true, parentPhone: true, parentEmail: true } },
        feeStructure: { select: { name: true } },
      },
    });

    if (!sf) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Create a notice as a reminder record
    const studentName = `${sf.student.firstName} ${sf.student.lastName}`;
    const reminderNotice = await db.notice.create({
      data: {
        title: `Fee Reminder — ${studentName} (${sf.feeStructure.name})`,
        content: `Reminder sent via ${method || "sms"}. Outstanding due: ₹${sf.dueAmount}. Due date: ${sf.dueDate || "—"}. Contact: ${sf.student.parentPhone || sf.student.parentEmail || "—"}.`,
        targetAudience: "parent",
        targetRole: "parent",
        postedBy: user.name,
        date: new Date().toISOString().split("T")[0],
        schoolId: user.schoolId,
      },
    });

    return NextResponse.json({
      success: true,
      noticeId: reminderNotice.id,
      message: `Reminder logged for ${studentName}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to log reminder" },
      { status: 500 }
    );
  }
}
