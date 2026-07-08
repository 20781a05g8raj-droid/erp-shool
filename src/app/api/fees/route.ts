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

// GET — list student fees with filters
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.toLowerCase();

  // Role-based scoping: student/parent only see their own
  const scopedStudentId =
    user.role === "student" || user.role === "parent"
      ? user.studentId
      : studentId;

  // First, refresh overdue statuses based on due date for the school's student fees
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
  if (search || classId) {
    let studentQuery = supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", user.schoolId);
    if (classId) studentQuery = studentQuery.eq("class_id", classId);
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
      return NextResponse.json({ studentFees: [] });
    }
  }

  let query = supabaseAdmin
    .from("student_fees")
    .select(
      "*, students!inner(id, first_name, last_name, admission_number, school_id, classes(id, name)), fee_structures(*), fee_payments(*)"
    )
    .order("created_at", { ascending: false });

  // Apply student filter (scoped OR by matching IDs)
  if (scopedStudentId) {
    query = query.eq("student_id", scopedStudentId);
  } else if (matchingStudentIds) {
    query = query.in("student_id", matchingStudentIds);
  }
  // Always scope by school via the embedded student relation
  query = query.eq("students.school_id", user.schoolId);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  // Order payments by date desc — need a separate sort since Supabase doesn't support
  // per-relation ordering inline. We'll sort in JS below.
  const { data: studentFeesRaw, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch student fees" },
      { status: 500 }
    );
  }

  // Sort payments desc by payment_date for each fee
  const sorted = (studentFeesRaw || []).map((sf: Record<string, unknown>) => {
    const payments = (sf.fee_payments as Array<Record<string, unknown>>) || [];
    payments.sort((a, b) => {
      const pa = (a.payment_date as string) || "";
      const pb = (b.payment_date as string) || "";
      return pb.localeCompare(pa);
    });
    sf.fee_payments = payments;
    return sf;
  });

  return NextResponse.json({
    studentFees: toCamelCase(sorted as Record<string, unknown>[]),
  });
}

// POST — assign fee structure to a student or all students in a class
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { feeStructureId, studentId, classId, scope } = body as {
      feeStructureId?: string;
      studentId?: string;
      classId?: string;
      scope?: "single" | "class";
    };

    if (!feeStructureId) {
      return NextResponse.json(
        { error: "feeStructureId is required" },
        { status: 400 }
      );
    }

    const { data: feeStructure, error: fsError } = await supabaseAdmin
      .from("fee_structures")
      .select("*")
      .eq("id", feeStructureId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (fsError || !feeStructure) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    let targetStudentIds: string[] = [];
    if (scope === "class" || (!scope && classId)) {
      if (!classId) {
        return NextResponse.json(
          { error: "classId is required for class scope assignment" },
          { status: 400 }
        );
      }
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("school_id", user.schoolId)
        .eq("class_id", classId)
        .eq("status", "active");
      targetStudentIds = (students || []).map(
        (s) => (s as { id: string }).id
      );
    } else {
      if (!studentId) {
        return NextResponse.json(
          { error: "studentId is required for single assignment" },
          { status: 400 }
        );
      }
      targetStudentIds = [studentId];
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json(
        { error: "No active students found for assignment" },
        { status: 400 }
      );
    }

    // Avoid duplicates: skip students who already have a StudentFee for this structure
    const { data: existing } = await supabaseAdmin
      .from("student_fees")
      .select("student_id")
      .eq("fee_structure_id", feeStructureId)
      .in("student_id", targetStudentIds);

    const existingSet = new Set(
      (existing || []).map((e) => (e as { student_id: string }).student_id)
    );
    const newIds = targetStudentIds.filter((id) => !existingSet.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({
        assigned: 0,
        skipped: targetStudentIds.length,
        message: "All students already have this fee assigned.",
      });
    }

    const rows = newIds.map((sid) => ({
      student_id: sid,
      fee_structure_id: feeStructureId,
      total_amount: feeStructure.total_amount,
      paid_amount: 0,
      due_amount: feeStructure.total_amount,
      due_date: feeStructure.due_date,
      status: "pending",
    }));

    const { error: insertError } = await supabaseAdmin
      .from("student_fees")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to assign fee structure" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      assigned: newIds.length,
      skipped: existingSet.size,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to assign fee structure" },
      { status: 500 }
    );
  }
}
