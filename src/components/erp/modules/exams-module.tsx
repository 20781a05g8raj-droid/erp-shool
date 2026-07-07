"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Search,
  ClipboardList,
  Award,
  TrendingUp,
  CalendarDays,
  ChevronRight,
  Save,
  Download,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { apiFetch, formatDate } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

// ===================== Types =====================
interface ClassOption {
  id: string;
  name: string;
  order: number;
  studentCount?: number;
  sections?: { id: string; name: string }[];
}

interface SubjectLite {
  id: string;
  name: string;
  code?: string | null;
}

interface ExamStudent {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  rollNumber?: string | null;
}

interface ExamRow {
  id: string;
  name: string;
  type: string;
  schoolId: string;
  classId: string;
  startDate: string;
  endDate: string;
  maxMarks: number;
  createdAt: string;
  class?: { id: string; name: string } | null;
  resultCount: number;
  studentCount: number;
}

interface ExamResultRow {
  id: string;
  examId: string;
  studentId: string;
  subjectId: string;
  marksObtained: number;
  maxMarks: number;
  grade?: string | null;
  remarks?: string | null;
  subject?: SubjectLite | null;
  student?: ExamStudent | null;
}

interface ExamDetail {
  exam: {
    id: string;
    name: string;
    type: string;
    classId: string;
    startDate: string;
    endDate: string;
    maxMarks: number;
    class?: { id: string; name: string } | null;
  };
  subjects: SubjectLite[];
  students: ExamStudent[];
  results: ExamResultRow[];
}

interface ReportCardData {
  exam: {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    maxMarks: number;
    class?: { id: string; name: string } | null;
  };
  school: {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber?: string | null;
    dob?: string | null;
    gender?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    class?: { id: string; name: string } | null;
    section?: { id: string; name: string } | null;
  };
  subjects: {
    subjectId: string;
    subjectName: string;
    subjectCode?: string | null;
    marksObtained: number | null;
    maxMarks: number;
    percentage: number;
    grade: string;
    remarks?: string | null;
  }[];
  total: number;
  maxTotal: number;
  percentage: number;
  overallGrade: string;
  rank: number;
  totalStudents: number;
  result: string;
}

// ===================== Constants =====================
const EXAM_TYPE_LABELS: Record<string, string> = {
  unit_test: "Unit Test",
  mid_term: "Mid Term",
  final: "Final",
};

const EXAM_TYPE_COLORS: Record<string, string> = {
  unit_test: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  mid_term: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  final: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  A: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "B+": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  B: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  C: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  D: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  F: "bg-red-500/10 text-red-600 dark:text-red-400",
};

