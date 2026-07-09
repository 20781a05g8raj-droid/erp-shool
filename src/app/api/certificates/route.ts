import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

const CERT_LIST_SELECT =
  "*, student:students(id, first_name, last_name, admission_number, class_id, class:classes(id, name), section:sections(id, name))";

// GET /api/certificates — list with optional ?studentId= filter
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  // Role-based scoping: student/parent only see their own certificates
  const scopedStudentId =
    user.role === "student" || user.role === "parent"
      ? user.studentId
      : studentId;

  let query = supabaseAdmin
    .from("certificates")
    .select(CERT_LIST_SELECT)
    .eq("school_id", user.schoolId)
    .order("created_at", { ascending: false });

  if (scopedStudentId) {
    query = query.eq("student_id", scopedStudentId);
  }

  const { data: certsRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch certificates" }, { status: 500 });
  }

  const certificates = (certsRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({
    certificates: certificates.map((c) => toCamelCase(c)),
  });
}

// POST /api/certificates — create certificate (auto-gen serial number)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { studentId, type, issueDate, issuedBy, content } = body as {
      studentId?: string;
      type?: string;
      issueDate?: string;
      issuedBy?: string;
      content?: string;
    };

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }
    if (!type || !["transfer", "bonafide", "character"].includes(type)) {
      return NextResponse.json(
        { error: "type must be transfer, bonafide, or character" },
        { status: 400 }
      );
    }

    // Validate student belongs to school
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const finalIssueDate = issueDate || new Date().toISOString().split("T")[0];

    // Auto-generate serial number: CERT-{YYYY}-{00001} per school per year
    const year = new Date(finalIssueDate).getFullYear();
    const { data: existingThisYearRaw } = await supabaseAdmin
      .from("certificates")
      .select("serial_number")
      .eq("school_id", user.schoolId)
      .like("serial_number", `CERT-${year}-%`);

    const existingThisYear = (existingThisYearRaw || []) as Array<{
      serial_number: string | null;
    }>;
    let maxNum = 0;
    for (const c of existingThisYear) {
      const num = parseInt(c.serial_number?.split("-")[2] || "0", 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const serialNumber = `CERT-${year}-${String(maxNum + 1).padStart(5, "0")}`;

    const insertRow = {
      student_id: studentId,
      type,
      issue_date: finalIssueDate,
      issued_by: issuedBy || user.name || null,
      content: content || null,
      serial_number: serialNumber,
      school_id: user.schoolId,
    };

    const CERT_DETAIL_SELECT =
      "*, student:students(id, first_name, last_name, admission_number, dob, gender, father_name, mother_name, address, admission_date, class_id, class:classes(id, name), section:sections(id, name))";

    const { data: certRaw, error: insertError } = await supabaseAdmin
      .from("certificates")
      .insert(insertRow)
      .select(CERT_DETAIL_SELECT)
      .single();

    if (insertError || !certRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create certificate" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      toCamelCase(certRaw as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create certificate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
