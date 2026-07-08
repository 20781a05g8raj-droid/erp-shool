"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
} from "recharts";
import {
  Users, GraduationCap, Wallet, TrendingUp, CalendarCheck, BookOpen,
  Bus, Megaphone, AlertCircle, ArrowUpRight, FileText, Clock, RefreshCw,
  ClipboardList, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { StatsCard } from "@/components/erp/stats-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/types";
import { formatCurrency, formatDate, getInitials, STATUS_COLORS } from "@/lib/api";

// ==================== Types ====================
interface AdminData {
  role: "admin";
  stats: {
    students: number; staff: number; classes: number; books: number;
    vehicles: number; routes: number; notices: number; exams: number;
    homework: number; feeDefaulters: number; totalFeeExpected: number;
    totalFeeCollected: number; totalFeeDue: number; todayAttendanceRate: number;
  };
  attendanceTrend: { date: string; present: number; absent: number; rate: number }[];
  feeTrend: { month: string; collected: number; expected: number }[];
  examPerformance: { subject: string; avgMarks: number }[];
  genderDistribution: { name: string; value: number }[];
  classDistribution: { name: string; count: number }[];
  recentNotices: { id: string; title: string; content: string; date: string }[];
  recentStudents: { id: string; firstName: string; lastName: string; admissionNumber: string; class?: { name: string } | null; createdAt: string }[];
  latestExamName: string | null;
}

interface TeacherData {
  role: "teacher";
  teacherName: string;
  stats: { myClasses: number; myStudents: number; homeworkPosted: number; todayPeriods: number };
  attendanceMarkingTrend: { date: string; present: number; absent: number }[];
  myClassesPerformance: { subject: string; avgMarks: number }[];
  myTimetableToday: { period: number; subject: string; class: string; startTime: string; endTime: string }[];
  myHomework: { id: string; title: string; class: string; subject: string; dueDate: string }[];
  myLeaves: { id: string; fromDate: string; toDate: string; type: string; status: string; reason: string | null }[];
  recentNotices: { id: string; title: string; content: string; date: string }[];
}

interface StudentData {
  role: "student" | "parent";
  viewerName: string;
  studentName: string;
  studentInfo: { name: string; admissionNumber: string; className: string; sectionName: string; photo: string | null };
  stats: {
    attendancePercent: number; feePaid: number; feeDue: number; feeTotal: number;
    pendingHomework: number; upcomingExams: number; totalAttendanceDays: number;
    presentDays: number; absentDays: number;
  };
  myAttendanceTrend: { date: string; status: string; day: string }[];
  myExamResults: { subject: string; examName: string; marks: number; maxMarks: number; grade: string }[];
  myHomework: { id: string; title: string; subject: string; dueDate: string; description: string | null }[];
  myTimetableToday: { period: number; subject: string; teacher: string; startTime: string; endTime: string }[];
  myFees: { total: number; paid: number; due: number; status: string };
  recentNotices: { id: string; title: string; content: string; date: string }[];
}

type DashboardData = AdminData | TeacherData | StudentData;

const PIE_COLORS = ["oklch(0.55 0.20 265)", "oklch(0.65 0.15 305)", "oklch(0.70 0.18 75)"];
const ATTENDANCE_COLORS: Record<string, string> = {
  present: "oklch(0.65 0.17 162)",
  absent: "oklch(0.65 0.22 25)",
  late: "oklch(0.75 0.18 75)",
  leave: "oklch(0.60 0.15 250)",
  halfday: "oklch(0.60 0.18 305)",
  no_data: "oklch(0.85 0.01 260)",
};

export function DashboardModule() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("erp_user_id") : null;
    fetch("/api/dashboard", {
      headers: userId ? { "x-user-id": userId } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!d || !d.role) throw new Error("Invalid data");
        setData(d);
      })
      .catch(() => { setData(null); })
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Card key={i} className="h-80 animate-pulse bg-muted/40" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
          <AlertCircle className="w-10 h-10 text-amber-500" />
        </div>
        <h3 className="text-lg font-semibold mb-1.5">Dashboard data unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">
          Unable to load dashboard data. Please try refreshing the page.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>
    );
  }

  // Render based on role
  if (data.role === "admin") return <AdminDashboard data={data} userName={user.name} />;
  if (data.role === "teacher") return <TeacherDashboard data={data} />;
  return <StudentDashboard data={data} />;
}

