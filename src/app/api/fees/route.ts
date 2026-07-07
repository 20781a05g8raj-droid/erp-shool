import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function computeStatus(paid: number, total: number, dueDate: string | null): string {
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) return "partial";
  // paid == 0
  if (dueDate) {
    const today = new Date().toISOString().split("T")[0];
    if (dueDate < today) return "overdue";
  }
  return "pending";
}

// GET — list student fees with filters
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.toLowerCase();

  // Role-based scoping: student/parent only see their own
  const scopedStudentId =
    user.role === "student" || user.role === "parent"
      ? user.studentId
      : studentId;

  // First, refresh overdue statuses based on due date
  const allFees = await db.studentFee.findMany({
    where: { student: { schoolId: user.schoolId } },
    include: { payments: true },
  });
  const todayStr = new Date().toISOString().split("T")[0];
  for (const sf of allFees) {
    const correct = computeStatus(sf.paidAmount, sf.totalAmount, sf.dueDate);
    if (correct !== sf.status) {
      await db.studentFee.update({
        where: { id: sf.id },
        data: { status: correct },
      });
    }
  }
  void todayStr;

  const studentWhere: {
    schoolId: string;
    classId?: string;
    id?: string;
    OR?: { firstName?: { contains: string }; lastName?: { contains: string }; admissionNumber?: { contains: string } }[];
  } = { schoolId: user.schoolId };

  if (scopedStudentId) {
    studentWhere.id = scopedStudentId;
  }
  if (classId) {
    studentWhere.classId = classId;
  }
  if (search) {
    studentWhere.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { admissionNumber: { contains: search } },
    ];
  }

  const where: { student: typeof studentWhere; status?: string } = {
    student: studentWhere,
  };
  if (status && status !== "all") {
    where.status = status;
  }

  const studentFees = await db.studentFee.findMany({
    where,
    include: {
      student: { include: { class: true } },
      feeStructure: true,
      payments: { orderBy: { paymentDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ studentFees });
}

// POST — assign fee structure to a student or all students in a class
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { feeStructureId, studentId, classId, scope } = body as {
      feeStructureId?: string;
      studentId?: string;
      classId?: string;
      scope?: "single" | "class";
    };

    if (!feeStructureId) {
      return NextResponse.json(
        { error: "feeStructureId is required" },
        { status: 400 }
      );
    }

    const feeStructure = await db.feeStructure.findFirst({
      where: { id: feeStructureId, schoolId: user.schoolId },
    });
    if (!feeStructure) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    let targetStudentIds: string[] = [];
    if (scope === "class" || (!scope && classId)) {
      if (!classId) {
        return NextResponse.json(
          { error: "classId is required for class scope assignment" },
          { status: 400 }
        );
      }
      const students = await db.student.findMany({
        where: { schoolId: user.schoolId, classId, status: "active" },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    } else {
      if (!studentId) {
        return NextResponse.json(
          { error: "studentId is required for single assignment" },
          { status: 400 }
        );
      }
      targetStudentIds = [studentId];
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json(
        { error: "No active students found for assignment" },
        { status: 400 }
      );
    }

    // Avoid duplicates: skip students who already have a StudentFee for this structure
    const existing = await db.studentFee.findMany({
      where: {
        feeStructureId,
        studentId: { in: targetStudentIds },
      },
      select: { studentId: true },
    });
    const existingSet = new Set(existing.map((e) => e.studentId));
    const newIds = targetStudentIds.filter((id) => !existingSet.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({
        assigned: 0,
        skipped: targetStudentIds.length,
        message: "All students already have this fee assigned.",
      });
    }

    await db.studentFee.createMany({
      data: newIds.map((sid) => ({
        studentId: sid,
        feeStructureId,
        totalAmount: feeStructure.totalAmount,
        paidAmount: 0,
        dueAmount: feeStructure.totalAmount,
        dueDate: feeStructure.dueDate,
        status: "pending",
      })),
    });

    return NextResponse.json({
      assigned: newIds.length,
      skipped: existingSet.size,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to assign fee structure" },
      { status: 500 }
    );
  }
}
