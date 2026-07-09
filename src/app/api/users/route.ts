import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = [
  "school_admin", "teacher", "student", "parent",
  "accountant", "librarian", "transport_manager", "hr",
];

// GET /api/users — list all profiles in the school (admin only)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only school_admin and super_admin can manage users
  if (user.role !== "school_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role");
  const search = searchParams.get("search")?.trim();

  let query = supabaseAdmin
    .from("profiles")
    .select(`
      id, email, name, role, phone, avatar, status,
      student_id, staff_id, created_at
    `)
    .eq("school_id", schoolId)
    .order("role", { ascending: true })
    .order("name", { ascending: true });

  if (roleFilter) {
    query = query.eq("role", roleFilter);
  }
  if (search) {
    const orClause = [
      `name.ilike.%${search}%`,
      `email.ilike.%${search}%`,
    ].join(",");
    query = query.or(orClause);
  }

  const { data: profilesRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles: any[] = (profilesRaw ?? []) as any[];

  // For each profile, fetch linked student/staff info (in parallel)
  const enriched = await Promise.all(
    profiles.map(async (p) => {
      let linkedInfo: { type: string; name: string; extra?: string } | null = null;
      if (p.student_id) {
        const { data: stu } = await supabaseAdmin
          .from("students")
          .select("first_name, last_name, admission_number, classes(name)")
          .eq("id", p.student_id)
          .maybeSingle();
        if (stu) {
          const classRow = Array.isArray(stu.classes) && stu.classes.length > 0
            ? (stu.classes[0] as any)
            : (stu.classes as any);
          const className = classRow?.name ?? null;
          linkedInfo = {
            type: "student",
            name: `${stu.first_name} ${stu.last_name}`,
            extra: `${stu.admission_number} · ${className || "—"}`,
          };
        }
      } else if (p.staff_id) {
        const { data: stf } = await supabaseAdmin
          .from("staff")
          .select("first_name, last_name, employee_id, designation")
          .eq("id", p.staff_id)
          .maybeSingle();
        if (stf) {
          linkedInfo = {
            type: "staff",
            name: `${stf.first_name} ${stf.last_name}`,
            extra: `${stf.employee_id} · ${stf.designation || "—"}`,
          };
        }
      }
      return { ...toCamelCase(p), linkedInfo };
    })
  );

  return NextResponse.json({ users: enriched });
}

// POST /api/users — create a new user profile (admin manually creates account)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "school_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { email, password, name, role, phone, studentId, staffId, status } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: "Email, password, name, and role are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("Create auth user error:", authError);
      return NextResponse.json({ error: authError?.message || "Failed to create auth user" }, { status: 500 });
    }

    // 2. The trigger `on_auth_user_created` in schema.sql will automatically insert a row in `profiles`.
    // We update that row with the additional metadata.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        name: name.trim(),
        role,
        phone: phone?.trim() || null,
        student_id: studentId || null,
        staff_id: staffId || null,
        status: status || "active",
        school_id: user.schoolId,
      })
      .eq("id", authData.user.id)
      .select(`
        id, email, name, role, phone, status,
        student_id, staff_id, created_at
      `)
      .single();

    if (profileError || !profile) {
      // Fallback: If update failed (e.g. if the trigger didn't fire or ran into issues), try to insert manually
      const { data: insertedProfile, error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authData.user.id,
          email: normalizedEmail,
          name: name.trim(),
          role,
          phone: phone?.trim() || null,
          student_id: studentId || null,
          staff_id: staffId || null,
          status: status || "active",
          school_id: user.schoolId,
        })
        .select(`
          id, email, name, role, phone, status,
          student_id, staff_id, created_at
        `)
        .single();

      if (insertError || !insertedProfile) {
        console.error("Create profile error:", profileError || insertError);
        return NextResponse.json({ error: "Auth user created but profile setup failed" }, { status: 500 });
      }

      return NextResponse.json({ user: toCamelCase(insertedProfile) }, { status: 201 });
    }

    return NextResponse.json({ user: toCamelCase(profile) }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
