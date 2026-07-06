import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/subjects — list subjects for the school (with optional ?classId= filter)
// When classId is provided, returns only the subjects assigned to that class via ClassSubject
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (classId) {
    // Validate class belongs to school
    const cls = await db.class.findFirst({
      where: { id: classId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const classSubjects = await db.classSubject.findMany({
      where: { classId },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { subject: { name: "asc" } },
    });

    return NextResponse.json({
      subjects: classSubjects.map((cs) => cs.subject),
    });
  }

  const subjects = await db.subject.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return NextResponse.json({ subjects });
}
