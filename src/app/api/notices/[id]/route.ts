import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/notices/[id] — update a notice
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles: Role[] = ["super_admin", "school_admin", "teacher"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.notice.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }
  if (body.content !== undefined && (typeof body.content !== "string" || !body.content.trim())) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  const audience = body.targetAudience || "all";
  if (body.targetAudience && !["all", "class", "role"].includes(audience)) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.content !== undefined) data.content = body.content.trim();
  if (body.targetAudience !== undefined) {
    data.targetAudience = audience;
    data.targetClassId = audience === "class" ? body.targetClassId : null;
    data.targetRole = audience === "role" ? body.targetRole || null : null;
  }
  if (body.date !== undefined) data.date = body.date;

  try {
    const updated = await db.notice.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update notice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/notices/[id] — delete a notice
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles: Role[] = ["super_admin", "school_admin"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.notice.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  try {
    await db.notice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete notice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
