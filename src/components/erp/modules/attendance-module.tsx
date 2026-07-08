"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Save,
  Search,
  Users,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/store/auth";
import {
  apiFetch,
  formatDate,
  STATUS_COLORS,
} from "@/lib/api";
import { canMarkStudentAttendance, canMarkStaffAttendance } from "@/lib/permissions";
import type { Role } from "@/types";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "leave"
  | "halfday";

interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  rollNumber?: string | null;
  attendance: { id: string; status: string } | null;
}
interface StaffRow {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  department?: string | null;
  type: string;
  attendance: {
    id: string;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
  } | null;
}
interface StudentAttendanceResponse {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class?: { name: string } | null;
    section?: { name: string } | null;
  };
  records: { id: string; date: string; status: string }[];
  byDate: Record<string, string>;
  counts: Record<AttendanceStatus, number>;
  total: number;
  percentage: number;
}

// ---------- Constants ----------
const STATUS_LIST: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "leave",
  "halfday",
];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "Leave",
  halfday: "Half Day",
};

// Tailwind classes for active buttons (selected) and inactive (ghost)
const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  present:
    "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600",
  absent:
    "bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600",
  late: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:border-amber-600",
  leave:
    "bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:border-blue-600",
  halfday:
    "bg-purple-500 text-white border-purple-500 hover:bg-purple-600 hover:border-purple-600",
};

// Cell background colors for the calendar grid
const STATUS_CELL: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white",
  absent: "bg-red-500 text-white",
  late: "bg-amber-500 text-white",
  leave: "bg-blue-500 text-white",
  halfday: "bg-purple-500 text-white",
};

