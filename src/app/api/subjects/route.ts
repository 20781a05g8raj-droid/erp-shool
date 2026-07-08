import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/subjects — list subjects for the school (with optional ?classId= filter)
// When classId is provided, returns only the subjects assigned to that class via ClassSubject
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (classId) {
    // Validate class belongs to school
    const { data: cls } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const { data: classSubjects, error } = await supabaseAdmin
      .from("class_subjects")
      .select("subject:subjects(id, name, code)")
      .eq("class_id", classId)
      .order("name", { referencedTable: "subjects", ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch subjects" },
        { status: 500 }
      );
    }

    const subjects = (classSubjects || [])
      .map((cs) =>
        toCamelCase(cs as unknown as Record<string, unknown>)
      )
      .map((cs) => (cs as { subject?: unknown } | null)?.subject)
      .filter(Boolean);

    return NextResponse.json({ subjects });
  }

  const { data: subjects, error } = await supabaseAdmin
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", user.schoolId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    subjects: (subjects || []).map((s) =>
      toCamelCase(s as unknown as Record<string, unknown>)
    ),
  });
}
