import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = [
  "school_admin", "teacher", "student", "parent",
  "accountant", "librarian", "transport_manager", "hr",
];

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/users/[id] — single user
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "school_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(`
      id, email, name, role, phone, avatar, status,
      student_id, staff_id, created_at
    `)
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: toCamelCase(profile) });
}

// PUT /api/users/[id] — update user (name, role, phone, status, password reset)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "school_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, role, phone, status, password, studentId, staffId } = body;

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (role && !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (password && password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (role !== undefined) updateData.role = role;
  if (phone !== undefined) updateData.phone = phone?.trim() || null;
  if (status !== undefined) updateData.status = status;
  if (password) updateData.password = `demo:${password}`;
  if (studentId !== undefined) updateData.student_id = studentId || null;
  if (staffId !== undefined) updateData.staff_id = staffId || null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select(`
      id, email, name, role, phone, status,
      student_id, staff_id, created_at
    `)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to update user" }, { status: 500 });
  }

  return NextResponse.json({ user: toCamelCase(data) });
}

// DELETE /api/users/[id] — delete user profile
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "school_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent admin from deleting themselves
  if (id === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("profiles").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
