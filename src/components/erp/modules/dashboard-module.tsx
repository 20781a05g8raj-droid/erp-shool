"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
} from "recharts";
import {
  Users, GraduationCap, Wallet, CalendarCheck, BookOpen,
  Bus, Megaphone, AlertCircle, FileText, Clock, RefreshCw,
  ClipboardList, CheckCircle2, AlertTriangle, TrendingDown, Sparkles,
  Trophy, BarChart3, Activity, TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

// ==================== Color Configs ====================
const CARD_CONFIGS = [
  { gradient: "from-violet-600 via-purple-600 to-indigo-700", glow: "rgba(139,92,246,0.35)", text: "text-violet-600 dark:text-violet-400", border: "border-violet-200/60 dark:border-violet-500/20" },
  { gradient: "from-cyan-500 via-teal-500 to-emerald-600", glow: "rgba(6,182,212,0.35)", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-200/60 dark:border-cyan-500/20" },
  { gradient: "from-orange-500 via-amber-500 to-yellow-500", glow: "rgba(249,115,22,0.35)", text: "text-orange-600 dark:text-orange-400", border: "border-orange-200/60 dark:border-orange-500/20" },
  { gradient: "from-pink-500 via-rose-500 to-red-500", glow: "rgba(236,72,153,0.35)", text: "text-pink-600 dark:text-pink-400", border: "border-pink-200/60 dark:border-pink-500/20" },
];
const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#f97316"];
const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#10b981", absent: "#ef4444", late: "#f59e0b", leave: "#6366f1", halfday: "#ec4899", no_data: "#e2e8f0",
};

// ==================== Animated Number ====================
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number | string; prefix?: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const isNumeric = typeof value === "number";
  useEffect(() => {
    if (!isNumeric) return;
    const num = value as number;
    let current = 0;
    const steps = 40;
    const increment = num / steps;
    const timer = setInterval(() => {
      current += increment;
      if (current >= num) { setDisplayed(num); clearInterval(timer); }
      else setDisplayed(Math.floor(current));
    }, 900 / steps);
    return () => clearInterval(timer);
  }, [value, isNumeric]);
  if (!isNumeric) return <span>{value}</span>;
  return <span>{prefix}{displayed.toLocaleString()}{suffix}</span>;
}

// ==================== Live Clock ====================
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="text-right hidden sm:block">
      <div className="text-2xl font-black tabular-nums text-white drop-shadow-lg">
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="text-xs text-white/70">{time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
    </div>
  );
}

// ==================== Colorful Stats Card ====================
function ColorStatsCard({ title, value, icon: Icon, trend, trendLabel, colorIdx = 0, delay = 0, prefix = "", suffix = "" }: {
  title: string; value: string | number; icon: React.ElementType; trend?: number; trendLabel?: string;
  colorIdx?: number; delay?: number; prefix?: string; suffix?: string;
}) {
  const cfg = CARD_CONFIGS[colorIdx % CARD_CONFIGS.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="group"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border ${cfg.border} bg-white dark:bg-slate-900/60 p-5 transition-all duration-300`}
        style={{ boxShadow: `0 4px 24px -4px ${cfg.glow}, 0 1px 4px rgba(0,0,0,0.06)` }}
      >
        <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br ${cfg.gradient} opacity-10 group-hover:opacity-25 blur-2xl transition-opacity duration-500`} />
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
            style={{ boxShadow: `0 4px 14px ${cfg.glow}` }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${trend >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className={`text-[30px] font-black tracking-tight tabular-nums ${cfg.text}`}>
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
          </div>
          <div className="text-sm font-semibold text-foreground/80">{title}</div>
          {trendLabel && <div className="text-xs text-muted-foreground pt-0.5">{trendLabel}</div>}
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cfg.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />
      </div>
    </motion.div>
  );
}

// ==================== Greeting Banner ====================
function GreetingBanner({ name, roleLabel, subtitle, gradientClass }: { name: string; roleLabel: string; subtitle?: string; gradientClass: string }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const emoji = h < 12 ? "🌅" : h < 17 ? "☀️" : "🌙";
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl p-6 ${gradientClass}`}
    >
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/10"
            style={{ width: `${40 + i * 18}px`, height: `${40 + i * 18}px`, left: `${(i * 17 + 5) % 90}%`, top: `${(i * 23 + 10) % 80}%` }}
            animate={{ y: [0, -12, 0], x: [0, i % 2 === 0 ? 8 : -8, 0], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
        ))}
      </div>
      <motion.div
        className="absolute top-4 right-16 text-yellow-300/70"
        animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 0.9, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <Sparkles className="w-6 h-6" />
      </motion.div>
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{emoji}</span>
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />{roleLabel}
            </Badge>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">{greeting}, {name.split(" ")[0]}!</h1>
          <p className="text-white/70 mt-1 text-sm">{subtitle || "Here's what's happening at Greenwood International School today."}</p>
        </div>
        <LiveClock />
      </div>
    </motion.div>
  );
}

// ==================== Section Header ====================
function SectionHeader({ icon: Icon, title, subtitle, badge, iconGradient = "from-violet-500 to-indigo-600" }: {
  icon: React.ElementType; title: string; subtitle?: string; badge?: string; iconGradient?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-md`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200/60 dark:border-violet-500/20">
          {badge}
        </Badge>
      )}
    </div>
  );
}