// Standard grading scale
export function gradeForPercentage(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

function isFailMarks(marks: number, max: number): boolean {
  if (max <= 0) return false;
  return (marks / max) * 100 < 33;
}

// ===================== Main Component =====================
export function ExamsModule() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("exams");

  const isStudentOrParent = user?.role === "student" || user?.role === "parent";

  // Shared data
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);

  // Loading flags
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRow | null>(null);

  // Selected exam (for marks entry & report cards)
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  // Stats
  const [stats, setStats] = useState<{
    totalExams: number;
    avgPassRate: number;
    topPerformer?: { name: string; percentage: number } | null;
  }>({ totalExams: 0, avgPassRate: 0, topPerformer: null });

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const data = await apiFetch<{ classes: ClassOption[] }>("/api/classes");
      setClasses(data.classes || []);
    } catch {
      toast.error("Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  const fetchExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const data = await apiFetch<{ exams: ExamRow[] }>("/api/exams");
      setExams(data.exams || []);
    } catch {
      toast.error("Failed to load exams");
    } finally {
      setLoadingExams(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // Compute stats from exams + results
      const examsData = await apiFetch<{ exams: ExamRow[] }>("/api/exams");
      const examList = examsData.exams || [];
      let totalResults = 0;
      let passCount = 0;
      const studentPcts: { name: string; pct: number }[] = [];

      for (const ex of examList) {
        const detail = await apiFetch<ExamDetail>(`/api/exams/${ex.id}`);
        // group by student
        const totals = new Map<string, number>();
        const maxTotals = new Map<string, number>();
        const studentNameMap = new Map<string, string>();
        for (const r of detail.results) {
          totals.set(r.studentId, (totals.get(r.studentId) || 0) + r.marksObtained);
          maxTotals.set(r.studentId, (maxTotals.get(r.studentId) || 0) + r.maxMarks);
          if (r.student) {
            studentNameMap.set(
              r.studentId,
              `${r.student.firstName} ${r.student.lastName}`
            );
          }
        }
        for (const [sid, total] of totals.entries()) {
          const max = maxTotals.get(sid) || 0;
          const pct = max > 0 ? (total / max) * 100 : 0;
          totalResults++;
          if (pct >= 33) passCount++;
          const name = studentNameMap.get(sid);
          if (name) studentPcts.push({ name, pct });
        }
      }

      const avgPassRate = totalResults > 0 ? (passCount / totalResults) * 100 : 0;
      const top = studentPcts.length
        ? studentPcts.sort((a, b) => b.pct - a.pct)[0]
        : null;

      setStats({
        totalExams: examList.length,
        avgPassRate: Math.round(avgPassRate * 100) / 100,
        topPerformer: top
          ? { name: top.name, percentage: Math.round(top.pct * 100) / 100 }
          : null,
      });
    } catch {
      // silent — stats are nice-to-have
    }
  }, []);

  // Initial fetches
  useEffect(() => {
    fetchClasses();
    fetchExams();
  }, [fetchClasses, fetchExams]);

  useEffect(() => {
    if (!isStudentOrParent) fetchStats();
  }, [isStudentOrParent, fetchStats, exams.length]);

  const handleOpenCreate = () => {
    setEditingExam(null);
    setCreateDialogOpen(true);
  };

  const handleOpenEdit = (e: ExamRow) => {
    setEditingExam(e);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (e: ExamRow) => {
    if (
      !confirm(
        `Delete exam "${e.name}"? All entered marks for this exam will also be deleted.`
      )
    )
      return;
    try {
      await apiFetch(`/api/exams/${e.id}`, { method: "DELETE" });
      toast.success("Exam deleted");
      fetchExams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleExamCreated = (examId?: string) => {
    setCreateDialogOpen(false);
    fetchExams();
    if (examId) {
      setSelectedExamId(examId);
      setActiveTab("marks");
    }
  };

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .report-card-print, .report-card-print * { visibility: visible !important; }
          .report-card-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border: none !important;
            transform: none !important;
            max-height: none !important; overflow: visible !important;
          }
          .no-print { display: none !important; }
        }
        `,
        }}
      />

      <PageHeader
        title="Exams & Grading"
        description="Create exams, enter marks, calculate grades & generate report cards."
        icon={FileText}
        actionLabel={isStudentOrParent ? undefined : "Create Exam"}
        onAction={isStudentOrParent ? undefined : handleOpenCreate}
      />

      {/* Stats */}
      {!isStudentOrParent && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatsCard
            title="Total Exams"
            value={stats.totalExams}
            icon={ClipboardList}
            color="text-blue-600 dark:text-blue-400"
            delay={0}
          />
          <StatsCard
            title="Avg Pass Rate"
            value={`${stats.avgPassRate}%`}
            icon={TrendingUp}
            color="text-emerald-600 dark:text-emerald-400"
            delay={0.05}
          />
          <StatsCard
            title="Top Performer"
            value={stats.topPerformer ? stats.topPerformer.name : "—"}
            icon={Award}
            color="text-amber-600 dark:text-amber-400"
            trendLabel={
              stats.topPerformer
                ? `${stats.topPerformer.percentage}% average`
                : undefined
            }
            delay={0.1}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="exams">Exams</TabsTrigger>
          {!isStudentOrParent && <TabsTrigger value="marks">Marks Entry</TabsTrigger>}
          <TabsTrigger value="reports">Report Cards</TabsTrigger>
        </TabsList>

        {/* ===================== EXAMS TAB ===================== */}
        <TabsContent value="exams">
          {loadingExams ? (
            <ExamsListSkeleton />
          ) : exams.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No exams yet"
              description={
                isStudentOrParent
                  ? "There are no exams scheduled for your class yet."
                  : "Create your first exam — choose a class, set the date range, and start entering marks."
              }
              actionLabel={isStudentOrParent ? undefined : "Create Exam"}
              onAction={isStudentOrParent ? undefined : handleOpenCreate}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam, i) => (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="glass-card hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => {
                    setSelectedExamId(exam.id);
                    if (isStudentOrParent) {
                      setActiveTab("reports");
                    } else {
                      setActiveTab("marks");
                    }
                  }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{exam.name}</CardTitle>
                          <CardDescription className="mt-1 flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EXAM_TYPE_COLORS[exam.type] || ""}`}>
                              {EXAM_TYPE_LABELS[exam.type] || exam.type}
                            </span>
                            <span>{exam.class?.name || "—"}</span>
                          </CardDescription>
                        </div>
                        {!isStudentOrParent && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-60 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Search className="w-3.5 h-3.5 rotate-90" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => handleOpenEdit(exam)}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDelete(exam)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>
                          {formatDate(exam.startDate)} — {formatDate(exam.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{exam.studentCount} student{exam.studentCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{exam.resultCount} marks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="font-medium">{exam.maxMarks}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end text-xs text-primary group-hover:translate-x-0.5 transition-transform">
                        {isStudentOrParent ? "View Report Card" : "Enter Marks"}
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===================== MARKS ENTRY TAB ===================== */}
        {!isStudentOrParent && (
          <TabsContent value="marks">
            <MarksEntryTab
              exams={exams}
              selectedExamId={selectedExamId}
              onSelectExam={setSelectedExamId}
              loadingExams={loadingExams}
            />
          </TabsContent>
        )}

        {/* ===================== REPORT CARDS TAB ===================== */}
        <TabsContent value="reports">
          <ReportCardsTab
            exams={exams}
            selectedExamId={selectedExamId}
            onSelectExam={setSelectedExamId}
            isStudentOrParent={isStudentOrParent}
            userStudentId={user?.studentId || null}
            loadingExams={loadingExams}
          />
        </TabsContent>
      </Tabs>

      {/* ===================== Create/Edit Dialog ===================== */}
      <ExamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        classes={classes}
        loadingClasses={loadingClasses}
        editing={editingExam}
        onSaved={handleExamCreated}
      />
    </div>
  );
}

