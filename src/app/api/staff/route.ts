import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/staff — minimal list of staff for the current school. Used by
// selects (class teacher assignment, timetable teacher, homework poster).
// Returns: { staff: [{ id, firstName, lastName, employeeId, designation, department }] }
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const teachingOnly = searchParams.get("teaching") === "true";

  const staff = await db.staff.findMany({
    where: {
      schoolId: user.schoolId,
      ...(teachingOnly ? { type: "teaching" } : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      designation: true,
      department: true,
      type: true,
    },
  });

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      employeeId: s.employeeId,
      designation: s.designation,
      department: s.department,
      type: s.type,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
    })),
  });
}
