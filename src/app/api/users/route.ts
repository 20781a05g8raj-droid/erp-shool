import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const profiles = await db.profile.findMany({
    where: {
      schoolId,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      avatar: true,
      status: true,
      studentId: true,
      staffId: true,
      createdAt: true,
    },
  });

  // For each profile, fetch linked student/staff info
  const enriched = await Promise.all(
    profiles.map(async (p) => {
      let linkedInfo: { type: string; name: string; extra?: string } | null = null;
      if (p.studentId) {
        const stu = await db.student.findUnique({
          where: { id: p.studentId },
          select: { firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } },
        });
        if (stu) {
          linkedInfo = {
            type: "student",
            name: `${stu.firstName} ${stu.lastName}`,
            extra: `${stu.admissionNumber} · ${stu.class?.name || "—"}`,
          };
        }
      } else if (p.staffId) {
        const stf = await db.staff.findUnique({
          where: { id: p.staffId },
          select: { firstName: true, lastName: true, employeeId: true, designation: true },
        });
        if (stf) {
          linkedInfo = {
            type: "staff",
            name: `${stf.firstName} ${stf.lastName}`,
            extra: `${stf.employeeId} · ${stf.designation || "—"}`,
          };
        }
      }
      return { ...p, linkedInfo };
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
    const existing = await db.profile.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const profile = await db.profile.create({
      data: {
        email: normalizedEmail,
        password: `demo:${password}`,
        name: name.trim(),
        role,
        phone: phone?.trim() || null,
        studentId: studentId || null,
        staffId: staffId || null,
        status: status || "active",
        schoolId: user.schoolId,
      },
      select: {
        id: true, email: true, name: true, role: true,
        phone: true, status: true, studentId: true, staffId: true, createdAt: true,
      },
    });

    return NextResponse.json({ user: profile }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