// ==================== Chart Card ====================
function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      <Card className="glass-card p-5 rounded-2xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/3 via-transparent to-indigo-500/3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        {children}
      </Card>
    </motion.div>
  );
}

// ==================== Mini Stat Card ====================
function MiniStatCard({ icon: Icon, label, value, gradient = "from-violet-500 to-indigo-600", border = "border-violet-200/60 dark:border-violet-500/20", glow = "rgba(139,92,246,0.2)" }: {
  icon: React.ElementType; label: string; value: string | number;
  gradient?: string; border?: string; glow?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.04, y: -2 }} transition={{ duration: 0.35 }}>
      <Card
        className={`p-4 rounded-xl border ${border} bg-white/80 dark:bg-slate-900/50 hover:shadow-lg transition-all duration-300 overflow-hidden relative group`}
        style={{ boxShadow: `0 2px 12px -2px ${glow}` }}
      >
        <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 blur-xl transition-opacity`} />
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <div className="text-2xl font-black tabular-nums">{value}</div>
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient} opacity-50 group-hover:opacity-100 transition-opacity`} />
      </Card>
    </motion.div>
  );
}

// ==================== MAIN DASHBOARD ====================
export function DashboardModule() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("erp_user_id") : null;
    fetch("/api/dashboard", { headers: userId ? { "x-user-id": userId } : {} })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!d || !d.role) throw new Error("Invalid data"); setData(d); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-36 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/20 to-indigo-500/20 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse"
              style={{ background: ["rgba(139,92,246,0.12)", "rgba(6,182,212,0.12)", "rgba(249,115,22,0.12)", "rgba(236,72,153,0.12)"][i] }} />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-80 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg"
        >
          <AlertCircle className="w-10 h-10 text-white" />
        </motion.div>
        <h3 className="text-lg font-bold mb-1.5">Dashboard data unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">Unable to load dashboard data. Please try refreshing the page.</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>
    );
  }

  if (data.role === "admin") return <AdminDashboard data={data} userName={user.name} />;
  if (data.role === "teacher") return <TeacherDashboard data={data} />;
  return <StudentDashboard data={data} />;
}

