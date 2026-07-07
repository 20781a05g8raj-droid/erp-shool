import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/timetable — fetch slots.
//   ?classId=&sectionId=  -> weekly grid for that class+section
//   ?staffId=             -> all slots where that teacher teaches (across classes)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classIdParam = searchParams.get("classId");
  const sectionIdParam = searchParams.get("sectionId");
  const staffId = searchParams.get("staffId");
  const studentIdParam = searchParams.get("studentId");

  // Resolve studentId -> classId + sectionId (used by student/parent view).
  let classId: string | null | undefined = classIdParam;
  let sectionId: string | null | undefined = sectionIdParam;
  if (studentIdParam) {
    const student = await db.student.findFirst({
      where: { id: studentIdParam, schoolId: user.schoolId },
      select: { classId: true, sectionId: true },
    });
    if (!student) {
      return NextResponse.json({ slots: [] });
    }
    classId = student.classId;
    sectionId = student.sectionId;
  }

  // For student/parent role, force scope to their own class+section.
  if (user.role === "student" || user.role === "parent") {
    const me = await db.student.findFirst({
      where: {
        id: user.studentId ?? undefined,
        schoolId: user.schoolId,
      },
      select: { classId: true, sectionId: true },
    });
    if (me) {
      classId = me.classId;
      sectionId = me.sectionId;
    } else {
      return NextResponse.json({ slots: [] });
    }
  }

  const slots = await db.timetableSlot.findMany({
    where: {
      AND: [
        { class: { schoolId: user.schoolId } },
        staffId
          ? { staffId }
          : { classId: classId ?? undefined, sectionId: sectionId ?? undefined },
      ],
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      staff: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: [{ day: "asc" }, { period: "asc" }],
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      id: s.id,
      classId: s.classId,
      sectionId: s.sectionId,
      day: s.day,
      period: s.period,
      subjectId: s.subjectId,
      staffId: s.staffId,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      staff: s.staff,
      class: s.class,
      section: s.section,
    })),
  });
}

// POST /api/timetable — bulk save slots for a class+section+day.
// Body: { classId, sectionId, day, slots: [{ period, subjectId?, staffId?, startTime, endTime }] }
// Replaces all existing slots for that class+section+day with the provided set.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    classId?: string;
    sectionId?: string;
    day?: string;
    slots?: Array<{
      period: number;
      subjectId?: string | null;
      staffId?: string | null;
      startTime: string;
      endTime: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = (body.classId ?? "").toString().trim();
  const sectionId = (body.sectionId ?? "").toString().trim();
  const day = (body.day ?? "").toString().trim();
  const slots = Array.isArray(body.slots) ? body.slots : [];

  if (!classId || !sectionId || !day) {
    return NextResponse.json(
      { error: "classId, sectionId and day are required" },
      { status: 400 }
    );
  }

  const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  if (!VALID_DAYS.includes(day)) {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }

  // Validate class + section belong to school.
  const [cls, section] = await Promise.all([
    db.class.findFirst({ where: { id: classId, schoolId: user.schoolId } }),
    db.section.findFirst({ where: { id: sectionId, classId } }),
  ]);
  if (!cls || !section) {
    return NextResponse.json(
      { error: "Class or section not found" },
      { status: 404 }
    );
  }

  // Replace all existing slots for this class+section+day, then create new ones.
  await db.$transaction(async (tx) => {
    await tx.timetableSlot.deleteMany({
      where: { classId, sectionId, day },
    });
    if (slots.length > 0) {
      await tx.timetableSlot.createMany({
        data: slots.map((s) => ({
          classId,
          sectionId,
          day,
          period: s.period,
          subjectId: s.subjectId || null,
          staffId: s.staffId || null,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }
  });

  // Return the new set of slots for this day, fully populated.
  const created = await db.timetableSlot.findMany({
    where: { classId, sectionId, day },
    include: {
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
    orderBy: { period: "asc" },
  });

  return NextResponse.json({
    slots: created.map((s) => ({
      id: s.id,
      classId: s.classId,
      sectionId: s.sectionId,
      day: s.day,
      period: s.period,
      subjectId: s.subjectId,
      staffId: s.staffId,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      staff: s.staff,
    })),
  });
}
