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
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { StatsCard } from "@/components/erp/stats-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/types";
import { formatCurrency, formatDate, getInitials } from "@/lib/api";

interface DashboardData {
  stats: {
    students: number;
    staff: number;
    classes: number;
    books: number;
    vehicles: number;
    routes: number;
    notices: number;
    exams: number;
    homework: number;
    feeDefaulters: number;
    totalFeeExpected: number;
    totalFeeCollected: number;
    totalFeeDue: number;
    todayAttendanceRate: number;
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

const PIE_COLORS = ["oklch(0.55 0.20 265)", "oklch(0.65 0.15 305)", "oklch(0.70 0.18 75)"];

export function DashboardModule() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!d || !d.stats) throw new Error("Invalid data");
        setData(d);
      })
      .catch(() => {
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-80 animate-pulse bg-muted/40" />
          ))}
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
          {user.role === "super_admin"
            ? "Super Admin doesn't have a school-specific dashboard. Use the Schools module to manage all schools on the platform."
            : "Unable to load dashboard data. Please try refreshing the page."}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  const { stats } = data;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening at Greenwood International School today.
          </p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          {ROLE_LABELS[user.role]} Portal
        </Badge>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Students" value={stats.students} icon={Users} trend={5.2} trendLabel="vs last month" delay={0} />
        <StatsCard title="Teaching & Staff" value={stats.staff} icon={GraduationCap} trend={2.1} trendLabel="vs last month" delay={0.1} />
        <StatsCard title="Fee Collected" value={formatCurrency(stats.totalFeeCollected)} icon={Wallet} trend={8.4} trendLabel="vs last month" delay={0.2} />
        <StatsCard title="Today's Attendance" value={`${stats.todayAttendanceRate}%`} icon={CalendarCheck} trend={1.3} trendLabel="vs yesterday" delay={0.3} />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Attendance trend */}
        <Card className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Attendance Trend</h3>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
              {stats.todayAttendanceRate}% today
            </Badge>
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

        {/* Gender distribution */}
        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-1">Gender Distribution</h3>
          <p className="text-xs text-muted-foreground mb-4">Active students</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.genderDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {data.genderDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
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

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Fee collection trend */}
        <Card className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Fee Collection Trend</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <div className="flex gap-4 text-xs">
              <div>
                <div className="text-muted-foreground">Collected</div>
                <div className="font-semibold text-emerald-600">{formatCurrency(data.feeTrend.reduce((s, f) => s + f.collected, 0))}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pending</div>
                <div className="font-semibold text-red-500">{formatCurrency(stats.totalFeeDue)}</div>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.feeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="collected" fill="oklch(0.55 0.20 265)" radius={[6, 6, 0, 0]} name="Collected" />
              <Bar dataKey="expected" fill="oklch(0.80 0.03 265)" radius={[6, 6, 0, 0]} name="Expected" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Exam performance */}
        {data.examPerformance.length > 0 && (
          <Card className="glass-card p-5">
            <h3 className="font-semibold mb-1">Exam Performance</h3>
            <p className="text-xs text-muted-foreground mb-4 truncate">{data.latestExamName}</p>
            <ResponsiveContainer width="100%" height={260}>
              <RadialBarChart
                data={data.examPerformance.map((p, i) => ({ name: p.subject, value: p.avgMarks, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
                innerRadius="20%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background dataKey="value" cornerRadius={6} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }}
                  formatter={(v: number) => `${v}%`}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
              {data.examPerformance.map((p, i) => (
                <div key={p.subject} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground truncate">{p.subject}</span>
                  </div>
                  <span className="font-medium">{p.avgMarks}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Quick stats + recent activity */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Library Books</span>
            </div>
            <div className="text-xl font-bold">{stats.books}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bus className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Vehicles</span>
            </div>
            <div className="text-xl font-bold">{stats.vehicles}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Notices</span>
            </div>
            <div className="text-xl font-bold">{stats.notices}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Fee Defaulters</span>
            </div>
            <div className="text-xl font-bold text-red-500">{stats.feeDefaulters}</div>
          </Card>
        </div>

        {/* Recent notices */}
        <Card className="glass-card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              Recent Notices
            </h3>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentNotices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notices yet</p>
            ) : (
              data.recentNotices.map((n) => (
                <div key={n.id} className="pb-3 border-b last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium line-clamp-1">{n.title}</h4>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.date)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent admissions */}
        <Card className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Recent Admissions
            </h3>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No students yet</p>
            ) : (
              data.recentStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {getInitials(`${s.firstName} ${s.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.firstName} {s.lastName}</div>
                    <div className="text-xs text-muted-foreground">{s.admissionNumber} • {s.class?.name || "—"}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(s.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Class distribution */}
      <Card className="glass-card p-5">
        <h3 className="font-semibold mb-1">Students per Class</h3>
        <p className="text-xs text-muted-foreground mb-4">Distribution across all classes</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.classDistribution} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" width={70} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 255)", fontSize: 12 }} />
            <Bar dataKey="count" fill="oklch(0.55 0.20 265)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
