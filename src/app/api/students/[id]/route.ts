import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/students/[id] — single student with class/section/attendance/fees
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const student = await db.student.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      attendance: {
        orderBy: { date: "desc" },
        take: 60,
        select: { id: true, date: true, status: true },
      },
      studentFees: {
        include: {
          feeStructure: { select: { id: true, name: true, term: true } },
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true,
              receiptNumber: true,
            },
          },
        },
      },
      examResults: {
        include: {
          subject: { select: { id: true, name: true } },
          exam: { select: { id: true, name: true } },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      bookIssues: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          book: { select: { id: true, title: true } },
        },
      },
      certificates: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Computed attendance + fee stats
  const totalAttendance = student.attendance.length;
  const presentCount = student.attendance.filter(
    (a) => a.status === "present" || a.status === "late"
  ).length;
  const attendanceRate =
    totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const feesTotal = student.studentFees.reduce((s, f) => s + f.totalAmount, 0);
  const feesPaid = student.studentFees.reduce((s, f) => s + f.paidAmount, 0);
  const feesDue = student.studentFees.reduce((s, f) => s + f.dueAmount, 0);

  return NextResponse.json({
    ...student,
    stats: {
      attendanceRate,
      totalAttendance,
      presentCount,
      feesTotal,
      feesPaid,
      feesDue,
    },
  });
}

// PUT /api/students/[id] — update student
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.student.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, admissionNumber: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const body = await req.json();

  if (!body.firstName || typeof body.firstName !== "string" || !body.firstName.trim()) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (!body.lastName || typeof body.lastName !== "string" || !body.lastName.trim()) {
    return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  }

  // If admissionNumber changed, ensure uniqueness
  const newAdmission = (body.admissionNumber || "").trim();
  if (newAdmission && newAdmission !== existing.admissionNumber) {
    const conflict = await db.student.findFirst({
      where: { schoolId: user.schoolId, admissionNumber: newAdmission, NOT: { id } },
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
    const updated = await db.student.update({
      where: { id },
      data: {
        admissionNumber: newAdmission || existing.admissionNumber,
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
        fatherName: body.fatherName?.trim() || null,
        motherName: body.motherName?.trim() || null,
        parentPhone: body.parentPhone?.trim() || null,
        parentEmail: body.parentEmail?.trim() || null,
        admissionDate: body.admissionDate || null,
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/students/[id] — remove student (cascade handled by Prisma onDelete)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.student.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    // Clean up dependent records that don't cascade automatically
    await db.studentFee.deleteMany({ where: { studentId: id } });
    await db.studentTransport.deleteMany({ where: { studentId: id } });
    await db.student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete student";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
