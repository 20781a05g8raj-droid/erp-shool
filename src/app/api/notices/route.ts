import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const student = await db.student.findUnique({
      where: { id: user.studentId },
      select: { classId: true },
    });
    userClassId = student?.classId ?? null;
  }

  const where: {
    schoolId: string;
    targetAudience?: string;
    AND?: { OR: { targetAudience: string; targetClassId?: string | null; targetRole?: string | null }[] }[];
  } = { schoolId };

  if (audienceFilter) {
    where.targetAudience = audienceFilter;
  }

  // Role-based audience scoping: non-admins only see notices targeting them.
  // Admin-level roles (super_admin, school_admin) see all notices in the school.
  const adminRoles: Role[] = ["super_admin", "school_admin"];
  if (!adminRoles.includes(user.role)) {
    const orClauses: { targetAudience: string; targetClassId?: string | null; targetRole?: string | null }[] = [
      { targetAudience: "all" },
    ];
    if (userClassId) {
      orClauses.push({ targetAudience: "class", targetClassId: userClassId });
    }
    orClauses.push({ targetAudience: "role", targetRole: user.role });
    where.AND = [{ OR: orClauses }];
  }

  const notices = await db.notice.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ notices });
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
      return NextResponse.json({ error: "Class is required for class-targeted notice" }, { status: 400 });
    }
    const cls = await db.class.findFirst({
      where: { id: body.targetClassId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Invalid class" }, { status: 400 });
    }
  }

  const date = body.date || new Date().toISOString().split("T")[0];

  try {
    const notice = await db.notice.create({
      data: {
        title: body.title.trim(),
        content: body.content.trim(),
        targetAudience: audience,
        targetClassId: audience === "class" ? body.targetClassId : null,
        targetRole: audience === "role" ? body.targetRole || null : null,
        postedBy: user.name,
        date,
        schoolId: user.schoolId,
      },
    });
    return NextResponse.json(notice, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create notice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
