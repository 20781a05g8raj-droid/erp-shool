import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/sections — create a section under a class. Optionally assigns a
// class teacher at creation.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; name?: string; classTeacherId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const name = (body.name ?? "").toString().trim();
  if (!classId || !name) {
    return NextResponse.json(
      { error: "classId and name are required" },
      { status: 400 }
    );
  }

  // Verify class belongs to this school.
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Validate class teacher belongs to this school (if provided).
  let classTeacherId: string | undefined = undefined;
  if (body.classTeacherId) {
    const staff = await db.staff.findFirst({
      where: { id: body.classTeacherId, schoolId: user.schoolId },
    });
    if (staff) classTeacherId = staff.id;
  }

  const section = await db.section.create({
    data: {
      name,
      classId,
      classTeacherId,
    },
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

  return NextResponse.json({ section }, { status: 201 });
}
