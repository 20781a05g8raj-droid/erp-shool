import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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
  const { data: allFeesRaw } = await supabaseAdmin
    .from("student_fees")
    .select(
      "id, paid_amount, total_amount, due_date, status, students!inner(school_id)"
    )
    .eq("students.school_id", user.schoolId);

  const allFees = (allFeesRaw || []) as Array<{
    id: string;
    paid_amount: number;
    total_amount: number;
    due_date: string | null;
    status: string;
  }>;
  const today = new Date().toISOString().split("T")[0];
  for (const sf of allFees) {
    const correct = computeStatus(sf.paid_amount, sf.total_amount, sf.due_date);
    if (correct !== sf.status) {
      await supabaseAdmin
        .from("student_fees")
        .update({ status: correct })
        .eq("id", sf.id);
    }
  }

  // Find matching student IDs by class filter
  let studentIds: string[] | null = null;
  if (classId && classId !== "all") {
    const { data: matchingStudents } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("class_id", classId);
    studentIds = (matchingStudents || []).map((s) => (s as { id: string }).id);
    if (studentIds.length === 0) {
      return NextResponse.json({
        defaulters: [],
        count: 0,
        summary: {
          totalDue: 0,
          avgDaysOverdue: 0,
          critical: 0,
          overdue: 0,
          pending: 0,
        },
      });
    }
  }

  // Get only non-paid fees with due > 0
  let query = supabaseAdmin
    .from("student_fees")
    .select(
      "id, student_id, total_amount, paid_amount, due_amount, due_date, status, students!inner(id, school_id, first_name, last_name, admission_number, father_name, parent_phone, parent_email, classes(id, name), sections(id, name)), fee_structures(id, name, term, total_amount), fee_payments(id, amount, payment_method, payment_date, receipt_number, collected_by)"
    )
    .in("status", ["pending", "partial", "overdue"])
    .gt("due_amount", 0)
    .eq("students.school_id", user.schoolId);

  if (studentIds) {
    query = query.in("student_id", studentIds);
  }

  // Sort payments: we'll get all payments per fee and take the most recent in JS
  const { data: defaultersFeesRaw, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch defaulters" },
      { status: 500 }
    );
  }

  const defaultersFees = (defaultersFeesRaw || []) as Array<Record<string, unknown>>;

  // Build enriched defaulters list with computed fields
  const defaulters = defaultersFees
    .map((sf) => {
      const payments = (sf.fee_payments as Array<Record<string, unknown>>) || [];
      payments.sort((a, b) => {
        const pa = (a.payment_date as string) || "";
        const pb = (b.payment_date as string) || "";
        return pb.localeCompare(pa);
      });
      const dueDate = sf.due_date as string | null;
      const daysOverdue =
        dueDate && dueDate < today
          ? Math.floor(
              (new Date(today).getTime() - new Date(dueDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;
      const lastPayment = payments.length > 0 ? payments[0] : null;

      // Severity bucket: >30 days = critical, >7 = overdue, else pending
      let severityBucket: "critical" | "overdue" | "pending";
      if (daysOverdue > 30) severityBucket = "critical";
      else if (daysOverdue > 7) severityBucket = "overdue";
      else severityBucket = "pending";

      const student = toCamelCase(sf.students as Record<string, unknown>) as any;
      if (student) {
        student.class = student.classes;
        student.section = student.sections;
      }
      return {
        id: sf.id,
        student,
        feeStructure: toCamelCase(sf.fee_structures as Record<string, unknown>),
        totalAmount: sf.total_amount,
        paidAmount: sf.paid_amount,
        dueAmount: sf.due_amount,
        dueDate: sf.due_date,
        status: sf.status,
        daysOverdue,
        severityBucket,
        lastPayment: lastPayment
          ? {
              id: lastPayment.id,
              receiptNumber: lastPayment.receipt_number,
              amount: lastPayment.amount,
              paymentDate: lastPayment.payment_date,
            }
          : null,
        remindedAt: null as string | null,
      };
    })
    .filter((d) => {
      if (!severity || severity === "all") return true;
      if (severity === "overdue") return d.daysOverdue > 0;
      if (severity === "critical") return d.severityBucket === "critical";
      return true;
    })
    .sort((a, b) => (b.dueAmount as number) - (a.dueAmount as number));

  return NextResponse.json({
    defaulters,
    count: defaulters.length,
    summary: {
      totalDue: defaulters.reduce((s, d) => s + (d.dueAmount as number), 0),
      avgDaysOverdue:
        defaulters.length > 0
          ? Math.round(
              defaulters.reduce((s, d) => s + (d.daysOverdue as number), 0) /
                defaulters.length
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

    const { data: sf, error: sfError } = await supabaseAdmin
      .from("student_fees")
      .select(
        "due_amount, due_date, students!inner(first_name, last_name, parent_phone, parent_email), fee_structures(name)"
      )
      .eq("id", studentFeeId)
      .eq("students.school_id", user.schoolId)
      .maybeSingle();

    if (sfError || !sf) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const student = sf.students as unknown as Record<string, unknown>;
    const feeStructure = sf.fee_structures as unknown as Record<string, unknown>;
    const studentName = `${student.first_name} ${student.last_name}`;

    const { data: reminderNotice, error: noticeError } = await supabaseAdmin
      .from("notices")
      .insert({
        title: `Fee Reminder — ${studentName} (${feeStructure.name})`,
        content: `Reminder sent via ${method || "sms"}. Outstanding due: ₹${sf.due_amount}. Due date: ${sf.due_date || "—"}. Contact: ${student.parent_phone || student.parent_email || "—"}.`,
        target_audience: "parent",
        target_role: "parent",
        posted_by: user.name,
        date: new Date().toISOString().split("T")[0],
        school_id: user.schoolId,
      })
      .select("id")
      .single();

    if (noticeError || !reminderNotice) {
      return NextResponse.json(
        { error: "Failed to log reminder" },
        { status: 500 }
      );
    }

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
