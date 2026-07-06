import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/homework/[id] — update homework. Only the original poster (teacher)
// or admins may edit.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["teacher", "school_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.homework.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }

  // Only the original teacher or admins may edit.
  if (
    user.role === "teacher" &&
    existing.staffId &&
    existing.staffId !== user.staffId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string | null;
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

  const data: {
    title?: string;
    description?: string | null;
    sectionId?: string | null;
    subjectId?: string | null;
    staffId?: string | null;
    dueDate?: string;
    attachment?: string | null;
  } = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description ?? null;
  if (body.sectionId !== undefined) data.sectionId = body.sectionId || null;
  if (body.subjectId !== undefined) data.subjectId = body.subjectId || null;
  if (body.staffId !== undefined) data.staffId = body.staffId || null;
  if (typeof body.dueDate === "string" && body.dueDate) data.dueDate = body.dueDate;
  if (body.attachment !== undefined) data.attachment = body.attachment || null;

  const updated = await db.homework.update({
    where: { id },
    data,
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      staff: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
    },
  });

  return NextResponse.json({ homework: updated });
}

// DELETE /api/homework/[id] — delete homework. Only the original poster or
// admins may delete.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["teacher", "school_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.homework.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Homework not found" }, { status: 404 });
  }

  if (
    user.role === "teacher" &&
    existing.staffId &&
    existing.staffId !== user.staffId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.homework.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
