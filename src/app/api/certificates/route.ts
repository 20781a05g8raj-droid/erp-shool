import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/certificates — list with optional ?studentId= filter
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  // Role-based scoping: student/parent only see their own certificates
  const scopedStudentId =
    user.role === "student" || user.role === "parent"
      ? user.studentId
      : studentId;

  const where: { schoolId: string; studentId?: string } = { schoolId: user.schoolId };
  if (scopedStudentId) where.studentId = scopedStudentId;

  const certificates = await db.certificate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          classId: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ certificates });
}

// POST /api/certificates — create certificate (auto-gen serial number)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { studentId, type, issueDate, issuedBy, content } = body as {
      studentId?: string;
      type?: string;
      issueDate?: string;
      issuedBy?: string;
      content?: string;
    };

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }
    if (!type || !["transfer", "bonafide", "character"].includes(type)) {
      return NextResponse.json(
        { error: "type must be transfer, bonafide, or character" },
        { status: 400 }
      );
    }

    // Validate student belongs to school
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const finalIssueDate = issueDate || new Date().toISOString().split("T")[0];

    // Auto-generate serial number: CERT-{YYYY}-{00001} per school per year
    const year = new Date(finalIssueDate).getFullYear();
    const existingThisYear = await db.certificate.findMany({
      where: {
        schoolId: user.schoolId,
        serialNumber: { startsWith: `CERT-${year}-` },
      },
      select: { serialNumber: true },
    });
    let maxNum = 0;
    for (const c of existingThisYear) {
      const num = parseInt(c.serialNumber?.split("-")[2] || "0", 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const serialNumber = `CERT-${year}-${String(maxNum + 1).padStart(5, "0")}`;

    const certificate = await db.certificate.create({
      data: {
        studentId,
        type,
        issueDate: finalIssueDate,
        issuedBy: issuedBy || user.name || null,
        content: content || null,
        serialNumber,
        schoolId: user.schoolId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            dob: true,
            gender: true,
            fatherName: true,
            motherName: true,
            address: true,
            admissionDate: true,
            classId: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(certificate, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create certificate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