// ==================== ADMIN DASHBOARD ====================
function AdminDashboard({ data, userName }: { data: AdminData; userName: string }) {
  const { stats } = data;
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <GreetingHeader name={userName} roleLabel="Admin Portal" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Students" value={stats.students} icon={Users} trend={5.2} trendLabel="vs last month" delay={0} />
        <StatsCard title="Teaching & Staff" value={stats.staff} icon={GraduationCap} trend={2.1} trendLabel="vs last month" delay={0.1} />
        <StatsCard title="Fee Collected" value={formatCurrency(stats.totalFeeCollected)} icon={Wallet} trend={8.4} trendLabel="vs last month" delay={0.2} />
        <StatsCard title="Today's Attendance" value={`${stats.todayAttendanceRate}%`} icon={CalendarCheck} trend={1.3} trendLabel="vs yesterday" delay={0.3} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold">Attendance Trend</h3><p className="text-xs text-muted-foreground">Last 7 days</p></div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">{stats.todayAttendanceRate}% today</Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.attendanceTrend}>
              <defs>
                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.20 265)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.55 0.20 265)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} />
              <Area type="monotone" dataKey="present" stroke="oklch(0.55 0.20 265)" strokeWidth={2} fill="url(#colorPresent)" name="Present" />
              <Area type="monotone" dataKey="absent" stroke="oklch(0.65 0.22 25)" strokeWidth={2} fill="url(#colorAbsent)" name="Absent" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-1">Gender Distribution</h3>
          <p className="text-xs text-muted-foreground mb-4">Active students</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.genderDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.genderDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {data.genderDistribution.map((g, i) => (
              <div key={g.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{g.name}</span>
                </div>
                <span className="font-medium">{g.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold">Fee Collection Trend</h3><p className="text-xs text-muted-foreground">Last 6 months</p></div>
            <div className="flex gap-4 text-xs">
              <div><div className="text-muted-foreground">Collected</div><div className="font-semibold text-emerald-600">{formatCurrency(data.feeTrend.reduce((s, f) => s + f.collected, 0))}</div></div>
              <div><div className="text-muted-foreground">Pending</div><div className="font-semibold text-red-500">{formatCurrency(stats.totalFeeDue)}</div></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.feeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="collected" fill="oklch(0.55 0.20 265)" radius={[6, 6, 0, 0]} name="Collected" />
              <Bar dataKey="expected" fill="oklch(0.80 0.03 265)" radius={[6, 6, 0, 0]} name="Expected" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {data.examPerformance.length > 0 && (
          <Card className="glass-card p-5">
            <h3 className="font-semibold mb-1">Exam Performance</h3>
            <p className="text-xs text-muted-foreground mb-4 truncate">{data.latestExamName}</p>
            <ResponsiveContainer width="100%" height={260}>
              <RadialBarChart data={data.examPerformance.map((p, i) => ({ name: p.subject, value: p.avgMarks, fill: PIE_COLORS[i % PIE_COLORS.length] }))} innerRadius="20%" outerRadius="100%" startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="value" cornerRadius={6} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} formatter={(v: number) => `${v}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
              {data.examPerformance.map((p, i) => (
                <div key={p.subject} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="text-muted-foreground truncate">{p.subject}</span></div>
                  <span className="font-medium">{p.avgMarks}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="glass-card p-4"><div className="flex items-center gap-2 mb-1"><BookOpen className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Library Books</span></div><div className="text-xl font-bold">{stats.books}</div></Card>
          <Card className="glass-card p-4"><div className="flex items-center gap-2 mb-1"><Bus className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Vehicles</span></div><div className="text-xl font-bold">{stats.vehicles}</div></Card>
          <Card className="glass-card p-4"><div className="flex items-center gap-2 mb-1"><Megaphone className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Notices</span></div><div className="text-xl font-bold">{stats.notices}</div></Card>
          <Card className="glass-card p-4"><div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-muted-foreground">Fee Defaulters</span></div><div className="text-xl font-bold text-red-500">{stats.feeDefaulters}</div></Card>
        </div>

        <Card className="glass-card p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" />Recent Notices</h3><ArrowUpRight className="w-4 h-4 text-muted-foreground" /></div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentNotices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No notices yet</p> : data.recentNotices.map((n) => (
              <div key={n.id} className="pb-3 border-b last:border-0 last:pb-0"><div className="flex items-start justify-between gap-2"><h4 className="text-sm font-medium line-clamp-1">{n.title}</h4><span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.date)}</span></div><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p></div>
            ))}
          </div>
        </Card>

        <Card className="glass-card p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Recent Admissions</h3><ArrowUpRight className="w-4 h-4 text-muted-foreground" /></div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentStudents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No students yet</p> : data.recentStudents.map((s) => (
              <div key={s.id} className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{getInitials(`${s.firstName} ${s.lastName}`)}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{s.firstName} {s.lastName}</div><div className="text-xs text-muted-foreground">{s.admissionNumber} • {s.class?.name || "—"}</div></div><span className="text-[10px] text-muted-foreground shrink-0">{formatDate(s.createdAt)}</span></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ==================== TEACHER DASHBOARD ====================
function TeacherDashboard({ data }: { data: TeacherData }) {
  const { stats } = data;
  return (
    <div className="space-y-6">
      <GreetingHeader name={data.teacherName} roleLabel="Teacher Portal" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="My Classes" value={stats.myClasses} icon={BookOpen} delay={0} />
        <StatsCard title="My Students" value={stats.myStudents} icon={Users} delay={0.1} />
        <StatsCard title="Homework Posted" value={stats.homeworkPosted} icon={ClipboardList} delay={0.2} />
        <StatsCard title="Today's Periods" value={stats.todayPeriods} icon={Clock} delay={0.3} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-1">My Attendance Marking</h3>
          <p className="text-xs text-muted-foreground mb-4">Last 7 days</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.attendanceMarkingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} />
              <Bar dataKey="present" fill="oklch(0.55 0.20 265)" radius={[6, 6, 0, 0]} name="Present" />
              <Bar dataKey="absent" fill="oklch(0.65 0.22 25)" radius={[6, 6, 0, 0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-1">My Classes Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">Average marks by subject</p>
          {data.myClassesPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.myClassesPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
                <YAxis dataKey="subject" type="category" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" width={90} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} />
                <Bar dataKey="avgMarks" fill="oklch(0.55 0.20 265)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-primary" />Today's Timetable</h3>
          {data.myTimetableToday.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.myTimetableToday.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">{s.period}</div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium">{s.subject}</div><div className="text-xs text-muted-foreground">{s.class}</div></div>
                  <div className="text-xs text-muted-foreground shrink-0">{s.startTime} - {s.endTime}</div>
                </div>
              ))}
            </div>
          ) : <EmptyText text="No classes scheduled today" />}
        </Card>

        <Card className="glass-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4 text-primary" />My Recent Homework</h3>
          {data.myHomework.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.myHomework.map((h) => (
                <div key={h.id} className="pb-3 border-b last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-medium line-clamp-1">{h.title}</h4><span className="text-[10px] text-muted-foreground shrink-0">{formatDate(h.dueDate)}</span></div>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.class} • {h.subject}</p>
                </div>
              ))}
            </div>
          ) : <EmptyText text="No homework posted yet" />}
        </Card>
      </div>

      <Card className="glass-card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Megaphone className="w-4 h-4 text-primary" />Recent Notices</h3>
        {data.recentNotices.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentNotices.map((n) => (
              <div key={n.id} className="pb-3 border-b last:border-0 last:pb-0"><div className="flex items-start justify-between gap-2"><h4 className="text-sm font-medium line-clamp-1">{n.title}</h4><span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.date)}</span></div><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p></div>
            ))}
          </div>
        ) : <EmptyText text="No notices yet" />}
      </Card>
    </div>
  );
}

// ==================== STUDENT / PARENT DASHBOARD ====================
function StudentDashboard({ data }: { data: StudentData }) {
  const { stats, studentInfo } = data;
  const isParent = data.role === "parent";
  const greetingName = isParent ? studentInfo.name : data.viewerName;
  const greetingText = isParent ? `Your child ${studentInfo.name}'s progress` : `${getGreeting()}, ${greetingName}`;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greetingText} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {studentInfo.className} - Section {studentInfo.sectionName} • Admission: {studentInfo.admissionNumber}
          </p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />{isParent ? "Parent Portal" : "Student Portal"}</Badge>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={isParent ? "Child's Attendance" : "My Attendance"} value={`${stats.attendancePercent}%`} icon={CalendarCheck} trendLabel={`${stats.presentDays} present, ${stats.absentDays} absent`} delay={0} />
        <StatsCard title="Fee Paid" value={formatCurrency(stats.feePaid)} icon={Wallet} trendLabel={`Due: ${formatCurrency(stats.feeDue)}`} delay={0.1} />
        <StatsCard title="Pending Homework" value={stats.pendingHomework} icon={ClipboardList} delay={0.2} />
        <StatsCard title="Upcoming Exams" value={stats.upcomingExams} icon={FileText} delay={0.3} />
      </div>

      {/* Attendance trend */}
      <Card className="glass-card p-5">
        <h3 className="font-semibold mb-1">{isParent ? "Child's Attendance" : "My Attendance"}</h3>
        <p className="text-xs text-muted-foreground mb-4">Last 30 days</p>
        {/* Calendar-style grid */}
        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5 mb-4">
          {data.myAttendanceTrend.map((day, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.01 }}
              className="aspect-square rounded-md flex items-center justify-center text-[8px] font-medium"
              style={{ background: ATTENDANCE_COLORS[day.status] || ATTENDANCE_COLORS.no_data, color: day.status === "no_data" ? "oklch(0.52 0.02 260)" : "white" }}
              title={`${day.day}: ${day.status}`}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { label: "Present", color: ATTENDANCE_COLORS.present },
            { label: "Absent", color: ATTENDANCE_COLORS.absent },
            { label: "Late", color: ATTENDANCE_COLORS.late },
            { label: "Leave", color: ATTENDANCE_COLORS.leave },
            { label: "No data", color: ATTENDANCE_COLORS.no_data },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: l.color }} /><span className="text-muted-foreground">{l.label}</span></div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Exam results */}
        <Card className="glass-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-primary" />{isParent ? "Child's Exam Results" : "My Exam Results"}</h3>
          {data.myExamResults.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.myExamResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                  <div className="min-w-0"><div className="text-sm font-medium truncate">{r.subject}</div><div className="text-xs text-muted-foreground">{r.examName}</div></div>
                  <div className="flex items-center gap-3 shrink-0"><div className="text-right"><div className="text-sm font-bold">{r.marks}/{r.maxMarks}</div><div className="text-xs text-muted-foreground">{r.grade}</div></div><Badge variant="outline" className={r.marks >= 33 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}>{r.marks >= 33 ? "Pass" : "Fail"}</Badge></div>
                </div>
              ))}
            </div>
          ) : <EmptyText text="No exam results yet" />}
        </Card>

        {/* Today's timetable */}
        <Card className="glass-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-primary" />Today's Timetable</h3>
          {data.myTimetableToday.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.myTimetableToday.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">{s.period}</div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium">{s.subject}</div><div className="text-xs text-muted-foreground">{s.teacher}</div></div>
                  <div className="text-xs text-muted-foreground shrink-0">{s.startTime} - {s.endTime}</div>
                </div>
              ))}
            </div>
          ) : <EmptyText text="No classes today" />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Fee details */}
        <Card className="glass-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Wallet className="w-4 h-4 text-primary" />Fee Details</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40"><span className="text-sm text-muted-foreground">Total Fee</span><span className="text-sm font-bold">{formatCurrency(data.myFees.total)}</span></div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10"><span className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Paid</span><span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(data.myFees.paid)}</span></div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10"><span className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Due</span><span className="text-sm font-bold text-red-700 dark:text-red-400">{formatCurrency(data.myFees.due)}</span></div>
            <div className="flex items-center justify-between pt-2"><span className="text-sm font-medium">Status</span><Badge variant="outline" className={STATUS_COLORS[data.myFees.status] || "bg-muted"}>{data.myFees.status.charAt(0).toUpperCase() + data.myFees.status.slice(1)}</Badge></div>
          </div>
        </Card>

        {/* Homework */}
        <Card className="glass-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4 text-primary" />{isParent ? "Child's Homework" : "My Homework"}</h3>
          {data.myHomework.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.myHomework.map((h) => {
                const isOverdue = new Date(h.dueDate) < new Date();
                return (
                  <div key={h.id} className="pb-3 border-b last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-medium line-clamp-1">{h.title}</h4><Badge variant="outline" className={isOverdue ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}>{isOverdue ? "Overdue" : "Pending"}</Badge></div>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.subject} • Due {formatDate(h.dueDate)}</p>
                  </div>
                );
              })}
            </div>
          ) : <EmptyText text="No homework assigned" />}
        </Card>
      </div>

      {/* Notices */}
      <Card className="glass-card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Megaphone className="w-4 h-4 text-primary" />Recent Notices</h3>
        {data.recentNotices.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentNotices.map((n) => (
              <div key={n.id} className="pb-3 border-b last:border-0 last:pb-0"><div className="flex items-start justify-between gap-2"><h4 className="text-sm font-medium line-clamp-1">{n.title}</h4><span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.date)}</span></div><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p></div>
            ))}
          </div>
        ) : <EmptyText text="No notices yet" />}
      </Card>
    </div>
  );
}

// ==================== Shared helpers ====================
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function GreetingHeader({ name, roleLabel }: { name: string; roleLabel: string }) {
  const greeting = getGreeting();
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}, {name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's what's happening at Greenwood International School today.</p>
      </div>
      <Badge variant="outline" className="w-fit px-3 py-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />{roleLabel}</Badge>
    </motion.div>
  );
}

function EmptyChart() {
  return <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>;
}

function EmptyText({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
