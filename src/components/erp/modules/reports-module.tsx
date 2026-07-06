"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  GraduationCap,
  Wallet,
  TrendingUp,
  Percent,
  Download,
  PieChart as PieIcon,
  Activity,
  Award,
  ClipboardList,
  BookOpen,
  IndianRupee,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiFetch, formatCurrency, formatDate, STATUS_COLORS } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ===================== CSV export helper =====================
function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.error("No data to export");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const s = val === null || val === undefined ? "" : String(val);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("CSV exported");
}

// ===================== Chart colors =====================
const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6"];
const GENDER_COLORS = ["#3b82f6", "#ec4899", "#a855f7"];
const FEE_STATUS_COLORS: Record<string, string> = {
  paid: "#10b981",
  partial: "#3b82f6",
  pending: "#f59e0b",
  overdue: "#ef4444",
};

// ===================== Types =====================
interface AttendanceReport {
  overallRate: number;
  totalRecords: number;
  presentRecords: number;
  byClass: { class: string; total: number; present: number; rate: number }[];
  byMonth: { month: string; rate: number; total: number; present: number }[];
  statusBreakdown: Record<string, number>;
}

interface FeesReport {
  totalExpected: number;
  totalCollected: number;
  totalDue: number;
  collectionRate: number;
  statusBreakdown: Record<string, number>;
  byClass: { class: string; expected: number; collected: number; due: number; rate: number }[];
  monthlyTrend: { month: string; collected: number }[];
  defaulters: {
    id: string;
    studentName: string;
    admissionNumber: string;
    className: string;
    fatherName: string;
    parentPhone: string;
    feeStructure: string;
    term: string;
    dueDate: string | null;
    dueAmount: number;
    status: string;
  }[];
  defaulterCount: number;
}

interface ExamReport {
  totalExams: number;
  totalResults: number;
  overallAvg: number;
  overallPassRate: number;
  exams: {
    id: string;
    name: string;
    type: string;
    className: string;
    startDate: string;
    endDate: string;
    totalStudents: number;
    totalResults: number;
    avgPercentage: number;
    passRate: number;
    subjectAvg: { subject: string; avgMarks: number; count: number }[];
    topPerformers: {
      studentName: string;
      admissionNumber: string;
      className: string;
      total: number;
      max: number;
      percentage: number;
      subjects: number;
    }[];
  }[];
  latestExam: {
    id: string;
    name: string;
    subjectAvg: { subject: string; avgMarks: number; count: number }[];
  } | null;
  byClass: { class: string; avgPercentage: number; count: number }[];
}

interface StudentsReport {
  totalStudents: number;
  activeStudents: number;
  alumniStudents: number;
  transferredStudents: number;
  genderDistribution: { name: string; value: number }[];
  classDistribution: { class: string; total: number; male: number; female: number; active: number }[];
  bloodGroupDistribution: { group: string; count: number }[];
  admissionTrend: { month: string; count: number }[];
}

interface OverviewData {
  totalStudents: number;
  totalRevenue: number;
  avgAttendance: number;
  passRate: number;
  attendanceTrend: { month: string; rate: number }[];
  feeTrend: { month: string; collected: number }[];
}

