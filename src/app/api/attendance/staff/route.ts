import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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
    const { data: staffData, error: staffErr } = await supabaseAdmin
      .from("staff")
      .select(
        "id, employee_id, first_name, last_name, designation, department, type, photo"
      )
      .eq("school_id", user.schoolId)
      .eq("status", "active")
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true });
    if (staffErr) {
      throw staffErr;
    }

    const staff = (staffData || []) as Array<{
      id: string;
      employee_id: string;
      first_name: string;
      last_name: string;
      designation: string | null;
      department: string | null;
      type: string | null;
      photo: string | null;
    }>;
    const staffIds = staff.map((s) => s.id);

    let attendance: Array<{
      id: string;
      staff_id: string;
      status: string;
      check_in: string | null;
      check_out: string | null;
    }> = [];
    if (staffIds.length > 0) {
      const { data: attendanceData } = await supabaseAdmin
        .from("staff_attendance")
        .select("id, staff_id, status, check_in, check_out")
        .eq("date", date)
        .in("staff_id", staffIds);
      attendance = (attendanceData || []) as typeof attendance;
    }

    const attendanceMap = new Map(attendance.map((a) => [a.staff_id, a]));

    const rows = staff.map((s) => {
      const att = attendanceMap.get(s.id) || null;
      return {
        ...toCamelCase(s as unknown as Record<string, unknown>),
        attendance: att
          ? toCamelCase(att as unknown as Record<string, unknown>)
          : null,
      };
    });

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
// Strategy: delete existing records for the submitted staff on the date,
// then insert the new ones. (Equivalent to upsert per (staff_id, date).)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only HR, school_admin, super_admin can mark staff attendance (NOT teachers)
  if (!canMarkStaffAttendance(user.role)) {
    return NextResponse.json(
      { error: "You don't have permission to mark staff attendance" },
      { status: 403 }
    );
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

    const { data: validStaffData } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("status", "active");
    const validStaffIds = new Set(
      ((validStaffData || []) as Array<{ id: string }>).map((s) => s.id)
    );

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

    const cleanStaffIds = cleanRecords.map((r) => r.staffId);

    // Delete existing attendance for these staff on this date
    const { error: deleteErr } = await supabaseAdmin
      .from("staff_attendance")
      .delete()
      .eq("date", date)
      .in("staff_id", cleanStaffIds);
    if (deleteErr) {
      throw deleteErr;
    }

    // Insert new records
    const insertRows = cleanRecords.map((r) => ({
      staff_id: r.staffId,
      date,
      status: r.status,
      check_in: r.checkIn,
      check_out: r.checkOut,
    }));
    const { error: insertErr } = await supabaseAdmin
      .from("staff_attendance")
      .insert(insertRows);
    if (insertErr) {
      throw insertErr;
    }

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
