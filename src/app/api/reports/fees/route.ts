import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const { data: classesRaw } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("order", { ascending: true });

  const classes = (classesRaw || []) as Array<{ id: string; name: string }>;

  // Get all student IDs in the school (for filtering student_fees)
  const { data: schoolStudentsRaw } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, admission_number, class_id, father_name, parent_phone, class:classes(name)")
    .eq("school_id", schoolId);

  const schoolStudents = (schoolStudentsRaw || []) as unknown as Array<{
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_id: string | null;
    father_name: string | null;
    parent_phone: string | null;
    class: { name: string } | null;
  }>;

  const studentMap = new Map<string, (typeof schoolStudents)[number]>();
  for (const s of schoolStudents) {
    studentMap.set(s.id, s);
  }

  // Get all student fees for the school's students
  let studentFeesRaw: Array<Record<string, unknown>> = [];
  if (schoolStudents.length > 0) {
    const { data: sfRaw, error: sfError } = await supabaseAdmin
      .from("student_fees")
      .select("*, fee_structures(name, term)")
      .in(
        "student_id",
        schoolStudents.map((s) => s.id)
      );
    if (sfError) {
      return NextResponse.json({ error: "Failed to fetch fees" }, { status: 500 });
    }
    studentFeesRaw = (sfRaw || []) as Array<Record<string, unknown>>;
  }

  // Get all payments for monthly trend (last 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startPrefix = `${sixMonthsAgo.getFullYear()}-${String(
    sixMonthsAgo.getMonth() + 1
  ).padStart(2, "0")}`;

  // Fetch all student_fee IDs (we already have them) — then fetch payments for them
  const studentFeeIds = studentFeesRaw.map((sf) => sf.id as string);
  let payments: Array<{ amount: number; payment_date: string }> = [];
  if (studentFeeIds.length > 0) {
    const { data: payRaw } = await supabaseAdmin
      .from("fee_payments")
      .select("amount, payment_date")
      .in("student_fee_id", studentFeeIds)
      .gte("payment_date", startPrefix);
    payments = (payRaw || []) as Array<{
      amount: number;
      payment_date: string;
    }>;
  }

  // Enrich student fees with student info
  type EnrichedSF = Record<string, unknown> & {
    student?: {
      first_name: string;
      last_name: string;
      admission_number: string;
      class_id: string | null;
      father_name: string | null;
      parent_phone: string | null;
      class: { name: string } | null;
    };
  };
  const studentFees: EnrichedSF[] = studentFeesRaw.map((sf) => {
    const student = studentMap.get(sf.student_id as string);
    return {
      ...sf,
      student,
    };
  });

  // Overall totals
  const totalExpected = studentFees.reduce(
    (s, f) => s + Number(f.total_amount),
    0
  );
  const totalCollected = studentFees.reduce(
    (s, f) => s + Number(f.paid_amount),
    0
  );
  const totalDue = studentFees.reduce((s, f) => s + Number(f.due_amount), 0);
  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // By class
  const classMap: Record<
    string,
    { name: string; expected: number; collected: number; due: number }
  > = {};
  for (const cls of classes) {
    classMap[cls.id] = { name: cls.name, expected: 0, collected: 0, due: 0 };
  }
  for (const sf of studentFees) {
    const cid = sf.student?.class_id;
    if (cid && classMap[cid]) {
      classMap[cid].expected += Number(sf.total_amount);
      classMap[cid].collected += Number(sf.paid_amount);
      classMap[cid].due += Number(sf.due_amount);
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
    const status = sf.status as string;
    if (status in statusBreakdown) {
      statusBreakdown[status]++;
    }
  }

  // Monthly trend (last 6 months)
  const monthlyTrend: { month: string; collected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const monthPayments = payments.filter((p) =>
      p.payment_date?.startsWith(prefix)
    );
    const collected = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
    monthlyTrend.push({ month: monthName, collected: Math.round(collected) });
  }

  // Defaulters: students with overdue or pending status (dueAmount > 0)
  const defaulters = studentFees
    .filter(
      (sf) => sf.status !== "paid" && Number(sf.due_amount) > 0
    )
    .map((sf) => {
      const student = sf.student;
      const feeStructure = sf.fee_structures as {
        name: string;
        term: string;
      } | null;
      return {
        id: sf.id,
        studentName: student
          ? `${student.first_name} ${student.last_name}`
          : "—",
        admissionNumber: student?.admission_number || "—",
        className: student?.class?.name || "—",
        fatherName: student?.father_name || "—",
        parentPhone: student?.parent_phone || "—",
        feeStructure: feeStructure?.name || "—",
        term: feeStructure?.term || "—",
        dueDate: sf.due_date,
        dueAmount: Math.round(Number(sf.due_amount)),
        status: sf.status,
      };
    })
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