// ===================== Main Component =====================
export function ReportsModule() {
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "fees" | "exams" | "students">("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [fees, setFees] = useState<FeesReport | null>(null);
  const [exams, setExams] = useState<ExamReport | null>(null);
  const [students, setStudents] = useState<StudentsReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      // Pull from dashboard for combined stats + reuse report endpoints for trend lines
      const [dash, att, fee, ex] = await Promise.all([
        apiFetch<{
          stats: { students: number; totalFeeCollected: number; todayAttendanceRate: number };
        }>("/api/dashboard"),
        apiFetch<AttendanceReport>("/api/reports/attendance"),
        apiFetch<FeesReport>("/api/reports/fees"),
        apiFetch<ExamReport>("/api/reports/exams"),
      ]);
      setOverview({
        totalStudents: dash.stats.students,
        totalRevenue: dash.stats.totalFeeCollected,
        avgAttendance: att.overallRate,
        passRate: ex.overallPassRate,
        attendanceTrend: att.byMonth.map((m) => ({ month: m.month, rate: m.rate })),
        feeTrend: fee.monthlyTrend.map((m) => ({ month: m.month, collected: m.collected })),
      });
      // Pre-fill the other tabs too (avoid duplicate loads)
      setAttendance(att);
      setFees(fee);
      setExams(ex);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AttendanceReport>("/api/reports/attendance");
      setAttendance(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance report");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<FeesReport>("/api/reports/fees");
      setFees(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load fees report");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ExamReport>("/api/reports/exams");
      setExams(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load exams report");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<StudentsReport>("/api/reports/students");
      setStudents(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load students report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as typeof activeTab);
    if (tab === "overview" && !overview) void loadOverview();
    if (tab === "attendance" && !attendance) void loadAttendance();
    if (tab === "fees" && !fees) void loadFees();
    if (tab === "exams" && !exams) void loadExams();
    if (tab === "students" && !students) void loadStudents();
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Cross-module insights with exportable reports."
        icon={BarChart3}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Percent className="w-4 h-4 mr-2" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="fees">
            <Wallet className="w-4 h-4 mr-2" />
            Fees
          </TabsTrigger>
          <TabsTrigger value="exams">
            <GraduationCap className="w-4 h-4 mr-2" />
            Exams
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="w-4 h-4 mr-2" />
            Students
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          {loading && !overview ? (
            <ReportsSkeleton />
          ) : overview ? (
            <OverviewTab data={overview} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No data yet"
              description="Reports will appear once you have data."
            />
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-0">
          {loading && !attendance ? (
            <ReportsSkeleton />
          ) : attendance ? (
            <AttendanceTab data={attendance} onExport={() => downloadCSV("attendance-report.csv", attendance.byClass)} />
          ) : (
            <EmptyState icon={Percent} title="No attendance data" description="Mark attendance to view reports." />
          )}
        </TabsContent>

        <TabsContent value="fees" className="mt-0">
          {loading && !fees ? (
            <ReportsSkeleton />
          ) : fees ? (
            <FeesTab
              data={fees}
              onExportClass={() => downloadCSV("fees-by-class.csv", fees.byClass)}
              onExportDefaulters={() =>
                downloadCSV(
                  "fee-defaulters.csv",
                  fees.defaulters.map((d) => ({
                    Student: d.studentName,
                    AdmissionNo: d.admissionNumber,
                    Class: d.className,
                    Father: d.fatherName,
                    Phone: d.parentPhone,
                    FeeStructure: d.feeStructure,
                    Term: d.term,
                    DueDate: d.dueDate ? formatDate(d.dueDate) : "—",
                    DueAmount: d.dueAmount,
                    Status: d.status,
                  }))
                )
              }
            />
          ) : (
            <EmptyState icon={Wallet} title="No fee data" description="Set up fee structures to view reports." />
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-0">
          {loading && !exams ? (
            <ReportsSkeleton />
          ) : exams && exams.totalExams > 0 ? (
            <ExamsTab
              data={exams}
              onExport={() =>
                downloadCSV(
                  "exam-report.csv",
                  exams.exams.map((e) => ({
                    Exam: e.name,
                    Type: e.type,
                    Class: e.className,
                    StartDate: formatDate(e.startDate),
                    EndDate: formatDate(e.endDate),
                    Students: e.totalStudents,
                    AvgPercentage: e.avgPercentage,
                    PassRate: e.passRate,
                  }))
                )
              }
            />
          ) : (
            <EmptyState icon={GraduationCap} title="No exam data" description="Record exam results to view analytics." />
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-0">
          {loading && !students ? (
            <ReportsSkeleton />
          ) : students ? (
            <StudentsTab
              data={students}
              onExport={() => downloadCSV("students-report.csv", students.classDistribution)}
            />
          ) : (
            <EmptyState icon={Users} title="No student data" description="Add students to view demographics." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== Overview Tab =====================
function OverviewTab({ data }: { data: OverviewData }) {
  const combinedTrend = useMemo(() => {
    const map: Record<string, { month: string; attendance?: number; collected?: number }> = {};
    for (const a of data.attendanceTrend) {
      map[a.month] = { month: a.month, attendance: a.rate };
    }
    for (const f of data.feeTrend) {
      if (!map[f.month]) map[f.month] = { month: f.month };
      map[f.month].collected = f.collected;
    }
    return Object.values(map);
  }, [data]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Students" value={data.totalStudents} icon={Users} color="text-blue-600" delay={0} />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          icon={IndianRupee}
          color="text-emerald-600"
          delay={0.1}
        />
        <StatsCard
          title="Avg Attendance %"
          value={`${data.avgAttendance}%`}
          icon={Percent}
          color="text-amber-600"
          delay={0.2}
        />
        <StatsCard
          title="Pass Rate"
          value={`${data.passRate}%`}
          icon={Award}
          color="text-purple-600"
          delay={0.3}
        />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Combined Trend
          </CardTitle>
          <CardDescription>Attendance rate vs fee collection (last 6 months)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={combinedTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="attendance"
                stroke="#6366f1"
                name="Attendance %"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="collected"
                stroke="#10b981"
                name="Collected (₹)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== Attendance Tab =====================
function AttendanceTab({
  data,
  onExport,
}: {
  data: AttendanceReport;
  onExport: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard title="Overall Attendance" value={`${data.overallRate}%`} icon={Percent} color="text-emerald-600" />
        <StatsCard title="Total Records" value={data.totalRecords} icon={ClipboardList} color="text-blue-600" />
        <StatsCard title="Present Records" value={data.presentRecords} icon={Activity} color="text-amber-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Attendance % by Class</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byClass.length === 0 ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.byClass}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="rate" name="Attendance %" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Monthly Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.byMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#10b981"
                  name="Attendance %"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Class-wise Summary</CardTitle>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {data.byClass.length === 0 ? (
            <EmptyChartState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Total Records</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byClass.map((row) => (
                  <TableRow key={row.class}>
                    <TableCell className="font-medium">{row.class}</TableCell>
                    <TableCell className="text-right">{row.total}</TableCell>
                    <TableCell className="text-right">{row.present}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={
                          row.rate >= 75
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : row.rate >= 50
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }
                      >
                        {row.rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== Fees Tab =====================
function FeesTab({
  data,
  onExportClass,
  onExportDefaulters,
}: {
  data: FeesReport;
  onExportClass: () => void;
  onExportDefaulters: () => void;
}) {
  const statusPieData = useMemo(() => {
    return Object.entries(data.statusBreakdown)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [data.statusBreakdown]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Expected" value={formatCurrency(data.totalExpected)} icon={Wallet} color="text-blue-600" />
        <StatsCard title="Total Collected" value={formatCurrency(data.totalCollected)} icon={IndianRupee} color="text-emerald-600" />
        <StatsCard title="Total Due" value={formatCurrency(data.totalDue)} icon={AlertTriangle} color="text-red-600" />
        <StatsCard title="Collection Rate" value={`${data.collectionRate}%`} icon={Percent} color="text-amber-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Monthly Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Fee Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={FEE_STATUS_COLORS[entry.name] || "#6366f1"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Class-wise Fee Collection</CardTitle>
          <Button variant="outline" size="sm" onClick={onExportClass}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {data.byClass.length === 0 ? (
            <EmptyChartState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byClass.map((row) => (
                  <TableRow key={row.class}>
                    <TableCell className="font-medium">{row.class}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.expected)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(row.collected)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(row.due)}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={
                          row.rate >= 75
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : row.rate >= 50
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }
                      >
                        {row.rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Defaulters ({data.defaulterCount})
            </CardTitle>
            <CardDescription>Students with pending or overdue fees</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onExportDefaulters}>
            <Download className="w-4 h-4 mr-2" />
            Export Defaulters
          </Button>
        </CardHeader>
        <CardContent>
          {data.defaulters.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No defaulters. All fees are paid.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead className="text-right">Due Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.defaulters.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium">{d.studentName}</div>
                        <div className="text-xs text-muted-foreground">{d.admissionNumber}</div>
                      </TableCell>
                      <TableCell>{d.className}</TableCell>
                      <TableCell className="text-sm">
                        <div>{d.fatherName}</div>
                        <div className="text-xs text-muted-foreground">{d.parentPhone}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(d.dueAmount)}
                      </TableCell>
                      <TableCell>{d.dueDate ? formatDate(d.dueDate) : "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[d.status] || "bg-muted text-muted-foreground"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== Exams Tab =====================
function ExamsTab({
  data,
  onExport,
}: {
  data: ExamReport;
  onExport: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Exams" value={data.totalExams} icon={ClipboardList} color="text-blue-600" />
        <StatsCard title="Total Results" value={data.totalResults} icon={BookOpen} color="text-purple-600" />
        <StatsCard title="Overall Avg" value={`${data.overallAvg}%`} icon={TrendingUp} color="text-amber-600" />
        <StatsCard title="Pass Rate" value={`${data.overallPassRate}%`} icon={Award} color="text-emerald-600" />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">
            Avg Marks by Subject
            {data.latestExam && <span className="text-sm font-normal text-muted-foreground ml-2">— {data.latestExam.name}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.latestExam || data.latestExam.subjectAvg.length === 0 ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.latestExam.subjectAvg}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="avgMarks" name="Avg %" fill="#a855f7" radius={[6, 6, 0, 0]}>
                  {data.latestExam.subjectAvg.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Exam-wise Performance</CardTitle>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Avg %</TableHead>
                  <TableHead className="text-right">Pass Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>
                      <div className="font-medium">{exam.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{exam.type.replace("_", " ")}</div>
                    </TableCell>
                    <TableCell>{exam.className}</TableCell>
                    <TableCell className="text-right">{exam.totalStudents}</TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">{exam.avgPercentage}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={
                          exam.passRate >= 75
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : exam.passRate >= 50
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }
                      >
                        {exam.passRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top performers for each exam */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.exams.length === 0 ? (
            <EmptyChartState />
          ) : (
            <div className="space-y-4">
              {data.exams.slice(0, 3).map((exam) => (
                <div key={exam.id}>
                  <h4 className="text-sm font-semibold mb-2">{exam.name}</h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {exam.topPerformers.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.studentName}</div>
                          <div className="text-xs text-muted-foreground">{p.className}</div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {p.percentage}%
                        </Badge>
                      </div>
                    ))}
                    {exam.topPerformers.length === 0 && (
                      <div className="text-sm text-muted-foreground">No results recorded.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== Students Tab =====================
function StudentsTab({
  data,
  onExport,
}: {
  data: StudentsReport;
  onExport: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Students" value={data.totalStudents} icon={Users} color="text-blue-600" />
        <StatsCard title="Active" value={data.activeStudents} icon={Activity} color="text-emerald-600" />
        <StatsCard title="Alumni" value={data.alumniStudents} icon={GraduationCap} color="text-purple-600" />
        <StatsCard title="Transferred" value={data.transferredStudents} icon={BookOpen} color="text-amber-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="w-4 h-4" />
              Gender Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.genderDistribution.every((g) => g.value === 0) ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.genderDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {data.genderDistribution.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Students per Class</CardTitle>
          </CardHeader>
          <CardContent>
            {data.classDistribution.length === 0 ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.classDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="male" name="Male" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="female" name="Female" stackId="a" fill="#ec4899" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Class-wise Demographics</CardTitle>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {data.classDistribution.length === 0 ? (
            <EmptyChartState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Male</TableHead>
                  <TableHead className="text-right">Female</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.classDistribution.map((row) => (
                  <TableRow key={row.class}>
                    <TableCell className="font-medium">{row.class}</TableCell>
                    <TableCell className="text-right">{row.total}</TableCell>
                    <TableCell className="text-right">{row.active}</TableCell>
                    <TableCell className="text-right text-blue-600">{row.male}</TableCell>
                    <TableCell className="text-right text-pink-600">{row.female}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== Empty chart state =====================
function EmptyChartState() {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground">
      <BarChart3 className="w-10 h-10 mb-2 opacity-40" />
      <p className="text-sm">No data to display</p>
    </div>
  );
}

// ===================== Skeleton =====================
function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-5 animate-pulse">
              <div className="h-11 w-11 bg-muted rounded-xl mb-3" />
              <div className="h-7 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="glass-card">
        <CardContent className="p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/4 mb-4" />
          <div className="h-[320px] bg-muted rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
