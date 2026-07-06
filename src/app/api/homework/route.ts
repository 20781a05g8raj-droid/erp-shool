import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/homework — list homework.
//   ?classId=            -> all homework for that class
//   ?studentId=          -> homework for the student's class (auto-resolves classId)
//   ?staffId=            -> homework posted by that teacher
//   (no params)          -> all homework in the school
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const studentId = searchParams.get("studentId");
  const staffId = searchParams.get("staffId");

  let effectiveClassId = classId;
  let studentScope: { id: string; classId?: string | null } | null = null;
  if (studentId) {
    studentScope = await db.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: { id: true, classId: true },
    });
    if (!studentScope) {
      return NextResponse.json({ homework: [] });
    }
    effectiveClassId = studentScope.classId ?? null;
  }

  // Role-based scoping: students/parents only see homework for their own class.
  let scopeClassId: string | undefined = effectiveClassId ?? undefined;
  if (user.role === "student" || user.role === "parent") {
    const me = await db.student.findFirst({
      where: {
        id: user.studentId ?? undefined,
        schoolId: user.schoolId,
      },
      select: { id: true, classId: true },
    });
    if (me) scopeClassId = me.classId ?? undefined;
    else scopeClassId = "__none__"; // no student record -> no homework
  }

  const homework = await db.homework.findMany({
    where: {
      schoolId: user.schoolId,
      ...(scopeClassId ? { classId: scopeClassId } : {}),
      ...(staffId ? { staffId } : {}),
    },
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
    orderBy: { dueDate: "desc" },
  });

  return NextResponse.json({
    homework: homework.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      dueDate: h.dueDate,
      attachment: h.attachment,
      classId: h.classId,
      sectionId: h.sectionId,
      subjectId: h.subjectId,
      staffId: h.staffId,
      createdAt: h.createdAt,
      class: h.class,
      section: h.section,
      subject: h.subject,
      staff: h.staff,
    })),
  });
}

// POST /api/homework — create homework.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers / admins can post homework.
  if (!["teacher", "school_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string;
    classId?: string;
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

  const title = (body.title ?? "").toString().trim();
  const classId = (body.classId ?? "").toString().trim();
  const dueDate = (body.dueDate ?? "").toString().trim();
  if (!title || !classId || !dueDate) {
    return NextResponse.json(
      { error: "title, classId and dueDate are required" },
      { status: 400 }
    );
  }

  // Validate class belongs to school.
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Validate section (if provided) belongs to the class.
  if (body.sectionId) {
    const sec = await db.section.findFirst({
      where: { id: body.sectionId, classId },
    });
    if (!sec) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
  }

  // Default staffId = current user's staffId (if they're a teacher).
  const staffId =
    body.staffId ||
    (user.role === "teacher" && user.staffId ? user.staffId : null);

  const hw = await db.homework.create({
    data: {
      title,
      description: body.description?.toString() ?? null,
      classId,
      sectionId: body.sectionId || null,
      subjectId: body.subjectId || null,
      staffId: staffId || null,
      dueDate,
      attachment: body.attachment || null,
      schoolId: user.schoolId,
    },
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

  return NextResponse.json({ homework: hw }, { status: 201 });
}
