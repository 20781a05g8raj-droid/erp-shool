import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/reports/exams — exam performance summary by exam, by class, pass rates, top performers
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Get all exams in the school with results + subject + student
  const exams = await db.exam.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      class: { select: { id: true, name: true } },
      results: {
        include: {
          subject: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              classId: true,
              class: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Build exam-wise summary
  const examSummaries = exams.map((exam) => {
    const results = exam.results;
    const totalMarks = results.reduce((s, r) => s + r.marksObtained, 0);
    const maxPossible = results.reduce((s, r) => s + r.maxMarks, 0);
    const avgPercentage = maxPossible > 0 ? Math.round((totalMarks / maxPossible) * 100) : 0;
    // Pass = student scored >= 40% on average across subjects
    const studentScores: Record<string, { student: typeof results[number]["student"]; total: number; max: number; count: number }> = {};
    for (const r of results) {
      if (!studentScores[r.studentId]) {
        studentScores[r.studentId] = { student: r.student, total: 0, max: 0, count: 0 };
      }
      studentScores[r.studentId].total += r.marksObtained;
      studentScores[r.studentId].max += r.maxMarks;
      studentScores[r.studentId].count += 1;
    }
    const studentList = Object.values(studentScores);
    const passedCount = studentList.filter((s) => s.max > 0 && (s.total / s.max) * 100 >= 40).length;
    const passRate = studentList.length > 0 ? Math.round((passedCount / studentList.length) * 100) : 0;

    // Subject-wise avg
    const subjectMap: Record<string, { name: string; total: number; max: number; count: number }> = {};
    for (const r of results) {
      const key = r.subjectId;
      if (!subjectMap[key]) {
        subjectMap[key] = { name: r.subject?.name || "Unknown", total: 0, max: 0, count: 0 };
      }
      subjectMap[key].total += r.marksObtained;
      subjectMap[key].max += r.maxMarks;
      subjectMap[key].count += 1;
    }
    const subjectAvg = Object.values(subjectMap).map((s) => ({
      subject: s.name,
      avgMarks: s.max > 0 ? Math.round((s.total / s.max) * 100) : 0,
      count: s.count,
    }));

    // Top performers (top 5 by percentage)
    const topPerformers = studentList
      .map((s) => ({
        studentName: `${s.student.firstName} ${s.student.lastName}`,
        admissionNumber: s.student.admissionNumber,
        className: s.student.class?.name || "—",
        total: s.total,
        max: s.max,
        percentage: s.max > 0 ? Math.round((s.total / s.max) * 100) : 0,
        subjects: s.count,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    return {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      className: exam.class?.name || "—",
      startDate: exam.startDate,
      endDate: exam.endDate,
      totalStudents: studentList.length,
      totalResults: results.length,
      avgPercentage,
      passRate,
      subjectAvg,
      topPerformers,
    };
  });

  // Latest exam subject avg (for the bar chart on Exams tab)
  const latestExam = examSummaries[0] || null;

  // Class-wise performance: average across all exams per class
  const classMap: Record<string, { className: string; totalMarks: number; maxMarks: number; count: number }> = {};
  for (const exam of exams) {
    const className = exam.class?.name || "—";
    if (!classMap[exam.classId]) {
      classMap[exam.classId] = { className, totalMarks: 0, maxMarks: 0, count: 0 };
    }
    for (const r of exam.results) {
      classMap[exam.classId].totalMarks += r.marksObtained;
      classMap[exam.classId].maxMarks += r.maxMarks;
      classMap[exam.classId].count += 1;
    }
  }
  const byClass = Object.values(classMap).map((c) => ({
    class: c.className,
    avgPercentage: c.maxMarks > 0 ? Math.round((c.totalMarks / c.maxMarks) * 100) : 0,
    count: c.count,
  }));

  return NextResponse.json({
    totalExams: exams.length,
    totalResults: exams.reduce((s, e) => s + e.results.length, 0),
    overallAvg: examSummaries.length > 0
      ? Math.round(examSummaries.reduce((s, e) => s + e.avgPercentage, 0) / examSummaries.length)
      : 0,
    overallPassRate: examSummaries.length > 0
      ? Math.round(examSummaries.reduce((s, e) => s + e.passRate, 0) / examSummaries.length)
      : 0,
    exams: examSummaries,
    latestExam,
    byClass,
  });
}
