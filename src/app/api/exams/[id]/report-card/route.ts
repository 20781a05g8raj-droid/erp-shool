import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  const { data: examRaw, error: examError } = await supabaseAdmin
    .from("exams")
    .select(
      "*, class:classes(id, name), school:schools(id, name, address, phone, email, logo)"
    )
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (examError || !examRaw) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const exam = examRaw as Record<string, unknown>;

  const { data: studentRaw, error: studentError } = await supabaseAdmin
    .from("students")
    .select(
      "*, class:classes(id, name), section:sections(id, name)"
    )
    .eq("id", studentId)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (studentError || !studentRaw) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const student = studentRaw as Record<string, unknown>;

  // This student's results
  const { data: myResultsRaw } = await supabaseAdmin
    .from("exam_results")
    .select("*, subject:subjects(id, name, code)")
    .eq("exam_id", id)
    .eq("student_id", studentId);

  const myResultsArr = (myResultsRaw || []) as Array<Record<string, unknown>>;
  myResultsArr.sort((a, b) => {
    const sa = ((a.subject as Record<string, unknown>)?.name as string) || "";
    const sb = ((b.subject as Record<string, unknown>)?.name as string) || "";
    return sa.localeCompare(sb);
  });

  // All results in this exam (for rank computation)
  const { data: allResultsRaw } = await supabaseAdmin
    .from("exam_results")
    .select("student_id, marks_obtained, max_marks")
    .eq("exam_id", id);

  const allResults = (allResultsRaw || []) as Array<{
    student_id: string;
    marks_obtained: number;
    max_marks: number;
  }>;

  // Compute total per student
  const totalsMap = new Map<string, number>();
  const maxTotalMap = new Map<string, number>();
  for (const r of allResults) {
    totalsMap.set(r.student_id, (totalsMap.get(r.student_id) || 0) + Number(r.marks_obtained));
    maxTotalMap.set(r.student_id, (maxTotalMap.get(r.student_id) || 0) + Number(r.max_marks));
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
  const hasFailed = myResultsArr.some((r) => {
    const max = Number(r.max_marks);
    const marks = Number(r.marks_obtained);
    return max > 0 && (marks / max) * 100 < 33;
  });
  const result = myResultsArr.length === 0 ? "—" : hasFailed ? "FAIL" : "PASS";

  // Subjects for this exam (use class_subjects as canonical list)
  const { data: classSubjectsRaw } = await supabaseAdmin
    .from("class_subjects")
    .select("*, subject:subjects(id, name, code)")
    .eq("class_id", exam.class_id as string);

  const classSubjects = (classSubjectsRaw || []) as Array<Record<string, unknown>>;
  classSubjects.sort((a, b) => {
    const sa = ((a.subject as Record<string, unknown>)?.name as string) || "";
    const sb = ((b.subject as Record<string, unknown>)?.name as string) || "";
    return sa.localeCompare(sb);
  });

  const examMaxMarks = Number(exam.max_marks);

  // Build subject-wise results — null marksObtained for unmarked subjects
  const subjectMarks = classSubjects.map((cs) => {
    const subject = cs.subject as Record<string, unknown>;
    const subjectId = subject.id as string;
    const r = myResultsArr.find(
      (x) => (x.subject_id as string) === subjectId
    );
    if (!r) {
      return {
        subjectId,
        subjectName: subject.name,
        subjectCode: subject.code,
        marksObtained: null as number | null,
        maxMarks: examMaxMarks,
        percentage: 0,
        grade: "—",
        remarks: "Not Graded",
      };
    }
    const max = Number(r.max_marks);
    const marks = Number(r.marks_obtained);
    const pct = max > 0 ? (marks / max) * 100 : 0;
    return {
      subjectId,
      subjectName: subject.name,
      subjectCode: subject.code,
      marksObtained: marks,
      maxMarks: max,
      percentage: Math.round(pct * 100) / 100,
      grade: (r.grade as string) || gradeForPercentage(pct),
      remarks: (r.remarks as string | null) || (pct < 33 ? "Needs Improvement" : null),
    };
  });

  // If no class subjects are defined, use whatever results exist
  const finalSubjectMarks =
    subjectMarks.length > 0
      ? subjectMarks
      : myResultsArr.map((r) => {
          const subject = r.subject as Record<string, unknown>;
          const max = Number(r.max_marks);
          const marks = Number(r.marks_obtained);
          const pct = max > 0 ? (marks / max) * 100 : 0;
          return {
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code,
            marksObtained: marks as number | null,
            maxMarks: max,
            percentage: Math.round(pct * 100) / 100,
            grade: (r.grade as string) || gradeForPercentage(pct),
            remarks: r.remarks as string | null,
          };
        });

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      startDate: exam.start_date,
      endDate: exam.end_date,
      maxMarks: exam.max_marks,
      class: toCamelCase(exam.class as Record<string, unknown>),
    },
    school: toCamelCase(exam.school as Record<string, unknown>),
    student: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      admissionNumber: student.admission_number,
      rollNumber: student.roll_number,
      dob: student.dob,
      gender: student.gender,
      fatherName: student.father_name,
      motherName: student.mother_name,
      class: toCamelCase(student.class as Record<string, unknown>),
      section: toCamelCase(student.section as Record<string, unknown>),
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
