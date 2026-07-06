import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/sections/[id] — update a section. Supports renaming and assigning
// the class teacher. To unset the class teacher pass `classTeacherId: null`.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Find the section and verify school scope via the class relation.
  const section = await db.section.findUnique({
    where: { id },
    include: { class: { select: { schoolId: true } } },
  });
  if (!section || section.class.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  let body: { name?: string; classTeacherId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; classTeacherId?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.classTeacherId === null) {
    data.classTeacherId = null;
  } else if (typeof body.classTeacherId === "string" && body.classTeacherId) {
    const staff = await db.staff.findFirst({
      where: { id: body.classTeacherId, schoolId: user.schoolId },
    });
    if (staff) data.classTeacherId = staff.id;
  }

  const updated = await db.section.update({
    where: { id },
    data,
    include: {
      classTeacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
    },
  });

  return NextResponse.json({ section: updated });
}

// DELETE /api/sections/[id] — delete a section.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const section = await db.section.findUnique({
    where: { id },
    include: { class: { select: { schoolId: true } } },
  });
  if (!section || section.class.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  await db.section.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
