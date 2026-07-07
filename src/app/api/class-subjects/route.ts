import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/class-subjects — assign a subject to a class.
// Body: { classId, subjectId }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; subjectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const subjectId = (body.subjectId ?? "").toString().trim();
  if (!classId || !subjectId) {
    return NextResponse.json(
      { error: "classId and subjectId are required" },
      { status: 400 }
    );
  }

  // Validate class + subject belong to this school.
  const [cls, subject] = await Promise.all([
    db.class.findFirst({ where: { id: classId, schoolId: user.schoolId } }),
    db.subject.findFirst({ where: { id: subjectId, schoolId: user.schoolId } }),
  ]);
  if (!cls || !subject) {
    return NextResponse.json({ error: "Class or subject not found" }, { status: 404 });
  }

  // Upsert to handle the unique constraint on (classId, subjectId).
  const cs = await db.classSubject.upsert({
    where: { classId_subjectId: { classId, subjectId } },
    update: {},
    create: { classId, subjectId },
  });

  return NextResponse.json({ classSubject: cs }, { status: 201 });
}

// DELETE /api/class-subjects — unassign a subject from a class.
// Body: { classId, subjectId }
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; subjectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const subjectId = (body.subjectId ?? "").toString().trim();
  if (!classId || !subjectId) {
    return NextResponse.json(
      { error: "classId and subjectId are required" },
      { status: 400 }
    );
  }

  // Verify school scope via the class.
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  await db.classSubject.deleteMany({ where: { classId, subjectId } });

  return NextResponse.json({ success: true });
}
