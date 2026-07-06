import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — list classes for the current school, including sections (with class
// teacher), subjects (via ClassSubject), and student count. Response shape is
// backward-compatible: `{ classes: [{ id, name, order, sections }] }` with
// extra fields added.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classes = await db.class.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { order: "asc" },
    include: {
      sections: {
        orderBy: { name: "asc" },
        include: {
          classTeacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              designation: true,
            },
          },
        },
      },
      subjects: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
      },
      _count: { select: { students: true } },
    },
  });

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
      studentCount: c._count.students,
      sections: c.sections.map((s) => ({
        id: s.id,
        name: s.name,
        classTeacherId: s.classTeacherId,
        classTeacher: s.classTeacher
          ? {
              id: s.classTeacher.id,
              firstName: s.classTeacher.firstName,
              lastName: s.classTeacher.lastName,
              employeeId: s.classTeacher.employeeId,
              designation: s.classTeacher.designation,
            }
          : null,
      })),
      subjects: c.subjects.map((cs) => ({
        id: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
      })),
    })),
  });
}

// POST — create a new class for the current school.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; order?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim();
  if (!name) {
    return NextResponse.json({ error: "Class name is required" }, { status: 400 });
  }

  const order =
    typeof body.order === "number" && !Number.isNaN(body.order)
      ? body.order
      : 0;

  const cls = await db.class.create({
    data: {
      name,
      order,
      schoolId: user.schoolId,
    },
  });

  return NextResponse.json(
    {
      class: {
        id: cls.id,
        name: cls.name,
        order: cls.order,
      },
    },
    { status: 201 }
  );
}
