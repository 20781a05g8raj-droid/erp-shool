import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canEditTimetable } from "@/lib/permissions";

const SLOT_SELECT =
  "id, class_id, section_id, day, period, subject_id, staff_id, start_time, end_time, " +
  "subject:subjects(id, name, code), " +
  "staff:staff(id, first_name, last_name, employee_id), " +
  "class:classes(id, name), " +
  "section:sections(id, name)";

// GET /api/timetable — fetch slots.
//   ?classId=&sectionId=  -> weekly grid for that class+section
//   ?staffId=             -> all slots where that teacher teaches (across classes)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classIdParam = searchParams.get("classId");
  const sectionIdParam = searchParams.get("sectionId");
  const staffId = searchParams.get("staffId");
  const studentIdParam = searchParams.get("studentId");

  // Resolve studentId -> classId + sectionId (used by student/parent view).
  let classId: string | null | undefined = classIdParam;
  let sectionId: string | null | undefined = sectionIdParam;
  if (studentIdParam) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("class_id, section_id")
      .eq("id", studentIdParam)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (!student) {
      return NextResponse.json({ slots: [] });
    }
    classId = student.class_id as string | null;
    sectionId = student.section_id as string | null;
  }

  // For student/parent role, force scope to their own class+section.
  if (user.role === "student" || user.role === "parent") {
    const studentFilter = user.studentId
      ? supabaseAdmin
          .from("students")
          .select("class_id, section_id")
          .eq("id", user.studentId)
          .eq("school_id", user.schoolId)
          .maybeSingle()
      : Promise.resolve({ data: null });
    const { data: me } = await studentFilter;
    if (me) {
      classId = (me as { class_id?: string | null }).class_id ?? null;
      sectionId = (me as { section_id?: string | null }).section_id ?? null;
    } else {
      return NextResponse.json({ slots: [] });
    }
  }

  // Establish school scope: when we have a specific classId, verify it belongs
  // to the school; otherwise (staff-only view) enumerate school class IDs.
  let scopedClassIds: string[] | null = null;
  if (classId) {
    const { data: cls } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (!cls) {
      return NextResponse.json({ slots: [] });
    }
    scopedClassIds = [cls.id];
  } else {
    const { data: schoolClasses } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("school_id", user.schoolId);
    scopedClassIds = ((schoolClasses || []) as Array<{ id: string }>).map(
      (c) => c.id
    );
    if (scopedClassIds.length === 0) {
      return NextResponse.json({ slots: [] });
    }
  }

  let query = supabaseAdmin
    .from("timetable_slots")
    .select(SLOT_SELECT)
    .in("class_id", scopedClassIds);

  if (staffId) {
    query = query.eq("staff_id", staffId);
  } else {
    if (classId) query = query.eq("class_id", classId);
    if (sectionId) query = query.eq("section_id", sectionId);
  }

  query = query
    .order("day", { ascending: true })
    .order("period", { ascending: true });

  const { data: slots, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch timetable" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    slots: (slots || []).map((s) =>
      toCamelCase(s as unknown as Record<string, unknown>)
    ),
  });
}

// POST /api/timetable — bulk save slots for a class+section+day.
// Body: { classId, sectionId, day, slots: [{ period, subjectId?, staffId?, startTime, endTime }] }
// Replaces all existing slots for that class+section+day with the provided set.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only HR, school_admin, super_admin can edit timetable
  if (!canEditTimetable(user.role)) {
    return NextResponse.json(
      { error: "You don't have permission to edit the timetable" },
      { status: 403 }
    );
  }

  let body: {
    classId?: string;
    sectionId?: string;
    day?: string;
    slots?: Array<{
      period: number;
      subjectId?: string | null;
      staffId?: string | null;
      startTime: string;
      endTime: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const sectionId = (body.sectionId ?? "").toString().trim();
  const day = (body.day ?? "").toString().trim();
  const slots = Array.isArray(body.slots) ? body.slots : [];

  if (!classId || !sectionId || !day) {
    return NextResponse.json(
      { error: "classId, sectionId and day are required" },
      { status: 400 }
    );
  }

  const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  if (!VALID_DAYS.includes(day)) {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }

  // Validate class + section belong to school.
  const [{ data: cls }, { data: section }] = await Promise.all([
    supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", user.schoolId)
      .maybeSingle(),
    supabaseAdmin
      .from("sections")
      .select("id")
      .eq("id", sectionId)
      .eq("class_id", classId)
      .maybeSingle(),
  ]);
  if (!cls || !section) {
    return NextResponse.json(
      { error: "Class or section not found" },
      { status: 404 }
    );
  }

  // Replace all existing slots for this class+section+day, then create new ones.
  const { error: deleteErr } = await supabaseAdmin
    .from("timetable_slots")
    .delete()
    .eq("class_id", classId)
    .eq("section_id", sectionId)
    .eq("day", day);
  if (deleteErr) {
    return NextResponse.json(
      { error: "Failed to clear existing slots" },
      { status: 500 }
    );
  }

  if (slots.length > 0) {
    const insertRows = slots.map((s) => ({
      class_id: classId,
      section_id: sectionId,
      day,
      period: s.period,
      subject_id: s.subjectId || null,
      staff_id: s.staffId || null,
      start_time: s.startTime,
      end_time: s.endTime,
    }));
    const { error: insertErr } = await supabaseAdmin
      .from("timetable_slots")
      .insert(insertRows);
    if (insertErr) {
      return NextResponse.json(
        { error: "Failed to save timetable slots" },
        { status: 500 }
      );
    }
  }

  // Return the new set of slots for this day, fully populated.
  const { data: created, error: fetchErr } = await supabaseAdmin
    .from("timetable_slots")
    .select(
      "id, class_id, section_id, day, period, subject_id, staff_id, start_time, end_time, " +
        "subject:subjects(id, name, code), " +
        "staff:staff(id, first_name, last_name, employee_id)"
    )
    .eq("class_id", classId)
    .eq("section_id", sectionId)
    .eq("day", day)
    .order("period", { ascending: true });
  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to fetch saved slots" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    slots: (created || []).map((s) =>
      toCamelCase(s as unknown as Record<string, unknown>)
    ),
  });
}
