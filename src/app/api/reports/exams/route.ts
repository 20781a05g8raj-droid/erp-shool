import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/reports/exams — exam performance summary by exam, by class, pass rates, top performers
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Get all exams in the school
  const { data: examsRaw, error: examsError } = await supabaseAdmin
    .from("exams")
    .select("*, class:classes(id, name)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (examsError) {
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }

  const exams = (examsRaw || []) as Array<Record<string, unknown>>;

  // Get all exam results for these exams, with subject + student + student.class
  const examIds = exams.map((e) => e.id as string);
  let results: Array<Record<string, unknown>> = [];
  if (examIds.length > 0) {
    const { data: resultsRaw } = await supabaseAdmin
      .from("exam_results")
      .select(
        "*, subject:subjects(id, name), student:students(id, first_name, last_name, admission_number, class_id, class:classes(name))"
      )
      .in("exam_id", examIds);
    results = (resultsRaw || []) as Array<Record<string, unknown>>;
  }

  // Group results by exam_id
  const resultsByExam = new Map<string, Array<Record<string, unknown>>>();
  for (const r of results) {
    const examId = r.exam_id as string;
    if (!resultsByExam.has(examId)) resultsByExam.set(examId, []);
    resultsByExam.get(examId)!.push(r);
  }

  // Build exam-wise summary
  const examSummaries = exams.map((exam) => {
    const examResults = resultsByExam.get(exam.id as string) || [];
    const totalMarks = examResults.reduce(
      (s, r) => s + Number(r.marks_obtained),
      0
    );
    const maxPossible = examResults.reduce(
      (s, r) => s + Number(r.max_marks),
      0
    );
    const avgPercentage =
      maxPossible > 0 ? Math.round((totalMarks / maxPossible) * 100) : 0;

    // Pass = student scored >= 40% on average across subjects
    const studentScores: Record<
      string,
      {
        student: Record<string, unknown>;
        total: number;
        max: number;
        count: number;
      }
    > = {};
    for (const r of examResults) {
      const sid = r.student_id as string;
      if (!studentScores[sid]) {
        studentScores[sid] = {
          student: r.student as Record<string, unknown>,
          total: 0,
          max: 0,
          count: 0,
        };
      }
      studentScores[sid].total += Number(r.marks_obtained);
      studentScores[sid].max += Number(r.max_marks);
      studentScores[sid].count += 1;
    }
    const studentList = Object.values(studentScores);
    const passedCount = studentList.filter(
      (s) => s.max > 0 && (s.total / s.max) * 100 >= 40
    ).length;
    const passRate =
      studentList.length > 0
        ? Math.round((passedCount / studentList.length) * 100)
        : 0;

    // Subject-wise avg
    const subjectMap: Record<
      string,
      { name: string; total: number; max: number; count: number }
    > = {};
    for (const r of examResults) {
      const key = r.subject_id as string;
      if (!subjectMap[key]) {
        const subject = r.subject as Record<string, unknown> | null;
        subjectMap[key] = {
          name: (subject?.name as string) || "Unknown",
          total: 0,
          max: 0,
          count: 0,
        };
      }
      subjectMap[key].total += Number(r.marks_obtained);
      subjectMap[key].max += Number(r.max_marks);
      subjectMap[key].count += 1;
    }
    const subjectAvg = Object.values(subjectMap).map((s) => ({
      subject: s.name,
      avgMarks: s.max > 0 ? Math.round((s.total / s.max) * 100) : 0,
      count: s.count,
    }));

    // Top performers (top 5 by percentage)
    const topPerformers = studentList
      .map((s) => {
        const student = s.student as Record<string, unknown>;
        const studentClass = student.class as { name: string } | null;
        return {
          studentName: `${student.first_name} ${student.last_name}`,
          admissionNumber: student.admission_number,
          className: studentClass?.name || "—",
          total: s.total,
          max: s.max,
          percentage: s.max > 0 ? Math.round((s.total / s.max) * 100) : 0,
          subjects: s.count,
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    const examClass = exam.class as { name: string } | null;
    return {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      className: examClass?.name || "—",
      startDate: exam.start_date,
      endDate: exam.end_date,
      totalStudents: studentList.length,
      totalResults: examResults.length,
      avgPercentage,
      passRate,
      subjectAvg,
      topPerformers,
    };
  });

  // Latest exam subject avg (for the bar chart on Exams tab)
  const latestExam = examSummaries[0] || null;

  // Class-wise performance: average across all exams per class
  const classMap: Record<
    string,
    {
      className: string;
      totalMarks: number;
      maxMarks: number;
      count: number;
    }
  > = {};
  for (const exam of exams) {
    const examClass = exam.class as { name: string } | null;
    const className = examClass?.name || "—";
    const classId = exam.class_id as string;
    if (!classMap[classId]) {
      classMap[classId] = { className, totalMarks: 0, maxMarks: 0, count: 0 };
    }
    const examResults = resultsByExam.get(exam.id as string) || [];
    for (const r of examResults) {
      classMap[classId].totalMarks += Number(r.marks_obtained);
      classMap[classId].maxMarks += Number(r.max_marks);
      classMap[classId].count += 1;
    }
  }
  const byClass = Object.values(classMap).map((c) => ({
    class: c.className,
    avgPercentage:
      c.maxMarks > 0 ? Math.round((c.totalMarks / c.maxMarks) * 100) : 0,
    count: c.count,
  }));

  return NextResponse.json({
    totalExams: exams.length,
    totalResults: results.length,
    overallAvg:
      examSummaries.length > 0
        ? Math.round(
            examSummaries.reduce((s, e) => s + e.avgPercentage, 0) /
              examSummaries.length
          )
        : 0,
    overallPassRate:
      examSummaries.length > 0
        ? Math.round(
            examSummaries.reduce((s, e) => s + e.passRate, 0) /
              examSummaries.length
          )
        : 0,
    exams: examSummaries,
    latestExam,
    byClass,
  });
}
