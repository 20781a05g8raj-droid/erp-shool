import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { gradeForPercentage } from "../results/route";

// GET /api/exams/[id]/report-card?studentId= — full report card data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json(
      { error: "studentId query parameter is required" },
      { status: 400 }
    );
  }

  // Role-based scoping
  if (user.role === "student" || user.role === "parent") {
    if (user.studentId !== studentId) {
      return NextResponse.json(
        { error: "Forbidden: you can only view your own report card" },
        { status: 403 }
      );
    }
  }

  const exam = await db.exam.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      class: { select: { id: true, name: true } },
      school: { select: { id: true, name: true, address: true, phone: true, email: true, logo: true } },
    },
  });
  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const student = await db.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // This student's results
  const myResults = await db.examResult.findMany({
    where: { examId: id, studentId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  // All results in this exam (for rank computation)
  const allResults = await db.examResult.findMany({
    where: { examId: id },
    select: {
      studentId: true,
      marksObtained: true,
      maxMarks: true,
    },
  });

  // Compute total per student
  const totalsMap = new Map<string, number>();
  const maxTotalMap = new Map<string, number>();
  for (const r of allResults) {
    totalsMap.set(r.studentId, (totalsMap.get(r.studentId) || 0) + r.marksObtained);
    maxTotalMap.set(r.studentId, (maxTotalMap.get(r.studentId) || 0) + r.maxMarks);
  }

  // Sort students by total descending, compute rank with ties
  const ranked = Array.from(totalsMap.entries())
    .map(([sid, total]) => ({
      studentId: sid,
      total,
      maxTotal: maxTotalMap.get(sid) || 0,
      pct: maxTotalMap.get(sid) ? (total / (maxTotalMap.get(sid) || 1)) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const ranks = new Map<string, number>();
  let currentRank = 1;
  let previousTotal: number | null = null;
  for (let i = 0; i < ranked.length; i++) {
    if (previousTotal === null || ranked[i].total !== previousTotal) {
      currentRank = i + 1;
      previousTotal = ranked[i].total;
    }
    ranks.set(ranked[i].studentId, currentRank);
  }

  const myTotal = totalsMap.get(studentId) || 0;
  const myMaxTotal = maxTotalMap.get(studentId) || 0;
  const myPct = myMaxTotal > 0 ? (myTotal / myMaxTotal) * 100 : 0;
  const myOverallGrade = gradeForPercentage(myPct);
  const myRank = ranks.get(studentId) || 0;
  const totalStudents = ranked.length;

  // Pass/Fail: fail if any ENTERED subject is below 33%
  // (subjects with no marks entered are treated as "not graded" — excluded from pass/fail)
  const hasFailed = myResults.some(
    (r) => r.maxMarks > 0 && (r.marksObtained / r.maxMarks) * 100 < 33
  );
  const result = myResults.length === 0 ? "—" : hasFailed ? "FAIL" : "PASS";

  // Subjects for this exam (use class_subjects as canonical list)
  const classSubjects = await db.classSubject.findMany({
    where: { classId: exam.classId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  // Build subject-wise results — null marksObtained for unmarked subjects
  const subjectMarks = classSubjects.map((cs) => {
    const r = myResults.find((x) => x.subjectId === cs.subject.id);
    if (!r) {
      return {
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        subjectCode: cs.subject.code,
        marksObtained: null as number | null,
        maxMarks: exam.maxMarks,
        percentage: 0,
        grade: "—",
        remarks: "Not Graded",
      };
    }
    const pct = r.maxMarks > 0 ? (r.marksObtained / r.maxMarks) * 100 : 0;
    return {
      subjectId: cs.subject.id,
      subjectName: cs.subject.name,
      subjectCode: cs.subject.code,
      marksObtained: r.marksObtained,
      maxMarks: r.maxMarks,
      percentage: Math.round(pct * 100) / 100,
      grade: r.grade || gradeForPercentage(pct),
      remarks: r.remarks || (pct < 33 ? "Needs Improvement" : null),
    };
  });

  // If no class subjects are defined, use whatever results exist
  const finalSubjectMarks =
    subjectMarks.length > 0
      ? subjectMarks
      : myResults.map((r) => {
          const pct = r.maxMarks > 0 ? (r.marksObtained / r.maxMarks) * 100 : 0;
          return {
            subjectId: r.subject.id,
            subjectName: r.subject.name,
            subjectCode: r.subject.code,
            marksObtained: r.marksObtained as number | null,
            maxMarks: r.maxMarks,
            percentage: Math.round(pct * 100) / 100,
            grade: r.grade || gradeForPercentage(pct),
            remarks: r.remarks,
          };
        });

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      startDate: exam.startDate,
      endDate: exam.endDate,
      maxMarks: exam.maxMarks,
      class: exam.class,
    },
    school: exam.school,
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      dob: student.dob,
      gender: student.gender,
      fatherName: student.fatherName,
      motherName: student.motherName,
      class: student.class,
      section: student.section,
    },
    subjects: finalSubjectMarks,
    total: myTotal,
    maxTotal: myMaxTotal,
    percentage: Math.round(myPct * 100) / 100,
    overallGrade: myOverallGrade,
    rank: myRank,
    totalStudents,
    result,
  });
}
