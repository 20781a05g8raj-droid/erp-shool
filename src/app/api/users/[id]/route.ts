import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  const profile = await db.profile.findFirst({
    where: { id, schoolId: user.schoolId },
    select: {
      id: true, email: true, name: true, role: true,
      phone: true, avatar: true, status: true,
      studentId: true, staffId: true, createdAt: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: profile });
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

  const existing = await db.profile.findFirst({
    where: { id, schoolId: user.schoolId },
  });
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

  const updated = await db.profile.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(password ? { password: `demo:${password}` } : {}),
      ...(studentId !== undefined ? { studentId: studentId || null } : {}),
      ...(staffId !== undefined ? { staffId: staffId || null } : {}),
    },
    select: {
      id: true, email: true, name: true, role: true,
      phone: true, status: true, studentId: true, staffId: true, createdAt: true,
    },
  });

  return NextResponse.json({ user: updated });
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

  const existing = await db.profile.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.profile.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
