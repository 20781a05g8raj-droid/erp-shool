import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/students/[id] — single student with class/section/attendance/fees
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [
    { data: studentRaw },
    { data: attendanceRaw },
    { data: studentFeesRaw },
    { data: examResultsRaw },
    { data: bookIssuesRaw },
    { data: certificatesRaw },
  ] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("*, class:classes(id, name), section:sections(id, name)")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("student_attendance")
      .select("id, date, status")
      .eq("student_id", id)
      .order("date", { ascending: false })
      .limit(60),
    supabaseAdmin
      .from("student_fees")
      .select("*, feeStructure:fee_structures(id, name, term), payments:fee_payments(id, amount, payment_date, payment_method, receipt_number)")
      .eq("student_id", id),
    supabaseAdmin
      .from("exam_results")
      .select("*, subject:subjects(id, name), exam:exams(id, name)")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("book_issues")
      .select("*, book:books(id, title)")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("certificates")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!studentRaw) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const student: any = studentRaw;

  // Order payments inside each student_fee by created_at desc (Supabase nested relation ordering is awkward)
  const studentFees = (studentFeesRaw ?? []).map((sf: any) => ({
    ...sf,
    payments: (sf.payments ?? []).slice().sort((a: any, b: any) => {
      const ta = a.created_at ? String(a.created_at) : "";
      const tb = b.created_at ? String(b.created_at) : "";
      return tb.localeCompare(ta);
    }),
  }));

  // Build response shape matching Prisma's camelCase output
  const studentResponse = {
    ...toCamelCase(studentRaw),
    attendance: (attendanceRaw ?? []).map((a) => toCamelCase(a)),
    studentFees: studentFees.map((sf) => toCamelCase(sf)),
    examResults: (examResultsRaw ?? []).map((r) => toCamelCase(r)),
    bookIssues: (bookIssuesRaw ?? []).map((b) => toCamelCase(b)),
    certificates: (certificatesRaw ?? []).map((c) => toCamelCase(c)),
  };

  // Computed attendance + fee stats
  const totalAttendance = (attendanceRaw ?? []).length;
  const presentCount = (attendanceRaw ?? []).filter(
    (a: any) => a.status === "present" || a.status === "late"
  ).length;
  const attendanceRate =
    totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const feesTotal = studentFees.reduce((s: number, f: any) => s + Number(f.total_amount ?? 0), 0);
  const feesPaid = studentFees.reduce((s: number, f: any) => s + Number(f.paid_amount ?? 0), 0);
  const feesDue = studentFees.reduce((s: number, f: any) => s + Number(f.due_amount ?? 0), 0);

  return NextResponse.json({
    ...studentResponse,
    stats: {
      attendanceRate,
      totalAttendance,
      presentCount,
      feesTotal,
      feesPaid,
      feesDue,
    },
  });
}

// PUT /api/students/[id] — update student
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageStudents(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage students" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("students")
    .select("id, admission_number")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const body = await req.json();

  if (!body.firstName || typeof body.firstName !== "string" || !body.firstName.trim()) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (!body.lastName || typeof body.lastName !== "string" || !body.lastName.trim()) {
    return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  }

  // If admissionNumber changed, ensure uniqueness
  const newAdmission = (body.admissionNumber || "").trim();
  if (newAdmission && newAdmission !== existing.admission_number) {
    const { data: conflict } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("admission_number", newAdmission)
      .neq("id", id)
      .limit(1)
      .maybeSingle();
    if (conflict) {
      return NextResponse.json(
        { error: "Admission number already exists" },
        { status: 400 }
      );
    }
  }

  try {
    const updateData = {
      admission_number: newAdmission || existing.admission_number,
      roll_number: body.rollNumber?.trim() || null,
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      dob: body.dob || null,
      gender: body.gender || null,
      blood_group: body.bloodGroup || null,
      address: body.address?.trim() || null,
      photo: body.photo?.trim() || null,
      class_id: body.classId || null,
      section_id: body.sectionId || null,
      status: body.status || "active",
      father_name: body.fatherName?.trim() || null,
      mother_name: body.motherName?.trim() || null,
      parent_phone: body.parentPhone?.trim() || null,
      parent_email: body.parentEmail?.trim() || null,
      admission_date: body.admissionDate || null,
    };

    const { data, error } = await supabaseAdmin
      .from("students")
      .update(updateData)
      .eq("id", id)
      .select("*, class:classes(id, name), section:sections(id, name)")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to update student" }, { status: 500 });
    }
    return NextResponse.json(toCamelCase(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/students/[id] — remove student (cascade handled by FK ON DELETE CASCADE)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageStudents(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage students" }, { status: 403 });
  }

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    // Clean up dependent records that don't cascade automatically
    // (student_fees and student_transport have ON DELETE CASCADE in Supabase schema,
    //  but we mirror the original Prisma behavior explicitly to be safe.)
    await supabaseAdmin.from("student_fees").delete().eq("student_id", id);
    await supabaseAdmin.from("student_transport").delete().eq("student_id", id);
    const { error } = await supabaseAdmin.from("students").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
