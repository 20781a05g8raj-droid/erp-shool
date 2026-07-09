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

  for (const sf of allFees) {
    const correct = computeStatus(sf.paid_amount, sf.total_amount, sf.due_date);
    if (correct !== sf.status) {
      await supabaseAdmin
        .from("student_fees")
        .update({ status: correct })
        .eq("id", sf.id);
    }
  }

  // Find matching student IDs first (for search/class scoping)
  let matchingStudentIds: string[] | null = null;
  if (search || (classId && classId !== "all") || scopedStudentId) {
    let studentQuery = supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, admission_number")
      .eq("school_id", user.schoolId);
    if (scopedStudentId) studentQuery = studentQuery.eq("id", scopedStudentId);
    if (classId && classId !== "all")
      studentQuery = studentQuery.eq("class_id", classId);
    if (search) {
      studentQuery = studentQuery.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`
      );
    }
    const { data: matchingStudents } = await studentQuery;
    matchingStudentIds = (matchingStudents || []).map(
      (s) => (s as { id: string }).id
    );
    if (matchingStudentIds.length === 0) {
      return NextResponse.json({
        ledger: [],
        count: 0,
        summary: { totalExpected: 0, totalPaid: 0, totalDue: 0 },
      });
    }
  }

  let query = supabaseAdmin
    .from("student_fees")
    .select(
      "*, students(id, first_name, last_name, admission_number, father_name, parent_phone, parent_email, classes(id, name), sections(id, name)), fee_structures(id, name, term, total_amount), fee_payments(id, amount, payment_method, payment_date, receipt_number, transaction_id, collected_by, remarks)"
    )
    .order("created_at", { ascending: false });

  if (matchingStudentIds) {
    query = query.in("student_id", matchingStudentIds);
  } else {
    // Scope by school via the embedded student relation
    query = supabaseAdmin
      .from("student_fees")
      .select(
        "*, students!inner(id, school_id, first_name, last_name, admission_number, father_name, parent_phone, parent_email, classes(id, name), sections(id, name)), fee_structures(id, name, term, total_amount), fee_payments(id, amount, payment_method, payment_date, receipt_number, transaction_id, collected_by, remarks)"
      )
      .eq("students.school_id", user.schoolId)
      .order("created_at", { ascending: false });
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: studentFeesRaw, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch ledger" }, { status: 500 });
  }

  // Sort by student name (firstName asc, then lastName asc)
  const studentFees = ((studentFeesRaw || []) as Array<Record<string, unknown>>).sort(
    (a, b) => {
      const sa = (a.students as Record<string, unknown>) || {};
      const sb = (b.students as Record<string, unknown>) || {};
      const fa = (sa.first_name as string) || "";
      const fb = (sb.first_name as string) || "";
      if (fa !== fb) return fa.localeCompare(fb);
      const la = (sa.last_name as string) || "";
      const lb = (sb.last_name as string) || "";
      return la.localeCompare(lb);
    }
  );

  const today = new Date().toISOString().split("T")[0];

  const ledger = studentFees.map((sf) => {
    const payments = (sf.fee_payments as Array<Record<string, unknown>>) || [];
    // Sort payments desc by payment_date
    payments.sort((a, b) => {
      const pa = (a.payment_date as string) || "";
      const pb = (b.payment_date as string) || "";
      return pb.localeCompare(pa);
    });
    const lastPayment = payments.length > 0 ? payments[0] : null;
    const dueDate = sf.due_date as string | null;
    const daysOverdue =
      dueDate &&
      (sf.status as string) !== "paid" &&
      dueDate < today
        ? Math.floor(
            (new Date(today).getTime() - new Date(dueDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
    const student = toCamelCase(sf.students as Record<string, unknown>) as any;
    if (student) {
      student.class = student.classes;
      student.section = student.sections;
    }
    return {
      id: sf.id,
      studentId: sf.student_id,
      student,
      feeStructure: toCamelCase(sf.fee_structures as Record<string, unknown>),
      totalAmount: sf.total_amount,
      paidAmount: sf.paid_amount,
      dueAmount: sf.due_amount,
      dueDate: sf.due_date,
      status: sf.status,
      daysOverdue,
      lastPayment: lastPayment
        ? toCamelCase(lastPayment)
        : null,
      payments: toCamelCase(payments as Record<string, unknown>[]),
    };
  });

  return NextResponse.json({
    ledger,
    count: ledger.length,
    summary: {
      totalExpected: ledger.reduce((s, l) => s + (l.totalAmount as number), 0),
      totalPaid: ledger.reduce((s, l) => s + (l.paidAmount as number), 0),
      totalDue: ledger.reduce((s, l) => s + (l.dueAmount as number), 0),
    },
  });
}