// ===================== Marks Entry Tab =====================
function MarksEntryTab({
  exams,
  selectedExamId,
  onSelectExam,
  loadingExams,
}: {
  exams: ExamRow[];
  selectedExamId: string;
  onSelectExam: (id: string) => void;
  loadingExams: boolean;
}) {
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // marks[studentId][subjectId] = value (string for input)
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({});

  const loadExam = useCallback(async (examId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<ExamDetail>(`/api/exams/${examId}`);
      setDetail(data);
      // initialize marks from existing results
      const m: Record<string, Record<string, string>> = {};
      for (const s of data.students) {
        m[s.id] = {};
        for (const sub of data.subjects) {
          const existing = data.results.find(
            (r) => r.studentId === s.id && r.subjectId === sub.id
          );
          m[s.id][sub.id] =
            existing && existing.marksObtained !== undefined
              ? String(existing.marksObtained)
              : "";
        }
      }
      setMarks(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load exam");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedExamId) loadExam(selectedExamId);
    else {
      setDetail(null);
      setMarks({});
    }
  }, [selectedExamId, loadExam]);

  const handleMarkChange = (studentId: string, subjectId: string, value: string) => {
    // Allow empty or numeric
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const max = detail?.exam.maxMarks || 100;
      const num = parseFloat(value);
      if (value !== "" && !isNaN(num) && num > max) {
        toast.error(`Marks cannot exceed ${max}`);
        return;
      }
      setMarks((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], [subjectId]: value },
      }));
    }
  };

  const computeStudentRow = (studentId: string) => {
    if (!detail) return { total: 0, max: 0, pct: 0, grade: "F", failCount: 0 };
    let total = 0;
    let max = 0;
    let failCount = 0;
    for (const sub of detail.subjects) {
      const val = marks[studentId]?.[sub.id];
      if (val !== undefined && val !== "") {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          total += num;
          max += detail.exam.maxMarks;
          if (isFailMarks(num, detail.exam.maxMarks)) failCount++;
        }
      }
    }
    const pct = max > 0 ? (total / max) * 100 : 0;
    return {
      total,
      max,
      pct: Math.round(pct * 100) / 100,
      grade: gradeForPercentage(pct),
      failCount,
    };
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const results: {
        studentId: string;
        subjectId: string;
        marksObtained: number;
        maxMarks: number;
      }[] = [];
      for (const s of detail.students) {
        for (const sub of detail.subjects) {
          const val = marks[s.id]?.[sub.id];
          if (val !== undefined && val !== "") {
            const num = parseFloat(val);
            if (!isNaN(num)) {
              results.push({
                studentId: s.id,
                subjectId: sub.id,
                marksObtained: num,
                maxMarks: detail.exam.maxMarks,
              });
            }
          }
        }
      }
      if (results.length === 0) {
        toast.error("No marks to save. Enter at least one mark.");
        setSaving(false);
        return;
      }
      const res = await apiFetch<{ upserted: number; total: number }>(
        `/api/exams/${detail.exam.id}/results`,
        {
          method: "POST",
          body: JSON.stringify({ results }),
        }
      );
      toast.success(`Saved ${res.upserted} mark(s)`);
      // Reload to reflect saved state
      loadExam(detail.exam.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  if (loadingExams && exams.length === 0) {
    return <ExamsListSkeleton />;
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <Label className="mb-1.5">Select Exam</Label>
            <Select value={selectedExamId} onValueChange={onSelectExam}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an exam…" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.class?.name || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {detail && (
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Marks"}
            </Button>
          )}
        </div>
      </Card>

      {!selectedExamId ? (
        <EmptyState
          icon={ClipboardList}
          title="Select an exam to enter marks"
          description="Pick an exam above to load the students and subjects grid. You can then enter marks per student per subject."
        />
      ) : loading ? (
        <ExamsListSkeleton />
      ) : !detail ? (
        <EmptyState
          icon={ClipboardList}
          title="Exam not loaded"
          description="Failed to load exam details."
        />
      ) : detail.students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students in this class"
          description="There are no active students assigned to this exam's class."
        />
      ) : detail.subjects.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No subjects assigned to this class"
          description="Add subjects to this class first via the Class Subjects setup."
        />
      ) : (
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{detail.exam.name}</CardTitle>
                <CardDescription className="mt-1">
                  {detail.exam.class?.name} · {detail.students.length} students ·{" "}
                  {detail.subjects.length} subjects · Max {detail.exam.maxMarks} marks
                </CardDescription>
              </div>
              <Badge variant="outline" className={EXAM_TYPE_COLORS[detail.exam.type]}>
                {EXAM_TYPE_LABELS[detail.exam.type]}
              </Badge>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">
                    Student
                  </TableHead>
                  {detail.subjects.map((sub) => (
                    <TableHead key={sub.id} className="text-center min-w-[110px]">
                      <div className="font-medium">{sub.name}</div>
                      <div className="text-xs text-muted-foreground font-normal">
                        / {detail.exam.maxMarks}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[100px]">Total</TableHead>
                  <TableHead className="text-center min-w-[100px]">%</TableHead>
                  <TableHead className="text-center min-w-[80px]">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.students.map((s) => {
                  const row = computeStudentRow(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div className="font-medium">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.admissionNumber}
                          {s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}
                        </div>
                      </TableCell>
                      {detail.subjects.map((sub) => {
                        const val = marks[s.id]?.[sub.id] || "";
                        const num = parseFloat(val);
                        const isFail = val !== "" && !isNaN(num) && isFailMarks(num, detail.exam.maxMarks);
                        return (
                          <TableCell key={sub.id} className="text-center p-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={detail.exam.maxMarks}
                              value={val}
                              onChange={(e) =>
                                handleMarkChange(s.id, sub.id, e.target.value)
                              }
                              className={`w-20 mx-auto text-center ${
                                isFail
                                  ? "border-red-500 bg-red-500/10 text-red-600"
                                  : ""
                              }`}
                              placeholder="—"
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold">
                        {row.total} / {row.max}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {row.pct}%
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${GRADE_COLORS[row.grade] || ""}`}>
                          {row.grade}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ===================== Report Cards Tab =====================
function ReportCardsTab({
  exams,
  selectedExamId,
  onSelectExam,
  isStudentOrParent,
  userStudentId,
  loadingExams,
}: {
  exams: ExamRow[];
  selectedExamId: string;
  onSelectExam: (id: string) => void;
  isStudentOrParent: boolean;
  userStudentId: string | null;
  loadingExams: boolean;
}) {
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // For student/parent: auto-select their studentId
  useEffect(() => {
    if (isStudentOrParent && userStudentId) {
      setSelectedStudentId(userStudentId);
    }
  }, [isStudentOrParent, userStudentId]);

  // Load exam detail to populate student dropdown (and auto-select for student/parent)
  useEffect(() => {
    if (!selectedExamId) {
      setDetail(null);
      setSelectedStudentId(isStudentOrParent ? userStudentId || "" : "");
      setReportCard(null);
      return;
    }
    setLoadingDetail(true);
    apiFetch<ExamDetail>(`/api/exams/${selectedExamId}`)
      .then((data) => {
        setDetail(data);
        // For non-student roles, clear student selection on exam change
        if (!isStudentOrParent) {
          setSelectedStudentId("");
        }
        setReportCard(null);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load exam");
        setDetail(null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedExamId, isStudentOrParent, userStudentId]);

  const handleLoadReport = useCallback(async () => {
    if (!selectedExamId || !selectedStudentId) return;
    setLoadingReport(true);
    try {
      const data = await apiFetch<ReportCardData>(
        `/api/exams/${selectedExamId}/report-card?studentId=${encodeURIComponent(
          selectedStudentId
        )}`
      );
      setReportCard(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load report card");
      setReportCard(null);
    } finally {
      setLoadingReport(false);
    }
  }, [selectedExamId, selectedStudentId]);

  useEffect(() => {
    if (selectedExamId && selectedStudentId) {
      handleLoadReport();
    } else {
      setReportCard(null);
    }
  }, [selectedExamId, selectedStudentId, handleLoadReport]);

  if (loadingExams && exams.length === 0) {
    return <ExamsListSkeleton />;
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4 no-print">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <Label className="mb-1.5">Select Exam</Label>
            <Select value={selectedExamId} onValueChange={onSelectExam}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an exam…" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.class?.name || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isStudentOrParent && (
            <div className="flex-1">
              <Label className="mb-1.5">Select Student</Label>
              <Select
                value={selectedStudentId}
                onValueChange={setSelectedStudentId}
                disabled={!detail || loadingDetail}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student…" />
                </SelectTrigger>
                <SelectContent>
                  {detail?.students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNumber})
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
          )}
          {reportCard && (
            <Button onClick={() => window.print()} className="gradient-primary text-white">
              <Printer className="w-4 h-4 mr-2" /> Print / PDF
            </Button>
          )}
        </div>
      </Card>

      {!selectedExamId ? (
        <EmptyState
          icon={FileText}
          title="Select an exam to view report cards"
          description="Pick an exam above, then choose a student to generate a printable report card."
        />
      ) : loadingDetail ? (
        <ExamsListSkeleton />
      ) : !isStudentOrParent && !selectedStudentId ? (
        <EmptyState
          icon={GraduationCap}
          title="Select a student"
          description="Choose a student above to view their report card for this exam."
        />
      ) : loadingReport ? (
        <ExamsListSkeleton />
      ) : !reportCard ? (
        <EmptyState
          icon={FileText}
          title="No report card available"
          description="No marks have been entered for this student in this exam yet."
        />
      ) : (
        <ReportCardView data={reportCard} />
      )}
    </div>
  );
}

// ===================== Report Card View (Printable) =====================
function ReportCardView({ data }: { data: ReportCardData }) {
  return (
    <div className="report-card-print mx-auto max-w-4xl">
      <Card className="bg-white text-black border-2 border-black/80 shadow-xl">
        {/* School Header */}
        <div className="border-b-2 border-black/80 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {data.school.logo ? (
                <img
                  src={data.school.logo}
                  alt="logo"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center text-2xl font-bold">
                  {data.school.name?.charAt(0) || "S"}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{data.school.name}</h1>
                {data.school.address && (
                  <p className="text-sm text-gray-700">{data.school.address}</p>
                )}
                <p className="text-xs text-gray-600 mt-0.5">
                  {data.school.phone ? `Phone: ${data.school.phone}` : ""}
                  {data.school.email ? ` · Email: ${data.school.email}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center py-4 border-b-2 border-black/80 bg-gray-50">
          <h2 className="text-xl font-bold uppercase tracking-widest">
            {data.exam.type === "final"
              ? "Annual Examination"
              : data.exam.type === "mid_term"
              ? "Mid-Term Examination"
              : "Unit Test"} Report Card
          </h2>
          <p className="text-sm text-gray-700 mt-1">
            Academic Year: {new Date(data.exam.startDate).getFullYear()} ·{" "}
            {data.exam.name}
          </p>
        </div>

        {/* Student Info */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
            <InfoRow label="Student Name" value={`${data.student.firstName} ${data.student.lastName}`} />
            <InfoRow label="Admission No." value={data.student.admissionNumber} />
            <InfoRow label="Class" value={data.student.class?.name || "—"} />
            <InfoRow label="Section" value={data.student.section?.name || "—"} />
            <InfoRow label="Roll Number" value={data.student.rollNumber || "—"} />
            <InfoRow label="Father's Name" value={data.student.fatherName || "—"} />
            <InfoRow label="Mother's Name" value={data.student.motherName || "—"} />
            <InfoRow label="Date of Birth" value={data.student.dob ? formatDate(data.student.dob) : "—"} />
          </div>

          {/* Marks Table */}
          <Table className="border-2 border-black">
            <TableHeader>
              <TableRow className="bg-gray-100 border-b-2 border-black">
                <TableHead className="text-black font-bold">#</TableHead>
                <TableHead className="text-black font-bold">Subject</TableHead>
                <TableHead className="text-black font-bold text-center">Max Marks</TableHead>
                <TableHead className="text-black font-bold text-center">Marks Obtained</TableHead>
                <TableHead className="text-black font-bold text-center">%</TableHead>
                <TableHead className="text-black font-bold text-center">Grade</TableHead>
                <TableHead className="text-black font-bold">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subjects.map((s, i) => (
                <TableRow key={s.subjectId} className="border-b border-black/40">
                  <TableCell className="text-black">{i + 1}</TableCell>
                  <TableCell className="text-black font-medium">
                    {s.subjectName}
                    {s.subjectCode ? ` (${s.subjectCode})` : ""}
                  </TableCell>
                  <TableCell className="text-black text-center">{s.maxMarks}</TableCell>
                  <TableCell className={`text-center font-bold ${
                    s.marksObtained === null
                      ? "text-gray-400"
                      : isFailMarks(s.marksObtained, s.maxMarks)
                      ? "text-red-600"
                      : "text-black"
                  }`}>
                    {s.marksObtained === null ? "—" : s.marksObtained}
                  </TableCell>
                  <TableCell className="text-black text-center">
                    {s.marksObtained === null ? "—" : `${s.percentage}%`}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      s.grade === "—" ? "bg-muted text-muted-foreground" : GRADE_COLORS[s.grade] || ""
                    }`}>
                      {s.grade}
                    </span>
                  </TableCell>
                  <TableCell className="text-black text-xs">
                    {s.remarks || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <SummaryBox label="Total Marks" value={`${data.total} / ${data.maxTotal}`} />
            <SummaryBox label="Percentage" value={`${data.percentage}%`} />
            <SummaryBox label="Overall Grade" value={data.overallGrade} />
            <SummaryBox label="Rank" value={`${data.rank} / ${data.totalStudents}`} />
          </div>

          <div className="mt-4 flex justify-center">
            <div
              className={`px-6 py-2 rounded-lg border-2 font-bold text-lg uppercase ${
                data.result === "PASS"
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                  : data.result === "FAIL"
                  ? "border-red-600 text-red-700 bg-red-50"
                  : "border-gray-400 text-gray-600 bg-gray-50"
              }`}
            >
              {data.result === "—" ? "Result: Not Graded Yet" : `Result: ${data.result}`}
            </div>
          </div>

          {/* Grading Scale */}
          <div className="mt-6 text-xs text-gray-600 border-t pt-4">
            <p className="font-semibold mb-1">Grading Scale:</p>
            <p>
              A+ (90-100) · A (80-89) · B+ (70-79) · B (60-69) · C (50-59) · D (33-49) · F (Below 33 — Fail)
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-12 pt-6">
            <Signature label="Class Teacher" />
            <Signature label="Principal" />
            <Signature label="Parent / Guardian" />
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            This is a computer-generated report card. · Date of Issue: {formatDate(new Date().toISOString())}
          </p>
        </div>
      </Card>
      <p className="text-center text-xs text-muted-foreground mt-3 no-print">
        <Download className="w-3 h-3 inline-block mr-1" />
        Tip: Use the Print button above and choose &quot;Save as PDF&quot; to download.
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="font-semibold text-gray-700 w-32">{label}:</span>
      <span className="text-black">{value}</span>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-black/60 rounded p-3 text-center bg-gray-50">
      <div className="text-xs text-gray-600 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-black mt-1">{value}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="border-t border-black pt-2 mt-8">
        <p className="text-sm text-black font-medium">{label}</p>
      </div>
    </div>
  );
}

// ===================== Create / Edit Exam Dialog =====================
function ExamDialog({
  open,
  onOpenChange,
  classes,
  loadingClasses,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: ClassOption[];
  loadingClasses: boolean;
  editing: ExamRow | null;
  onSaved: (id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("unit_test");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxMarks, setMaxMarks] = useState(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setType(editing.type);
        setClassId(editing.classId);
        setStartDate(editing.startDate);
        setEndDate(editing.endDate);
        setMaxMarks(editing.maxMarks);
      } else {
        setName("");
        setType("unit_test");
        setClassId("");
        setStartDate(new Date().toISOString().split("T")[0]);
        setEndDate(new Date().toISOString().split("T")[0]);
        setMaxMarks(100);
      }
    }
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Exam name is required");
      return;
    }
    if (!classId) {
      toast.error("Please select a class");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Start and end dates are required");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date cannot be before start date");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        classId,
        startDate,
        endDate,
        maxMarks: Number(maxMarks) || 100,
      };
      if (editing) {
        await apiFetch(`/api/exams/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Exam updated");
        onSaved(editing.id);
      } else {
        const created = await apiFetch<{ id: string }>("/api/exams", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Exam created");
        onSaved(created.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Exam" : "Create Exam"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update exam details. Existing marks will not be affected."
              : "Set up a new exam for a class. You can enter marks after creation."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Exam Name *</Label>
            <Input
              placeholder="e.g. Mid-Term Examination 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Exam Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit_test">Unit Test</SelectItem>
                  <SelectItem value="mid_term">Mid Term</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Marks</Label>
              <Input
                type="number"
                min={1}
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Class *</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClasses ? "Loading classes…" : "Select class"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gradient-primary text-white">
            {saving ? "Saving…" : editing ? "Update Exam" : "Create Exam"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Skeleton =====================
function ExamsListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="glass-card">
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
