import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canMarkStaffAttendance } from "@/lib/permissions";

// GET /api/attendance/staff?date=YYYY-MM-DD
// Returns all staff of the school with their attendance for the given date (default today).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const today = new Date();
  const date =
    dateParam ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

  try {
    const staff = await db.staff.findMany({
      where: { schoolId: user.schoolId, status: "active" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        designation: true,
        department: true,
        type: true,
        photo: true,
      },
    });

    const staffIds = staff.map((s) => s.id);
    const attendance =
      staffIds.length > 0
        ? await db.staffAttendance.findMany({
            where: { staffId: { in: staffIds }, date },
            select: {
              id: true,
              staffId: true,
              status: true,
              checkIn: true,
              checkOut: true,
            },
          })
        : [];

    const attendanceMap = new Map(attendance.map((a) => [a.staffId, a]));

    const rows = staff.map((s) => ({
      ...s,
      attendance: attendanceMap.get(s.id) || null,
    }));

    const presentCount = attendance.filter(
      (a) => a.status === "present"
    ).length;

    return NextResponse.json({
      date,
      staff: rows,
      total: staff.length,
      marked: attendance.length,
      present: presentCount,
      absent: staff.length - presentCount,
    });
  } catch (err) {
    console.error("[attendance/staff GET] error", err);
    return NextResponse.json(
      { error: "Failed to fetch staff attendance" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/staff
// Body: { date, records: [{ staffId, status, checkIn?, checkOut? }] }
// Upserts each record.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only HR, school_admin, super_admin can mark staff attendance (NOT teachers)
  if (!canMarkStaffAttendance(user.role)) {
    return NextResponse.json({ error: "You don't have permission to mark staff attendance" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { date, records } = body || {};

    if (!date || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "date and records[] are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const validStatuses = ["present", "absent", "late", "leave", "halfday"];

    const validStaff = await db.staff.findMany({
      where: { schoolId: user.schoolId, status: "active" },
      select: { id: true },
    });
    const validStaffIds = new Set(validStaff.map((s) => s.id));

    const cleanRecords = records
      .filter(
        (r: {
          staffId?: string;
          status?: string;
          checkIn?: string | null;
          checkOut?: string | null;
        }) =>
          r &&
          typeof r.staffId === "string" &&
          typeof r.status === "string" &&
          validStaffIds.has(r.staffId) &&
          validStatuses.includes(r.status)
      )
      .map(
        (r: {
          staffId: string;
          status: string;
          checkIn?: string | null;
          checkOut?: string | null;
        }) => ({
          staffId: r.staffId,
          status: r.status,
          checkIn: r.checkIn ?? null,
          checkOut: r.checkOut ?? null,
        })
      );

    if (cleanRecords.length === 0) {
      return NextResponse.json(
        { error: "No valid records to save" },
        { status: 400 }
      );
    }

    const existing = await db.staffAttendance.findMany({
      where: {
        date,
        staffId: { in: cleanRecords.map((r) => r.staffId) },
      },
      select: { id: true, staffId: true },
    });
    const existingMap = new Map(existing.map((e) => [e.staffId, e.id]));

    const operations = cleanRecords.map((r) => {
      const existingId = existingMap.get(r.staffId);
      if (existingId) {
        return db.staffAttendance.update({
          where: { id: existingId },
          data: {
            status: r.status,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
          },
        });
      }
      return db.staffAttendance.create({
        data: {
          staffId: r.staffId,
          date,
          status: r.status,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
        },
      });
    });

    await db.$transaction(operations);

    return NextResponse.json({
      success: true,
      date,
      saved: cleanRecords.length,
    });
  } catch (err) {
    console.error("[attendance/staff POST] error", err);
    return NextResponse.json(
      { error: "Failed to save staff attendance" },
      { status: 500 }
    );
  }
}
