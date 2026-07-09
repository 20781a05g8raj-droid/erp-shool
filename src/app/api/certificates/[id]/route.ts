import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/certificates/[id] — single certificate with full student data for printing
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const CERT_DETAIL_SELECT =
    "*, student:students(id, first_name, last_name, admission_number, roll_number, dob, gender, blood_group, address, father_name, mother_name, parent_phone, admission_date, class_id, class:classes(id, name), section:sections(id, name)), school:schools(id, name, address, phone, email, logo)";

  const { data: certRaw, error } = await supabaseAdmin
    .from("certificates")
    .select(CERT_DETAIL_SELECT)
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (error || !certRaw) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const certificate = certRaw as Record<string, unknown>;

  // Role-based scoping for student/parent
  if (user.role === "student" || user.role === "parent") {
    if (user.studentId !== (certificate.student_id as string)) {
      return NextResponse.json(
        { error: "Forbidden: you can only view your own certificates" },
        { status: 403 }
      );
    }
  }

  return NextResponse.json(toCamelCase(certificate));
}

// DELETE /api/certificates/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("certificates")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("certificates")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
