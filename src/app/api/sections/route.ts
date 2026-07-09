import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// POST /api/sections — create a section under a class. Optionally assigns a
// class teacher at creation.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; name?: string; classTeacherId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const name = (body.name ?? "").toString().trim();
  if (!classId || !name) {
    return NextResponse.json(
      { error: "classId and name are required" },
      { status: 400 }
    );
  }

  // Verify class belongs to this school.
  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Validate class teacher belongs to this school (if provided).
  let classTeacherId: string | null = null;
  if (body.classTeacherId) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("id", body.classTeacherId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (staff) classTeacherId = staff.id;
  }

  const { data: section, error } = await supabaseAdmin
    .from("sections")
    .insert({
      name,
      class_id: classId,
      class_teacher_id: classTeacherId,
    })
    .select(
      "id, name, class_id, class_teacher_id, created_at, class_teacher:staff!sections_class_teacher_fk(id, first_name, last_name, employee_id)"
    )
    .single();

  if (error || !section) {
    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { section: toCamelCase(section as unknown as Record<string, unknown>) },
    { status: 201 }
  );
}
