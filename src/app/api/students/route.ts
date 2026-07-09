import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/permissions";

// GET /api/students — list with optional ?classId=&search=&status= filters
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("students")
    .select("*, class:classes(id, name), section:sections(id, name)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (classId) {
    query = query.eq("class_id", classId);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (search) {
    // Use OR across multiple text columns (case-insensitive ilike)
    const orClause = [
      `first_name.ilike.%${search}%`,
      `last_name.ilike.%${search}%`,
      `admission_number.ilike.%${search}%`,
      `email.ilike.%${search}%`,
      `phone.ilike.%${search}%`,
      `father_name.ilike.%${search}%`,
    ].join(",");
    query = query.or(orClause);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const students = (data ?? []).map((s) => toCamelCase(s));
  return NextResponse.json(students);
}

// POST /api/students — create new student (auto-generate admission number if missing)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only accountant, school_admin, super_admin can add students
  if (!canManageStudents(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage students" }, { status: 403 });
  }

  const schoolId = user.schoolId;
  const body = await req.json();

  // Validate required fields
  if (!body.firstName || typeof body.firstName !== "string" || !body.firstName.trim()) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (!body.lastName || typeof body.lastName !== "string" || !body.lastName.trim()) {
    return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  }

  // Auto-generate admission number if not provided (format: GRW + padded number)
  let admissionNumber = (body.admissionNumber || "").trim();
  if (!admissionNumber) {
    const { data: existing } = await supabaseAdmin
      .from("students")
      .select("admission_number")
      .eq("school_id", schoolId)
      .like("admission_number", "GRW%");

    let maxNum = 0;
    for (const s of existing ?? []) {
      const num = parseInt((s.admission_number || "").replace("GRW", ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    admissionNumber = `GRW${String(maxNum + 1).padStart(4, "0")}`;
  } else {
    // ensure uniqueness within school
    const { data: conflict } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("admission_number", admissionNumber)
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
    const insertData = {
      admission_number: admissionNumber,
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
      school_id: schoolId,
      father_name: body.fatherName?.trim() || null,
      mother_name: body.motherName?.trim() || null,
      parent_phone: body.parentPhone?.trim() || null,
      parent_email: body.parentEmail?.trim() || null,
      admission_date: body.admissionDate || new Date().toISOString().split("T")[0],
    };

    const { data, error } = await supabaseAdmin
      .from("students")
      .insert(insertData)
      .select("*, class:classes(id, name), section:sections(id, name)")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to create student" }, { status: 500 });
    }

    // Auto-assign fee structures if classId is specified
    if (body.classId) {
      try {
        const { data: feeStructures } = await supabaseAdmin
          .from("fee_structures")
          .select("id, total_amount, due_date")
          .eq("class_id", body.classId)
          .eq("school_id", schoolId);

        if (feeStructures && feeStructures.length > 0) {
          const studentFeesInserts = feeStructures.map((fs) => ({
            student_id: data.id,
            fee_structure_id: fs.id,
            total_amount: fs.total_amount || 0,
            paid_amount: 0,
            due_amount: fs.total_amount || 0,
            status: "pending",
            due_date: fs.due_date,
          }));

          await supabaseAdmin
            .from("student_fees")
            .insert(studentFeesInserts);
        }
      } catch (feeErr) {
        console.error("Failed to auto-assign student fees:", feeErr);
        // Do not fail student creation if fee assignment fails
      }
    }

    return NextResponse.json(toCamelCase(data), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
