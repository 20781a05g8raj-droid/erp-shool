import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types";

// GET /api/notices — list notices scoped to the user (schoolId + audience filter)
// Query: ?audience=all|class|role (optional filter)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const audienceFilter = searchParams.get("audience");

  // Determine the user's classId (for students/parents we look up the student record)
  let userClassId: string | null = null;
  if ((user.role === "student" || user.role === "parent") && user.studentId) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("class_id")
      .eq("id", user.studentId)
      .maybeSingle();
    userClassId =
      (student as { class_id: string | null } | null)?.class_id ?? null;
  }

  let query = supabaseAdmin
    .from("notices")
    .select("*")
    .eq("school_id", schoolId);

  if (audienceFilter) {
    query = query.eq("target_audience", audienceFilter);
  }

  // Role-based audience scoping: non-admins only see notices targeting them.
  const adminRoles: Role[] = ["super_admin", "school_admin"];
  if (!adminRoles.includes(user.role)) {
    // Build OR filter: target_audience = 'all' OR
    // (target_audience = 'class' AND target_class_id = userClassId) OR
    // (target_audience = 'role' AND target_role = user.role)
    const orParts = [`target_audience.eq.all`];
    if (userClassId) {
      orParts.push(
        `and(target_audience.eq.class,target_class_id.eq.${userClassId})`
      );
    }
    orParts.push(`and(target_audience.eq.role,target_role.eq.${user.role})`);
    query = query.or(orParts.join(","));
  }

  query = query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: noticesRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch notices" }, { status: 500 });
  }

  const notices = (noticesRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({
    notices: notices.map((n) => toCamelCase(n)),
  });
}

// POST /api/notices — create a new notice
// Body: { title, content, targetAudience (all|class|role), targetClassId?, targetRole?, date }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins/teachers can post notices
  const allowedRoles: Role[] = ["super_admin", "school_admin", "teacher"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const audience = body.targetAudience || "all";
  if (!["all", "class", "role"].includes(audience)) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  // Validate targetClassId belongs to school when audience=class
  if (audience === "class") {
    if (!body.targetClassId) {
      return NextResponse.json(
        { error: "Class is required for class-targeted notice" },
        { status: 400 }
      );
    }
    const { data: cls, error: clsError } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", body.targetClassId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (clsError || !cls) {
      return NextResponse.json({ error: "Invalid class" }, { status: 400 });
    }
  }

  const date = body.date || new Date().toISOString().split("T")[0];

  try {
    const insertRow = {
      title: body.title.trim(),
      content: body.content.trim(),
      target_audience: audience,
      target_class_id: audience === "class" ? body.targetClassId : null,
      target_role: audience === "role" ? body.targetRole || null : null,
      posted_by: user.name,
      date,
      school_id: user.schoolId,
    };

    const { data: noticeRaw, error: insertError } = await supabaseAdmin
      .from("notices")
      .insert(insertRow)
      .select("*")
      .single();

    if (insertError || !noticeRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create notice" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(noticeRaw as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create notice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