// ---------- Helpers ----------
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function shortMonth(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function getRoleTabs(role: string): ("mark" | "calendar" | "staff")[] {
  const tabs: ("mark" | "calendar" | "staff")[] = [];
  // Student attendance marking: teacher, school_admin, super_admin, hr
  if (canMarkStudentAttendance(role as Role)) {
    tabs.push("mark");
  }
  tabs.push("calendar"); // everyone sees calendar
  // Staff attendance marking: school_admin, super_admin, hr ONLY (not teacher)
  if (canMarkStaffAttendance(role as Role)) {
    tabs.push("staff");
  }
  return tabs;
}

// ============================================================
// Main module
// ============================================================
export function AttendanceModule() {
  const { user } = useAuthStore();
  const tabs = useMemo(
    () => (user ? getRoleTabs(user.role) : ["calendar"]),
    [user]
  );
  // User-selected tab (overridable). `activeTab` is derived: falls back to a
  // sensible default per role, and clamps to an available tab.
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const defaultTab =
    user && (user.role === "student" || user.role === "parent")
      ? "calendar"
      : tabs[0] ?? "calendar";
  const activeTab =
    selectedTab && tabs.includes(selectedTab as never)
      ? selectedTab
      : defaultTab;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark and track student and staff attendance."
        icon={CalendarCheck}
      />

      {tabs.length === 1 ? (
        <div className="space-y-6">
          {tabs[0] === "calendar" && <CalendarViewTab />}
          {tabs[0] === "staff" && <StaffAttendanceTab />}
          {tabs[0] === "mark" && <MarkAttendanceTab />}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="h-auto flex-wrap">
            {tabs.includes("mark") && (
              <TabsTrigger value="mark" className="gap-1.5">
                <CalendarCheck className="w-4 h-4" />
                Mark Attendance
              </TabsTrigger>
            )}
            {tabs.includes("calendar") && (
              <TabsTrigger value="calendar" className="gap-1.5">
                <CalendarDays className="w-4 h-4" />
                Calendar
              </TabsTrigger>
            )}
            {tabs.includes("staff") && (
              <TabsTrigger value="staff" className="gap-1.5">
                <UserCog className="w-4 h-4" />
                Staff
              </TabsTrigger>
            )}
          </TabsList>

          {tabs.includes("mark") && (
            <TabsContent value="mark" className="mt-6">
              <MarkAttendanceTab />
            </TabsContent>
          )}
          {tabs.includes("calendar") && (
            <TabsContent value="calendar" className="mt-6">
              <CalendarViewTab />
            </TabsContent>
          )}
          {tabs.includes("staff") && (
            <TabsContent value="staff" className="mt-6">
              <StaffAttendanceTab />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

// ============================================================
// Tab 1: Mark Attendance (teacher / admin)
// ============================================================
function MarkAttendanceTab() {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [date, setDate] = useState<string>(todayStr());
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Load classes
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingClasses(true);
      try {
        const data = await apiFetch<{ classes: ClassOption[] }>("/api/classes");
        if (!active) return;
        setClasses(data.classes);
        if (data.classes.length > 0) {
          setClassId(data.classes[0].id);
          if (data.classes[0].sections.length > 0) {
            setSectionId(data.classes[0].sections[0].id);
          }
        }
      } catch {
        toast.error("Failed to load classes");
      } finally {
        if (active) setLoadingClasses(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Reset section when class changes
  useEffect(() => {
    const cls = classes.find((c) => c.id === classId);
    if (cls) {
      if (cls.sections.length > 0) {
        // keep current sectionId if valid, else pick first
        if (!cls.sections.some((s) => s.id === sectionId)) {
          setSectionId(cls.sections[0].id);
        }
      } else {
        setSectionId("");
      }
    }
  }, [classId, classes, sectionId]);

  // Load attendance rows whenever classId/sectionId/date changes
  const loadAttendance = useCallback(async () => {
    if (!classId || !date) return;
    setLoadingStudents(true);
    setRows([]);
    setDraft({});
    try {
      const qs = new URLSearchParams({
        classId,
        date,
        ...(sectionId ? { sectionId } : {}),
      });
      const data = await apiFetch<{
        students: StudentRow[];
        marked: number;
      }>(`/api/attendance?${qs.toString()}`);
      setRows(data.students);
      const d: Record<string, AttendanceStatus> = {};
      for (const s of data.students) {
        if (s.attendance) {
          d[s.id] = s.attendance.status as AttendanceStatus;
        }
      }
      setDraft(d);
      if (data.students.length > 0 && data.marked > 0) {
        toast.info(`Loaded ${data.marked} existing record(s) for ${date}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoadingStudents(false);
    }
  }, [classId, date, sectionId]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setDraft((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    const d: Record<string, AttendanceStatus> = {};
    for (const r of rows) d[r.id] = "present";
    setDraft(d);
    toast.success("Marked all as Present");
  };

  const handleSave = async () => {
    if (!classId || !date) {
      toast.error("Select class and date");
      return;
    }
    const records = rows
      .map((r) => ({
        studentId: r.id,
        status: draft[r.id] ?? "present",
      }));
    if (records.length === 0) {
      toast.error("No students to save");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ saved: number }>(
        "/api/attendance",
        {
          method: "POST",
          body: JSON.stringify({
            classId,
            sectionId: sectionId || undefined,
            date,
            records,
          }),
        }
      );
      toast.success(`Saved attendance for ${res.saved} student(s)`);
      // Reload to reflect saved state
      await loadAttendance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.admissionNumber.toLowerCase().includes(q) ||
        (r.rollNumber ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const presentCount = Object.values(draft).filter(
    (s) => s === "present"
  ).length;
  const absentCount = Object.values(draft).filter(
    (s) => s === "absent"
  ).length;
  const lateCount = Object.values(draft).filter((s) => s === "late").length;

  if (loadingClasses) {
    return (
      <Card className="glass-card">
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading classes…
        </CardContent>
      </Card>
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No classes found"
        description="Create classes and sections first to mark attendance."
      />
    );
  }

  const currentClass = classes.find((c) => c.id === classId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Controls */}
      <Card className="glass-card">
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Class
            </label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select class" />
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Section
            </label>
            <Select
              value={sectionId || "ALL"}
              onValueChange={(v) => setSectionId(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sections</SelectItem>
                {(currentClass?.sections ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Section {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Date
            </label>
            <Input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={markAllPresent}
              disabled={rows.length === 0 || loadingStudents}
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              All Present
            </Button>
            <Button
              className="gradient-primary text-white flex-1"
              onClick={handleSave}
              disabled={
                saving ||
                rows.length === 0 ||
                loadingStudents ||
                !user
              }
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Present: {presentCount}
        </Badge>
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
          Absent: {absentCount}
        </Badge>
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
          Late: {lateCount}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} student(s) · {formatDate(date)}
        </span>
      </div>

      {/* Students list */}
      <Card className="glass-card">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Students</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, roll no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingStudents ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading students…
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students found"
              description="No active students in this class/section, or your search returned no results."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Admission
                  </TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r, idx) => {
                  const status = draft[r.id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {r.firstName} {r.lastName}
                        </div>
                        {r.rollNumber && (
                          <div className="text-xs text-muted-foreground">
                            Roll: {r.rollNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {r.admissionNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          {STATUS_LIST.map((s) => {
                            const isActive = status === s;
                            return (
                              <Button
                                key={s}
                                size="sm"
                                variant="outline"
                                onClick={() => setStatus(r.id, s)}
                                className={cn(
                                  "h-7 px-2.5 text-xs font-medium transition-all",
                                  isActive
                                    ? STATUS_ACTIVE[s]
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {STATUS_LABELS[s].charAt(0)}
                              </Button>
                            );
                          })}
                          {status && (
                            <Badge
                              className={cn(
                                "ml-1 hidden md:inline-flex",
                                STATUS_COLORS[status]
                              )}
                            >
                              {STATUS_LABELS[status]}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {STATUS_LIST.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-3 h-3 rounded-sm",
                STATUS_CELL[s].split(" ")[0]
              )}
            />
            {STATUS_LABELS[s]} ({s.charAt(0).toUpperCase()})
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// Tab 2: Calendar View (student/parent self OR teacher/admin viewing any student)
// ============================================================
function CalendarViewTab() {
  const { user } = useAuthStore();
  const isStudentOrParent =
    user?.role === "student" || user?.role === "parent";
  const [studentId, setStudentId] = useState<string>(
    user?.studentId ?? ""
  );
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<
    {
      id: string;
      firstName: string;
      lastName: string;
      admissionNumber: string;
      class?: { name: string } | null;
      section?: { name: string } | null;
    }[]
  >([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [showStudentSearch, setShowStudentSearch] = useState(false);

  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const [data, setData] = useState<StudentAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // For student/parent, the studentId is fixed to their linked student.
  // We don't need an effect to set it — it's initialized from user.studentId.

  const fetchData = useCallback(async () => {
    if (!studentId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const d = await apiFetch<StudentAttendanceResponse>(
        `/api/attendance/student?studentId=${studentId}`
      );
      setData(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load attendance");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Search students (for teacher/admin)
  const searchStudents = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    setSearchingStudents(true);
    try {
      // /api/students returns the array directly (with class+section included)
      const res = await apiFetch<
        {
          id: string;
          firstName: string;
          lastName: string;
          admissionNumber: string;
          class?: { name: string } | null;
          section?: { name: string } | null;
        }[]
      >(`/api/students?search=${encodeURIComponent(q)}`);
      const list = Array.isArray(res) ? res : [];
      setStudentResults(list);
    } catch {
      setStudentResults([]);
    } finally {
      setSearchingStudents(false);
    }
  }, []);

  // Compute current displayed month
  const displayDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  // Build calendar grid (Mon-Sun start)
  const calendarCells = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // start from Monday (1=Mon in our grid)
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const cells: {
      date: Date;
      day: number | null;
      ymd: string | null;
      status?: string;
      inMonth: boolean;
    }[] = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: new Date(year, month, -startOffset + i + 1), day: null, ymd: null, inMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const ymd = toYMD(date);
      cells.push({
        date,
        day: d,
        ymd,
        status: data?.byDate?.[ymd],
        inMonth: true,
      });
    }
    // pad to multiple of 7
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      cells.push({ date: next, day: null, ymd: null, inMonth: false });
    }
    return cells;
  }, [displayDate, data]);

  if (isStudentOrParent && !user?.studentId) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No student profile linked"
        description="Your account is not linked to a student record. Please contact the school administrator."
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Student selector for non-student/parent roles */}
      {!isStudentOrParent && (
        <Card className="glass-card">
          <CardContent className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground">
              Select Student
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student by name or admission no…"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setShowStudentSearch(true);
                    void searchStudents(e.target.value);
                  }}
                  onFocus={() => setShowStudentSearch(true)}
                  className="pl-9"
                />
                {showStudentSearch &&
                  (studentSearch.trim().length >= 2) && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-auto">
                      {searchingStudents ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center">
                          <Loader2 className="w-3 h-3 animate-spin mr-2" />
                          Searching…
                        </div>
                      ) : studentResults.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No students found.
                        </div>
                      ) : (
                        studentResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                            onClick={() => {
                              setStudentId(s.id);
                              setStudentSearch(
                                `${s.firstName} ${s.lastName} (${s.admissionNumber})`
                              );
                              setShowStudentSearch(false);
                            }}
                          >
                            <span className="font-medium">
                              {s.firstName} {s.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {s.class?.name ?? "—"} {s.section?.name ?? ""}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
              </div>
              {studentId && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStudentId("");
                    setStudentSearch("");
                    setData(null);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!studentId ? (
        <EmptyState
          icon={CalendarDays}
          title="No student selected"
          description="Search and pick a student above to view their attendance calendar and summary."
        />
      ) : loading ? (
        <Card className="glass-card">
          <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading attendance…
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              title="Attendance %"
              value={`${data.percentage}%`}
              icon={CalendarCheck}
              color="text-primary"
              delay={0}
            />
            <StatsCard
              title="Present"
              value={data.counts.present}
              icon={CheckCheck}
              color="text-emerald-600 dark:text-emerald-400"
              delay={0.05}
            />
            <StatsCard
              title="Absent"
              value={data.counts.absent}
              icon={Users}
              color="text-red-600 dark:text-red-400"
              delay={0.1}
            />
            <StatsCard
              title="Late / Half Day / Leave"
              value={`${data.counts.late} / ${data.counts.halfday} / ${data.counts.leave}`}
              icon={Clock}
              color="text-amber-600 dark:text-amber-400"
              delay={0.15}
            />
          </div>

          {/* Calendar */}
          <Card className="glass-card">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {data.student.firstName} {data.student.lastName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.student.class?.name ?? "—"}
                    {data.student.section?.name
                      ? ` · Section ${data.student.section.name}`
                      : ""}{" "}
                    · Adm: {data.student.admissionNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setMonthOffset((m) => m - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    {shortMonth(displayDate)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setMonthOffset((m) => m + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {d}
                  </div>
                ))}
                {calendarCells.map((cell, idx) => {
                  if (!cell.inMonth || !cell.day) {
                    return <div key={idx} className="aspect-square" />;
                  }
                  const status = cell.status as AttendanceStatus | undefined;
                  const isToday = cell.ymd === todayStr();
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(idx * 0.005, 0.3) }}
                      className={cn(
                        "aspect-square rounded-md flex flex-col items-center justify-center text-sm font-medium relative",
                        status
                          ? STATUS_CELL[status]
                          : "bg-muted/40 text-muted-foreground",
                        isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      )}
                      title={
                        status
                          ? `${cell.ymd} — ${STATUS_LABELS[status]}`
                          : `${cell.ymd} — Not marked`
                      }
                    >
                      <span>{cell.day}</span>
                      {status && (
                        <span className="text-[10px] opacity-90 leading-none">
                          {STATUS_LABELS[status].split(" ")[0]}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground pt-4 border-t">
                {STATUS_LIST.map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "w-3 h-3 rounded-sm",
                        STATUS_CELL[s].split(" ")[0]
                      )}
                    />
                    {STATUS_LABELS[s]}
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-muted/40 border" />
                  Not marked
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent records */}
          {data.records.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="border-b">
                <CardTitle className="text-base">Recent Records</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records
                      .slice()
                      .reverse()
                      .slice(0, 10)
                      .map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{formatDate(r.date)}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              className={STATUS_COLORS[r.status] ?? ""}
                            >
                              {STATUS_LABELS[r.status as AttendanceStatus] ??
                                r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </motion.div>
  );
}

// ============================================================
// Tab 3: Staff Attendance (admin / hr / teacher)
// ============================================================
function StaffAttendanceTab() {
  const [date, setDate] = useState<string>(todayStr());
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [draft, setDraft] = useState<
    Record<
      string,
      { status: AttendanceStatus; checkIn: string; checkOut: string }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setRows([]);
    setDraft({});
    try {
      const data = await apiFetch<{
        staff: StaffRow[];
        total: number;
        present: number;
        absent: number;
      }>(`/api/attendance/staff?date=${date}`);
      setRows(data.staff);
      const d: typeof draft = {};
      for (const s of data.staff) {
        if (s.attendance) {
          d[s.id] = {
            status: s.attendance.status as AttendanceStatus,
            checkIn: s.attendance.checkIn ?? "",
            checkOut: s.attendance.checkOut ?? "",
          };
        }
      }
      setDraft(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load staff attendance");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = (id: string, status: AttendanceStatus) => {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        status,
        checkIn: prev[id]?.checkIn ?? "",
        checkOut: prev[id]?.checkOut ?? "",
      },
    }));
  };

  const setTime = (
    id: string,
    field: "checkIn" | "checkOut",
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        status: prev[id]?.status ?? "present",
        checkIn: field === "checkIn" ? value : prev[id]?.checkIn ?? "",
        checkOut: field === "checkOut" ? value : prev[id]?.checkOut ?? "",
      },
    }));
  };

  const markAllPresent = () => {
    const d: typeof draft = {};
    for (const r of rows) {
      d[r.id] = {
        status: "present",
        checkIn: draft[r.id]?.checkIn ?? "09:00",
        checkOut: draft[r.id]?.checkOut ?? "17:00",
      };
    }
    setDraft(d);
    toast.success("Marked all staff as Present");
  };

  const handleSave = async () => {
    const records = rows.map((r) => {
      const cur =
        draft[r.id] ?? { status: "present" as AttendanceStatus, checkIn: "", checkOut: "" };
      return {
        staffId: r.id,
        status: cur.status,
        checkIn: cur.checkIn || null,
        checkOut: cur.checkOut || null,
      };
    });
    if (records.length === 0) {
      toast.error("No staff to save");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ saved: number }>(
        "/api/attendance/staff",
        {
          method: "POST",
          body: JSON.stringify({ date, records }),
        }
      );
      toast.success(`Saved attendance for ${res.saved} staff`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        (r.designation ?? "").toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const presentCount = Object.values(draft).filter(
    (s) => s.status === "present"
  ).length;
  const absentCount = Object.values(draft).filter(
    (s) => s.status === "absent"
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Controls */}
      <Card className="glass-card">
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Date
            </label>
            <Input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={markAllPresent}
              disabled={rows.length === 0 || loading}
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              All Present
            </Button>
            <Button
              className="gradient-primary text-white flex-1"
              onClick={handleSave}
              disabled={saving || rows.length === 0 || loading}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          Present: {presentCount}
        </Badge>
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
          Absent: {absentCount}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} staff · {formatDate(date)}
        </span>
      </div>

      {/* Staff table */}
      <Card className="glass-card">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Staff</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee id, dept…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading staff…
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="No staff found"
              description="No active staff members match your filter, or no staff have been added yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Department
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Check In
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Check Out
                  </TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => {
                  const cur = draft[r.id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">
                          {r.firstName} {r.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.employeeId}
                          {r.designation ? ` · ${r.designation}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {r.department ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Input
                          type="time"
                          value={cur?.checkIn ?? ""}
                          onChange={(e) =>
                            setTime(r.id, "checkIn", e.target.value)
                          }
                          className="h-8 w-28 text-xs"
                          disabled={cur?.status === "absent"}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Input
                          type="time"
                          value={cur?.checkOut ?? ""}
                          onChange={(e) =>
                            setTime(r.id, "checkOut", e.target.value)
                          }
                          className="h-8 w-28 text-xs"
                          disabled={cur?.status === "absent"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          {(
                            [
                              "present",
                              "absent",
                              "late",
                              "leave",
                            ] as AttendanceStatus[]
                          ).map((s) => {
                            const isActive = cur?.status === s;
                            return (
                              <Button
                                key={s}
                                size="sm"
                                variant="outline"
                                onClick={() => setStatus(r.id, s)}
                                className={cn(
                                  "h-7 px-2.5 text-xs font-medium transition-all",
                                  isActive
                                    ? STATUS_ACTIVE[s]
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {STATUS_LABELS[s].charAt(0)}
                              </Button>
                            );
                          })}
                          {cur?.status && (
                            <Badge
                              className={cn(
                                "ml-1 hidden lg:inline-flex",
                                STATUS_COLORS[cur.status]
                              )}
                            >
                              {STATUS_LABELS[cur.status]}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
