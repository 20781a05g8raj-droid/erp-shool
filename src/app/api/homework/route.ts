import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

const HOMEWORK_SELECT =
  "*, class:classes(id, name), section:sections(id, name), subject:subjects(id, name, code), staff:staff(id, first_name, last_name, employee_id)";

// GET /api/homework — list homework.
//   ?classId=            -> all homework for that class
//   ?studentId=          -> homework for the student's class (auto-resolves classId)
//   ?staffId=            -> homework posted by that teacher
//   (no params)          -> all homework in the school
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const studentId = searchParams.get("studentId");
  const staffId = searchParams.get("staffId");

  let effectiveClassId = classId;
  if (studentId) {
    const { data: studentScope } = await supabaseAdmin
      .from("students")
      .select("id, class_id")
      .eq("id", studentId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (!studentScope) {
      return NextResponse.json({ homework: [] });
    }
    effectiveClassId =
      (studentScope as { id: string; class_id: string | null }).class_id ?? null;
  }

  // Role-based scoping: students/parents only see homework for their own class.
  let scopeClassId: string | undefined | null = effectiveClassId ?? undefined;
  if (user.role === "student" || user.role === "parent") {
    if (user.studentId) {
      const { data: me } = await supabaseAdmin
        .from("students")
        .select("id, class_id")
        .eq("id", user.studentId)
        .eq("school_id", user.schoolId)
        .maybeSingle();
      if (me) {
        scopeClassId = (me as { class_id: string | null }).class_id ?? undefined;
      } else {
        scopeClassId = "__none__"; // no student record -> no homework
      }
    } else {
      scopeClassId = "__none__";
    }
  }

  let query = supabaseAdmin
    .from("homework")
    .select(HOMEWORK_SELECT)
    .eq("school_id", user.schoolId);

  if (scopeClassId) {
    query = query.eq("class_id", scopeClassId);
  }
  if (staffId) {
    query = query.eq("staff_id", staffId);
  }

  query = query.order("due_date", { ascending: false });

  const { data: homeworkRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch homework" }, { status: 500 });
  }

  const homework = (homeworkRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({
    homework: homework.map((h) => {
      const camel = toCamelCase(h) as Record<string, unknown>;
      return {
        id: camel.id,
        title: camel.title,
        description: camel.description,
        dueDate: camel.dueDate,
        attachment: camel.attachment,
        classId: camel.classId,
        sectionId: camel.sectionId,
        subjectId: camel.subjectId,
        staffId: camel.staffId,
        createdAt: camel.createdAt,
        class: camel.class,
        section: camel.section,
        subject: camel.subject,
        staff: camel.staff,
      };
    }),
  });
}

// POST /api/homework — create homework.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers / admins can post homework.
  if (!["teacher", "school_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string;
    classId?: string;
    sectionId?: string | null;
    subjectId?: string | null;
    staffId?: string | null;
    dueDate?: string;
    attachment?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").toString().trim();
  const classId = (body.classId ?? "").toString().trim();
  const dueDate = (body.dueDate ?? "").toString().trim();
  if (!title || !classId || !dueDate) {
    return NextResponse.json(
      { error: "title, classId and dueDate are required" },
      { status: 400 }
    );
  }

  // Validate class belongs to school.
  const { data: cls, error: clsError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (clsError || !cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Validate section (if provided) belongs to the class.
  if (body.sectionId) {
    const { data: sec } = await supabaseAdmin
      .from("sections")
      .select("id")
      .eq("id", body.sectionId)
      .eq("class_id", classId)
      .maybeSingle();
    if (!sec) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
  }

  // Default staffId = current user's staffId (if they're a teacher).
  const staffId =
    body.staffId ||
    (user.role === "teacher" && user.staffId ? user.staffId : null);

  const insertRow = {
    title,
    description: body.description?.toString() ?? null,
    class_id: classId,
    section_id: body.sectionId || null,
    subject_id: body.subjectId || null,
    staff_id: staffId || null,
    due_date: dueDate,
    attachment: body.attachment || null,
    school_id: user.schoolId,
  };

  const { data: hwRaw, error: insertError } = await supabaseAdmin
    .from("homework")
    .insert(insertRow)
    .select(HOMEWORK_SELECT)
    .single();

  if (insertError || !hwRaw) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to create homework" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { homework: toCamelCase(hwRaw as Record<string, unknown>) },
    { status: 201 }
  );
}
