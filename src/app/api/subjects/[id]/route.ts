import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/subjects/[id] — update a subject.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.subject.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  let body: { name?: string; code?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; code?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.code === null || (typeof body.code === "string" && body.code.trim())) {
    data.code = body.code === null ? null : body.code.trim();
  }

  const updated = await db.subject.update({ where: { id }, data });

  return NextResponse.json({ subject: updated });
}

// DELETE /api/subjects/[id] — delete a subject.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.subject.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  await db.subject.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
