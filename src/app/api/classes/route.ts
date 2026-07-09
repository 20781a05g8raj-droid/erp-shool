import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET — list classes for the current school, including sections (with class
// teacher), subjects (via class_subjects), and student count. Response shape is
// backward-compatible: `{ classes: [{ id, name, order, sections }] }` with
// extra fields added.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    { data: classesRaw, error: classesError },
    { data: studentsRaw },
  ] = await Promise.all([
    supabaseAdmin
      .from("classes")
      .select(`
        id, name, "order",
        sections(id, name, class_teacher_id, class_teacher:staff(id, first_name, last_name, employee_id, designation)),
        class_subjects(id, subject:subjects(id, name, code))
      `)
      .eq("school_id", user.schoolId)
      .order("order", { ascending: true }),
    supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("school_id", user.schoolId)
      .eq("status", "active"),
  ]);

  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  // Group-count students by class_id
  const studentCountByClass: Record<string, number> = {};
  for (const s of studentsRaw ?? []) {
    const cid = (s as any).class_id;
    if (cid) studentCountByClass[cid] = (studentCountByClass[cid] ?? 0) + 1;
  }

  const classes = (classesRaw ?? []).map((c: any) => {
    // Sort sections by name asc
    const sections = (c.sections ?? [])
      .slice()
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
      .map((s: any) => {
        // class_teacher may come back as object (many-to-one) — handle both shapes defensively
        const ctRaw = s.class_teacher;
        const ct: any = Array.isArray(ctRaw)
          ? ctRaw.length > 0
            ? ctRaw[0]
            : null
          : ctRaw;
        return {
          id: s.id,
          name: s.name,
          classTeacherId: s.class_teacher_id,
          classTeacher: ct
            ? {
                id: ct.id,
                firstName: ct.first_name,
                lastName: ct.last_name,
                employeeId: ct.employee_id,
                designation: ct.designation,
              }
            : null,
        };
      });

    // subjects come via class_subjects junction; extract the subject fields
    const subjects = (c.class_subjects ?? [])
      .map((cs: any) => cs.subject)
      .filter(Boolean)
      .map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        code: sub.code,
      }));

    return {
      id: c.id,
      name: c.name,
      order: c.order,
      studentCount: studentCountByClass[c.id] ?? 0,
      sections,
      subjects,
    };
  });

  return NextResponse.json({ classes });
}

// POST — create a new class for the current school.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; order?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim();
  if (!name) {
    return NextResponse.json({ error: "Class name is required" }, { status: 400 });
  }

  const order =
    typeof body.order === "number" && !Number.isNaN(body.order)
      ? body.order
      : 0;

  const { data, error } = await supabaseAdmin
    .from("classes")
    .insert({
      name,
      order,
      school_id: user.schoolId,
    })
    .select("id, name, \"order\"")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create class" }, { status: 500 });
  }

  return NextResponse.json(
    {
      class: {
        id: data.id,
        name: (data as any).name,
        order: (data as any).order,
      },
    },
    { status: 201 }
  );
}
