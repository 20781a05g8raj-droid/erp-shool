import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types";

// GET /api/events — list events. Optional ?month=&year= for calendar filtering.
// Returns events whose date falls within the specified month (or all events if no params).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const monthStr = searchParams.get("month");
  const yearStr = searchParams.get("year");

  const where: Prisma.SchoolEventWhereInput = { schoolId };

  if (monthStr && yearStr) {
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      // End of month: last day of the month (YYYY-MM-31 covers all months safely).
      const endOfMonth = `${year}-${String(month).padStart(2, "0")}-31`;
      // First day of next month — used as the exclusive upper bound.
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const nextMonthStart = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      // Any event whose [date, endDate] overlaps the month range.
      where.OR = [
        // Single-day or start-of-month event in this month
        { date: { gte: start, lte: endOfMonth } },
        // Multi-day event starting in this month (endDate may be later)
        { date: { gte: start, lt: nextMonthStart } },
        // Multi-day event starting before this month but ending in/after it
        { endDate: { gte: start, lte: endOfMonth } },
        { endDate: { gte: nextMonthStart }, date: { lt: start } },
      ];
    }
  }

  const events = await db.schoolEvent.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ events });
}

// POST /api/events — create a new event
// Body: { title, description?, date, endDate?, type (holiday|ptm|exam|function|event) }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles: Role[] = ["super_admin", "school_admin", "teacher"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.date || typeof body.date !== "string") {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const type = body.type || "event";
  if (!["holiday", "ptm", "exam", "function", "event"].includes(type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  // endDate must be on or after date
  if (body.endDate && body.endDate < body.date) {
    return NextResponse.json({ error: "End date cannot be before start date" }, { status: 400 });
  }

  try {
    const event = await db.schoolEvent.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        date: body.date,
        endDate: body.endDate || null,
        type,
        schoolId: user.schoolId,
      },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
