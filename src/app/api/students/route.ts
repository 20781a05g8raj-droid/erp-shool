import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageStudents } from "@/lib/permissions";

// GET /api/students — list with optional ?classId=&search=&status= filters
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { schoolId };
  if (classId) where.classId = classId;
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { admissionNumber: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { fatherName: { contains: search } },
    ];
  }

  const students = await db.student.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(students);
}

// POST /api/students — create new student (auto-generate admission number if missing)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only accountant, school_admin, super_admin can add students
  if (!canManageStudents(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage students" }, { status: 403 });
  }

  const schoolId = user.schoolId;
  const body = await req.json();

  // Validate required fields
  if (!body.firstName || typeof body.firstName !== "string" || !body.firstName.trim()) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (!body.lastName || typeof body.lastName !== "string" || !body.lastName.trim()) {
    return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  }

  // Auto-generate admission number if not provided (format: GRW + padded number)
  let admissionNumber = (body.admissionNumber || "").trim();
  if (!admissionNumber) {
    const existing = await db.student.findMany({
      where: { schoolId, admissionNumber: { startsWith: "GRW" } },
      select: { admissionNumber: true },
    });
    let maxNum = 0;
    for (const s of existing) {
      const num = parseInt(s.admissionNumber.replace("GRW", ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    admissionNumber = `GRW${String(maxNum + 1).padStart(4, "0")}`;
  } else {
    // ensure uniqueness within school
    const conflict = await db.student.findFirst({
      where: { schoolId, admissionNumber },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Admission number already exists" },
        { status: 400 }
      );
    }
  }

  try {
    const student = await db.student.create({
      data: {
        admissionNumber,
        rollNumber: body.rollNumber?.trim() || null,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        dob: body.dob || null,
        gender: body.gender || null,
        bloodGroup: body.bloodGroup || null,
        address: body.address?.trim() || null,
        photo: body.photo?.trim() || null,
        classId: body.classId || null,
        sectionId: body.sectionId || null,
        status: body.status || "active",
        schoolId,
        fatherName: body.fatherName?.trim() || null,
        motherName: body.motherName?.trim() || null,
        parentPhone: body.parentPhone?.trim() || null,
        parentEmail: body.parentEmail?.trim() || null,
        admissionDate: body.admissionDate || new Date().toISOString().split("T")[0],
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
