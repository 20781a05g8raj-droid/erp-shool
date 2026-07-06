import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/classes/[id] — update a class (name, order).
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.class.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  let body: { name?: string; order?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; order?: number } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.order === "number" && !Number.isNaN(body.order)) {
    data.order = body.order;
  }

  const updated = await db.class.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    class: { id: updated.id, name: updated.name, order: updated.order },
  });
}

// DELETE /api/classes/[id] — delete a class (sections + class_subjects cascade).
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.class.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  await db.class.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