// ==================== ADMIN DASHBOARD ====================
function AdminDashboard({ data, userName }: { data: AdminData; userName: string }) {
  const { stats } = data;
  return (
    <div className="space-y-6">
      <GreetingBanner name={userName} roleLabel="Admin Portal" gradientClass="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ColorStatsCard title="Total Students" value={stats.students} icon={Users} trend={5.2} trendLabel="vs last month" colorIdx={0} delay={0.05} />
        <ColorStatsCard title="Teaching & Staff" value={stats.staff} icon={GraduationCap} trend={2.1} trendLabel="vs last month" colorIdx={1} delay={0.1} />
        <ColorStatsCard title="Fee Collected" value={stats.totalFeeCollected} icon={Wallet} trend={8.4} trendLabel="vs last month" colorIdx={2} delay={0.15} prefix="&#8377;" />
        <ColorStatsCard title="Today's Attendance" value={stats.todayAttendanceRate} icon={CalendarCheck} trend={1.3} trendLabel="vs yesterday" colorIdx={3} delay={0.2} suffix="%" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="lg:col-span-2">
          <Card className="glass-card p-5 rounded-2xl">
            <SectionHeader icon={Activity} title="Attendance Trend" subtitle="Last 7 days" badge={`${stats.todayAttendanceRate}% today`} />
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.attendanceTrend}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.95)", fontSize: 12 }} />
                <Area type="monotone" dataKey="present" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#presentGrad)" name="Present" dot={{ fill: "#8b5cf6", r: 3 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2.5} fill="url(#absentGrad)" name="Absent" dot={{ fill: "#ef4444", r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
        <ChartCard>
          <SectionHeader icon={Users} title="Gender Distribution" subtitle="Active students" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.genderDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                {data.genderDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.95)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {data.genderDistribution.map((g, i) => (
              <div key={g.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{g.name}</span>
                </div>
                <span className="font-bold">{g.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="lg:col-span-2">
          <Card className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Fee Collection Trend</h3>
                  <p className="text-xs text-muted-foreground">Last 6 months</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="text-right">
                  <div className="text-muted-foreground">Collected</div>
                  <div className="font-bold text-emerald-600">{formatCurrency(data.feeTrend.reduce((s, f) => s + f.collected, 0))}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Pending</div>
                  <div className="font-bold text-red-500">{formatCurrency(stats.totalFeeDue)}</div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.feeTrend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.95)", fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="collected" fill="#10b981" radius={[6, 6, 0, 0]} name="Collected" />
                <Bar dataKey="expected" fill="#e2e8f0" radius={[6, 6, 0, 0]} name="Expected" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
        {data.examPerformance.length > 0 ? (
          <ChartCard>
            <SectionHeader icon={Trophy} title="Exam Performance" subtitle={data.latestExamName || "Latest exam"} iconGradient="from-amber-500 to-orange-600" />
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart
                data={data.examPerformance.map((p, i) => ({ name: p.subject, value: p.avgMarks, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
                innerRadius="20%" outerRadius="100%" startAngle={90} endAngle={-270}
              >
                <RadialBar background dataKey="value" cornerRadius={6} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.95)", fontSize: 12 }} formatter={(v: number) => `${v}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-1 max-h-24 overflow-y-auto">
              {data.examPerformance.map((p, i) => (
                <div key={p.subject} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground truncate">{p.subject}</span>
                  </div>
                  <span className="font-bold">{p.avgMarks}%</span>
                </div>
              ))}
            </div>
          </ChartCard>
        ) : (
          <div className="space-y-3">
            <MiniStatCard icon={BookOpen} label="Library Books" value={stats.books} gradient="from-cyan-500 to-teal-600" border="border-cyan-200/60 dark:border-cyan-500/20" glow="rgba(6,182,212,0.2)" />
            <MiniStatCard icon={Bus} label="Vehicles" value={stats.vehicles} gradient="from-orange-500 to-amber-500" border="border-orange-200/60 dark:border-orange-500/20" glow="rgba(249,115,22,0.2)" />
            <MiniStatCard icon={Megaphone} label="Notices" value={stats.notices} gradient="from-violet-500 to-indigo-600" border="border-violet-200/60 dark:border-violet-500/20" glow="rgba(139,92,246,0.2)" />
            <MiniStatCard icon={AlertCircle} label="Fee Defaulters" value={stats.feeDefaulters} gradient="from-red-500 to-rose-600" border="border-red-200/60 dark:border-red-500/20" glow="rgba(239,68,68,0.2)" />
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <MiniStatCard icon={BookOpen} label="Library Books" value={stats.books} gradient="from-cyan-500 to-teal-600" border="border-cyan-200/60 dark:border-cyan-500/20" glow="rgba(6,182,212,0.2)" />
          <MiniStatCard icon={Bus} label="Vehicles" value={stats.vehicles} gradient="from-orange-500 to-amber-500" border="border-orange-200/60 dark:border-orange-500/20" glow="rgba(249,115,22,0.2)" />
          <MiniStatCard icon={Megaphone} label="Notices" value={stats.notices} gradient="from-violet-500 to-indigo-600" border="border-violet-200/60 dark:border-violet-500/20" glow="rgba(139,92,246,0.2)" />
          <MiniStatCard icon={AlertCircle} label="Fee Defaulters" value={stats.feeDefaulters} gradient="from-red-500 to-rose-600" border="border-red-200/60 dark:border-red-500/20" glow="rgba(239,68,68,0.2)" />
        </div>
        <ChartCard>
          <SectionHeader icon={Megaphone} title="Recent Notices" iconGradient="from-rose-500 to-pink-600" />
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {data.recentNotices.length === 0 ? (
              <EmptyText text="No notices yet" />
            ) : data.recentNotices.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="pb-3 border-b last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold line-clamp-1">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground shrink-0 bg-muted rounded px-1.5 py-0.5">{formatDate(n.date)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p>
              </motion.div>
            ))}
          </div>
        </ChartCard>
        <ChartCard>
          <SectionHeader icon={Users} title="Recent Admissions" iconGradient="from-emerald-500 to-teal-600" />
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {data.recentStudents.length === 0 ? (
              <EmptyText text="No students yet" />
            ) : data.recentStudents.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[11px] font-bold">
                    {getInitials(`${s.firstName} ${s.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.firstName} {s.lastName}</div>
                  <div className="text-xs text-muted-foreground">{s.admissionNumber} • {s.class?.name || "—"}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 bg-muted rounded px-1.5 py-0.5">{formatDate(s.createdAt)}</span>
              </motion.div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ==================== TEACHER DASHBOARD ====================
function TeacherDashboard({ data }: { data: TeacherData }) {
  const { stats } = data;
  return (
    <div className="space-y-6">
      <GreetingBanner name={data.teacherName} roleLabel="Teacher Portal" subtitle="Manage your classes, homework and schedule." gradientClass="bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ColorStatsCard title="My Classes" value={stats.myClasses} icon={BookOpen} colorIdx={0} delay={0.05} />
        <ColorStatsCard title="My Students" value={stats.myStudents} icon={Users} colorIdx={1} delay={0.1} />
        <ColorStatsCard title="Homework Posted" value={stats.homeworkPosted} icon={ClipboardList} colorIdx={2} delay={0.15} />
        <ColorStatsCard title="Today's Periods" value={stats.todayPeriods} icon={Clock} colorIdx={3} delay={0.2} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard>
          <SectionHeader icon={Activity} title="Attendance Marking" subtitle="Last 7 days" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.attendanceMarkingTrend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.95)", fontSize: 12 }} />
              <Bar dataKey="present" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Present" />
              <Bar dataKey="absent" fill="#ef4444" radius={[6, 6, 0, 0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard>
          <SectionHeader icon={Trophy} title="Class Performance" subtitle="Average marks by subject" iconGradient="from-amber-500 to-orange-600" />
          {data.myClassesPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.myClassesPerformance} layout="vertical" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" />
                <YAxis dataKey="subject" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="transparent" width={90} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.95)", fontSize: 12 }} />
                <Bar dataKey="avgMarks" fill="#06b6d4" radius={[0, 6, 6, 0]} name="Avg Marks" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard>
          <SectionHeader icon={Clock} title="Today's Timetable" />
          {data.myTimetableToday.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.myTimetableToday.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/5 to-indigo-500/5 border border-violet-200/30 dark:border-violet-500/10 hover:from-violet-500/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-lg">{s.period}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{s.subject}</div>
                    <div className="text-xs text-muted-foreground">{s.class}</div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground shrink-0 bg-muted rounded-lg px-2 py-1">{s.startTime}–{s.endTime}</div>
                </motion.div>
              ))}
            </div>
          ) : <EmptyText text="No classes scheduled today" />}
        </ChartCard>
        <ChartCard>
          <SectionHeader icon={ClipboardList} title="Recent Homework" iconGradient="from-orange-500 to-amber-500" />
          {data.myHomework.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.myHomework.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="pb-3 border-b last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold line-clamp-1">{h.title}</h4>
                    <span className="text-[10px] text-muted-foreground shrink-0 bg-muted rounded px-1.5 py-0.5">{formatDate(h.dueDate)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.class} • {h.subject}</p>
                </motion.div>
              ))}
            </div>
          ) : <EmptyText text="No homework posted yet" />}
        </ChartCard>
      </div>
      <ChartCard>
        <SectionHeader icon={Megaphone} title="Recent Notices" iconGradient="from-rose-500 to-pink-600" />
        {data.recentNotices.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {data.recentNotices.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="p-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold line-clamp-1">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.date)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
              </motion.div>
            ))}
          </div>
        ) : <EmptyText text="No notices yet" />}
      </ChartCard>
    </div>
  );
}

// ==================== STUDENT / PARENT DASHBOARD ====================
function StudentDashboard({ data }: { data: StudentData }) {
  const { stats, studentInfo } = data;
  const isParent = data.role === "parent";
  return (
    <div className="space-y-6">
      <GreetingBanner
        name={isParent ? studentInfo.name : data.viewerName}
        roleLabel={isParent ? "Parent Portal" : "Student Portal"}
        subtitle={isParent ? `Your child ${studentInfo.name}'s progress overview` : `${studentInfo.className} – Section ${studentInfo.sectionName} • Admission: ${studentInfo.admissionNumber}`}
        gradientClass="bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ColorStatsCard title={isParent ? "Child's Attendance" : "Attendance"} value={stats.attendancePercent} icon={CalendarCheck} trendLabel={`${stats.presentDays} present, ${stats.absentDays} absent`} colorIdx={0} delay={0.05} suffix="%" />
        <ColorStatsCard title="Fee Paid" value={stats.feePaid} icon={Wallet} trendLabel={`Due: ${stats.feeDue.toLocaleString()}`} colorIdx={1} delay={0.1} prefix="&#8377;" />
        <ColorStatsCard title="Pending Homework" value={stats.pendingHomework} icon={ClipboardList} colorIdx={2} delay={0.15} />
        <ColorStatsCard title="Upcoming Exams" value={stats.upcomingExams} icon={FileText} colorIdx={3} delay={0.2} />
      </div>

      <ChartCard>
        <SectionHeader icon={CalendarCheck} title={isParent ? "Child's Attendance" : "My Attendance"} subtitle="Last 30 days" iconGradient="from-cyan-500 to-teal-600" />
        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5 mb-4">
          {data.myAttendanceTrend.map((day, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.012, duration: 0.3 }}
              className="aspect-square rounded-md" style={{ background: ATTENDANCE_COLORS[day.status] || ATTENDANCE_COLORS.no_data }} title={`${day.day}: ${day.status}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {[{ label: "Present", color: ATTENDANCE_COLORS.present }, { label: "Absent", color: ATTENDANCE_COLORS.absent }, { label: "Late", color: ATTENDANCE_COLORS.late }, { label: "Leave", color: ATTENDANCE_COLORS.leave }, { label: "No data", color: ATTENDANCE_COLORS.no_data }].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm shadow-sm" style={{ background: l.color }} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard>
          <SectionHeader icon={Trophy} title={isParent ? "Child's Exam Results" : "My Exam Results"} iconGradient="from-amber-500 to-orange-600" />
          {data.myExamResults.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.myExamResults.map((r, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-200/20 dark:border-amber-500/10 hover:from-amber-500/10 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.subject}</div>
                    <div className="text-xs text-muted-foreground">{r.examName}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black">{r.marks}/{r.maxMarks}</div>
                      <div className="text-xs text-muted-foreground">{r.grade}</div>
                    </div>
                    <Badge variant="outline" className={r.marks >= 33 ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/60" : "bg-red-500/10 text-red-600 border-red-200/60"}>
                      {r.marks >= 33 ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : <EmptyText text="No exam results yet" />}
        </ChartCard>
        <ChartCard>
          <SectionHeader icon={Clock} title="Today's Timetable" iconGradient="from-violet-500 to-indigo-600" />
          {data.myTimetableToday.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.myTimetableToday.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/5 to-teal-500/5 border border-cyan-200/30 dark:border-cyan-500/10 hover:from-cyan-500/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-lg">{s.period}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{s.subject}</div>
                    <div className="text-xs text-muted-foreground">{s.teacher}</div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground shrink-0 bg-muted rounded-lg px-2 py-1">{s.startTime}–{s.endTime}</div>
                </motion.div>
              ))}
            </div>
          ) : <EmptyText text="No classes today" />}
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard>
          <SectionHeader icon={Wallet} title="Fee Details" iconGradient="from-emerald-500 to-teal-600" />
          <div className="space-y-3">
            <div className="rounded-xl p-4 bg-gradient-to-r from-violet-500/10 to-indigo-500/5 border border-violet-200/30 dark:border-violet-500/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Total Fee</span>
                <span className="text-lg font-black">{formatCurrency(data.myFees.total)}</span>
              </div>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-200/30 dark:border-emerald-500/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Paid
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(data.myFees.paid)}</span>
              </div>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-r from-red-500/10 to-rose-500/5 border border-red-200/30 dark:border-red-500/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Due
                </span>
                <span className="text-lg font-black text-red-700 dark:text-red-400">{formatCurrency(data.myFees.due)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold">Status</span>
              <Badge variant="outline" className={STATUS_COLORS[data.myFees.status] || "bg-muted"}>
                {data.myFees.status.charAt(0).toUpperCase() + data.myFees.status.slice(1)}
              </Badge>
            </div>
          </div>
        </ChartCard>
        <ChartCard>
          <SectionHeader icon={ClipboardList} title={isParent ? "Child's Homework" : "My Homework"} iconGradient="from-orange-500 to-amber-500" />
          {data.myHomework.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.myHomework.map((h, i) => {
                const isOverdue = new Date(h.dueDate) < new Date();
                return (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="pb-3 border-b last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold line-clamp-1">{h.title}</h4>
                      <Badge variant="outline" className={isOverdue ? "bg-red-500/10 text-red-600 border-red-200/60 text-[10px]" : "bg-amber-500/10 text-amber-600 border-amber-200/60 text-[10px]"}>
                        {isOverdue ? "Overdue" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.subject} • Due {formatDate(h.dueDate)}</p>
                  </motion.div>
                );
              })}
            </div>
          ) : <EmptyText text="No homework assigned" />}
        </ChartCard>
      </div>

      <ChartCard>
        <SectionHeader icon={Megaphone} title="Recent Notices" iconGradient="from-rose-500 to-pink-600" />
        {data.recentNotices.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {data.recentNotices.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="p-3 rounded-xl border border-border/50 bg-gradient-to-br from-muted/40 to-transparent hover:from-muted/70 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold line-clamp-1">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.date)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
              </motion.div>
            ))}
          </div>
        ) : <EmptyText text="No notices yet" />}
      </ChartCard>
    </div>
  );
}

// ==================== Helpers ====================
function EmptyChart() {
  return <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>;
}
function EmptyText({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
