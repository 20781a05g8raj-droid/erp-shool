import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/staff — list of staff for the current school.
// Supports filters: ?department=&type=&search=&status=
// Returns: { staff: [{ id, firstName, lastName, employeeId, designation, department, type, status, email, phone, dob, gender, qualification, joiningDate, photo, salary, fullName }] }
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const teachingOnly = searchParams.get("teaching") === "true";
  const department = searchParams.get("department");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  const staff = await db.staff.findMany({
    where: {
      schoolId: user.schoolId,
      ...(teachingOnly ? { type: "teaching" } : {}),
      ...(type ? { type } : {}),
      ...(department ? { department } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { employeeId: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      email: true,
      phone: true,
      dob: true,
      gender: true,
      designation: true,
      department: true,
      qualification: true,
      joiningDate: true,
      type: true,
      photo: true,
      salary: true,
      status: true,
    },
  });

  return NextResponse.json({
    staff: staff.map((s) => ({
      ...s,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
    })),
  });
}

// POST /api/staff — create a new staff member
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Auto-generate employeeId if not provided
    let employeeId = body.employeeId;
    if (!employeeId) {
      const lastStaff = await db.staff.findFirst({
        where: { schoolId: user.schoolId },
        orderBy: { employeeId: "desc" },
      });
      let nextNum = 1;
      if (lastStaff?.employeeId) {
        const match = lastStaff.employeeId.match(/\d+$/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      employeeId = `EMP${String(nextNum).padStart(4, "0")}`;
    }

    // Check uniqueness of employeeId within the school
    const existing = await db.staff.findFirst({
      where: { schoolId: user.schoolId, employeeId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Employee ID already exists" },
        { status: 400 }
      );
    }

    const staff = await db.staff.create({
      data: {
        employeeId,
        firstName: body.firstName?.trim(),
        lastName: body.lastName?.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        dob: body.dob || null,
        gender: body.gender || null,
        designation: body.designation?.trim() || null,
        department: body.department?.trim() || null,
        qualification: body.qualification?.trim() || null,
        joiningDate: body.joiningDate || null,
        type: body.type || "teaching",
        photo: body.photo?.trim() || null,
        salary: typeof body.salary === "number" ? body.salary : parseFloat(body.salary) || 0,
        status: body.status || "active",
        schoolId: user.schoolId,
      },
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { error: "Failed to create staff member" },
      { status: 500 }
    );
  }
}
