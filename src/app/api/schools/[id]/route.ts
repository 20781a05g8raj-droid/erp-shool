import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/schools/[id] — super_admin only: single school with counts
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const school = await db.school.findUnique({
    where: { id },
    include: {
      _count: {
        select: { students: true, staff: true, classes: true },
      },
    },
  });

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  return NextResponse.json(school);
}

// PUT /api/schools/[id] — super_admin only: update school details
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.school.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.address !== undefined) data.address = body.address?.trim() || null;
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.email !== undefined) data.email = body.email?.trim() || null;
  if (body.logo !== undefined) data.logo = body.logo?.trim() || null;
  if (body.establishedDate !== undefined) data.establishedDate = body.establishedDate || null;

  try {
    const updated = await db.school.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/schools/[id] — super_admin only: delete a school (cascade-deletes its data)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.school.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  try {
    await db.school.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
