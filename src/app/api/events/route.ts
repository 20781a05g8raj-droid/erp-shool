import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  let query = supabaseAdmin
    .from("school_events")
    .select("*")
    .eq("school_id", schoolId);

  if (monthStr && yearStr) {
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endOfMonth = `${year}-${String(month).padStart(2, "0")}-31`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const nextMonthStart = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      // Any event whose [date, endDate] overlaps the month range.
      // We fetch with OR across 4 clauses
      query = query.or(
        [
          `and(date.gte.${start},date.lte.${endOfMonth})`,
          `and(date.gte.${start},date.lt.${nextMonthStart})`,
          `and(end_date.gte.${start},end_date.lte.${endOfMonth})`,
          `and(end_date.gte.${nextMonthStart},date.lt.${start})`,
        ].join(",")
      );
    }
  }

  query = query.order("date", { ascending: true });

  const { data: eventsRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }

  const events = (eventsRaw || []) as Array<Record<string, unknown>>;
  return NextResponse.json({ events: events.map((e) => toCamelCase(e)) });
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
    return NextResponse.json(
      { error: "End date cannot be before start date" },
      { status: 400 }
    );
  }

  try {
    const insertRow = {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      date: body.date,
      end_date: body.endDate || null,
      type,
      school_id: user.schoolId,
    };

    const { data: eventRaw, error: insertError } = await supabaseAdmin
      .from("school_events")
      .insert(insertRow)
      .select("*")
      .single();

    if (insertError || !eventRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create event" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(eventRaw as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
