"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  CalendarDays,
  Pencil,
  X,
  GraduationCap,
  Users,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { useAuthStore } from "@/store/auth";
import { canEditTimetable } from "@/lib/permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ==================== Types ====================

interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  designation?: string | null;
  fullName: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
}

interface SlotItem {
  id: string;
  classId: string;
  sectionId: string;
  day: string;
  period: number;
  subjectId?: string | null;
  staffId?: string | null;
  startTime: string;
  endTime: string;
  subject?: { id: string; name: string; code?: string | null } | null;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  } | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

// ==================== Constants ====================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIOD_COUNT = 8;
const DEFAULT_PERIOD_TIMES: { start: string; end: string }[] = [
  { start: "09:00", end: "09:45" },
  { start: "09:45", end: "10:30" },
  { start: "10:30", end: "11:15" },
  { start: "11:15", end: "12:00" },
  { start: "12:00", end: "12:45" },
  { start: "12:45", end: "13:30" },
  { start: "13:30", end: "14:15" },
  { start: "14:15", end: "15:00" },
];

const SUBJECT_COLORS = [
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 ring-indigo-500/30",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-amber-500/30",
  "bg-pink-500/15 text-pink-600 dark:text-pink-300 ring-pink-500/30",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 ring-cyan-500/30",
  "bg-purple-500/15 text-purple-600 dark:text-purple-300 ring-purple-500/30",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300 ring-rose-500/30",
  "bg-teal-500/15 text-teal-600 dark:text-teal-300 ring-teal-500/30",
];

function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

// ==================== Component ====================

export function TimetableModule() {
  const { user } = useAuthStore();
  const role = user?.role ?? "school_admin";

  const isTeacher = role === "teacher";
  const isStudent = role === "student" || role === "parent";
  // Only HR and School Admin can edit timetable; Teacher/Student/Parent = view only
  const canEdit = canEditTimetable(role);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);

  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [slots, setSlots] = useState<SlotItem[]>([]);

  // Edit dialog state
  const [editing, setEditing] = useState<{
    day: string;
    period: number;
  } | null>(null);
  const [editSubjectId, setEditSubjectId] = useState<string>("");
  const [editStaffId, setEditStaffId] = useState<string>("");
  const [editStart, setEditStart] = useState<string>("09:00");
  const [editEnd, setEditEnd] = useState<string>("09:45");
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);

  // Load dropdowns once
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [classesRes, staffRes, subjectsRes] = await Promise.all([
          apiFetch<{ classes: ClassOption[] }>("/api/classes"),
          apiFetch<{ staff: StaffOption[] }>("/api/staff?teaching=true"),
          apiFetch<{ subjects: SubjectOption[] }>("/api/subjects"),
        ]);
        setClasses(classesRes.classes);
        setStaff(staffRes.staff);
        setSubjects(subjectsRes.subjects);

        // For teacher: nothing to pick (their consolidated view).
        // For student: nothing to pick (their own class).
        // For admin: pick first class + first section by default.
        if (
          (role === "super_admin" || role === "school_admin") &&
          classesRes.classes.length > 0
        ) {
          const first = classesRes.classes[0];
          setClassId(first.id);
          setSectionId(first.sections[0]?.id ?? "");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  // Build the URL for fetching slots.
  const fetchUrl = useMemo(() => {
    if (isTeacher && user?.staffId) {
      return `/api/timetable?staffId=${encodeURIComponent(user.staffId)}`;
    }
    if (isStudent && user?.studentId) {
      return `/api/timetable?studentId=${encodeURIComponent(user.studentId)}`;
    }
    if (classId && sectionId) {
      return `/api/timetable?classId=${encodeURIComponent(classId)}&sectionId=${encodeURIComponent(sectionId)}`;
    }
    return null;
  }, [isTeacher, isStudent, user?.staffId, user?.studentId, classId, sectionId]);

  // Fetch slots whenever the URL changes.
  const fetchSlots = useCallback(async () => {
    if (!fetchUrl) {
      setSlots([]);
      return;
    }
    try {
      const res = await apiFetch<{ slots: SlotItem[] }>(fetchUrl);
      setSlots(res.slots);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load timetable");
      setSlots([]);
    }
  }, [fetchUrl]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Build a map: { [day]: { [period]: slot } }
  const grid = useMemo(() => {
    const m: Record<string, Record<number, SlotItem>> = {};
    for (const day of DAYS) m[day] = {};
    for (const slot of slots) {
      if (!m[slot.day]) m[slot.day] = {};
      m[slot.day][slot.period] = slot;
    }
    return m;
  }, [slots]);

  const selectedClass = classes.find((c) => c.id === classId);
  const selectedSection = selectedClass?.sections.find((s) => s.id === sectionId);

  // ---------- Handlers ----------

  const openEditor = (day: string, period: number) => {
    if (!canEdit) return;
    const existing = grid[day]?.[period];
    setEditing({ day, period });
    setEditSubjectId(existing?.subjectId ?? "");
    setEditStaffId(existing?.staffId ?? "");
    setEditStart(existing?.startTime ?? DEFAULT_PERIOD_TIMES[period - 1]?.start ?? "09:00");
    setEditEnd(existing?.endTime ?? DEFAULT_PERIOD_TIMES[period - 1]?.end ?? "09:45");
  };

  const saveSlot = async () => {
    if (!editing) return;
    if (!classId || !sectionId) {
      toast.error("Select a class and section first");
      return;
    }
    const { day, period } = editing;
    // Build the day's slots from current grid + new/updated entry.
    const daySlots: Array<{
      period: number;
      subjectId?: string | null;
      staffId?: string | null;
      startTime: string;
      endTime: string;
    }> = [];
    for (let p = 1; p <= PERIOD_COUNT; p++) {
      if (p === period) {
        if (editSubjectId || editStaffId) {
          daySlots.push({
            period,
            subjectId: editSubjectId || null,
            staffId: editStaffId || null,
            startTime: editStart,
            endTime: editEnd,
          });
        }
        // else: leave empty (was cleared)
      } else {
        const existing = grid[day]?.[p];
        if (existing) {
          daySlots.push({
            period: existing.period,
            subjectId: existing.subjectId || null,
            staffId: existing.staffId || null,
            startTime: existing.startTime,
            endTime: existing.endTime,
          });
        }
      }
    }

    setSavingDay(day);
    try {
      await apiFetch("/api/timetable", {
        method: "POST",
        body: JSON.stringify({
          classId,
          sectionId,
          day,
          slots: daySlots,
        }),
      });
      toast.success("Timetable slot saved");
      setEditing(null);
      await fetchSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save slot");
    } finally {
      setSavingDay(null);
    }
  };

  const clearSlot = async (slot: SlotItem) => {
    // Build the day's slots without this one and bulk-save.
    const day = slot.day;
    const daySlots = (Object.values(grid[day] ?? {}) as SlotItem[])
      .filter((s) => s.period !== slot.period)
      .map((s) => ({
        period: s.period,
        subjectId: s.subjectId || null,
        staffId: s.staffId || null,
        startTime: s.startTime,
        endTime: s.endTime,
      }));

    setSavingDay(day);
    try {
      await apiFetch("/api/timetable", {
        method: "POST",
        body: JSON.stringify({
          classId: slot.classId,
          sectionId: slot.sectionId,
          day,
          slots: daySlots,
        }),
      });
      toast.success("Slot removed");
      setDeleteSlotId(null);
      await fetchSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove slot");
    } finally {
      setSavingDay(null);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div>
        <PageHeader title="Timetable" description="Period-wise weekly schedule." icon={Clock} />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const isTeacherOrStudent = isTeacher || isStudent;
  const noClassesForAdmin = !isTeacherOrStudent && classes.length === 0;

  return (
    <div>
      <PageHeader
        title="Timetable"
        description={
          isTeacher
            ? "Your teaching schedule across all classes."
            : isStudent
              ? "Your class weekly schedule."
              : "Create and view period-wise weekly timetables."
        }
        icon={Clock}
      />

      {/* Controls */}
      {!isTeacherOrStudent && (
        <Card className="glass-card p-4 mb-6">
          {noClassesForAdmin ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No classes available. Create classes & sections first.
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs">Class</Label>
                <Select
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v);
                    const cls = classes.find((c) => c.id === v);
                    setSectionId(cls?.sections[0]?.id ?? "");
                  }}
                >
                  <SelectTrigger>
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
              <div className="space-y-1.5 min-w-[140px]">
                <Label className="text-xs">Section</Label>
                <Select
                  value={sectionId}
                  onValueChange={setSectionId}
                  disabled={!selectedClass || selectedClass.sections.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClass?.sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClass && selectedSection && (
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {selectedClass.name} · {selectedSection.name}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Body */}
      {noClassesForAdmin ? (
        <EmptyState
          icon={Clock}
          title="No timetable yet"
          description="Create classes & sections first, then build their weekly timetable here."
        />
      ) : isStudent && !user?.studentId ? (
        <EmptyState
          icon={Clock}
          title="No student profile linked"
          description="Your account isn't linked to a student record yet. Please contact your school administrator."
        />
      ) : isTeacher && !user?.staffId ? (
        <EmptyState
          icon={Clock}
          title="No staff profile linked"
          description="Your account isn't linked to a staff record yet. Please contact your school administrator."
        />
      ) : !isTeacherOrStudent && (!classId || !sectionId) ? (
        <EmptyState
          icon={Clock}
          title="Select a class & section"
          description="Pick a class and section above to view or edit its weekly timetable."
        />
      ) : (
        <TimetableGrid
          grid={grid}
          canEdit={canEdit}
          isTeacher={isTeacher}
          savingDay={savingDay}
          onCellClick={openEditor}
        />
      )}

      {/* ===== Edit slot dialog ===== */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? grid[editing.day]?.[editing.period]
                  ? "Edit Slot"
                  : "Add Slot"
                : "Slot"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.day} · Period ${editing.period}`
                : "Configure the period"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={editSubjectId} onValueChange={setEditSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={editStaffId} onValueChange={setEditStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName} ({s.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {editing && grid[editing.day]?.[editing.period] && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 mr-auto"
                onClick={() => {
                  const slot = grid[editing.day]?.[editing.period];
                  if (slot) {
                    setEditing(null);
                    setDeleteSlotId(slot.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveSlot}
              disabled={!!savingDay}
              className="gradient-primary text-white"
            >
              {savingDay && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteSlotId}
        onOpenChange={(v) => !v && setDeleteSlotId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this slot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the subject and teacher for this period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                const slot = slots.find((s) => s.id === deleteSlotId);
                if (slot) clearSlot(slot);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== TimetableGrid sub-component ====================

interface TimetableGridProps {
  grid: Record<string, Record<number, SlotItem>>;
  canEdit: boolean;
  isTeacher: boolean;
  savingDay: string | null;
  onCellClick: (day: string, period: number) => void;
}

function TimetableGrid({
  grid,
  canEdit,
  isTeacher,
  savingDay,
  onCellClick,
}: TimetableGridProps) {
  // Render the weekly grid: rows = periods (with time), columns = days.
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl border border-border/60 overflow-hidden"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Header row */}
          <div className="grid grid-cols-[120px_repeat(6,minmax(120px,1fr))] bg-muted/40 border-b border-border/60">
            <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Period
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="p-3 text-xs font-semibold text-center uppercase tracking-wider border-l border-border/60 flex items-center justify-center gap-2"
              >
                {day}
                {savingDay === day && (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                )}
              </div>
            ))}
          </div>

          {/* Period rows */}
          {DEFAULT_PERIOD_TIMES.map((times, idx) => {
            const period = idx + 1;
            const isLunch = period === 5;
            return (
              <div
                key={period}
                className="grid grid-cols-[120px_repeat(6,minmax(120px,1fr))] border-b border-border/40 last:border-b-0"
              >
                <div className="p-3 bg-muted/20 border-r border-border/60 flex flex-col justify-center">
                  <div className="text-sm font-semibold">Period {period}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {times.start} – {times.end}
                  </div>
                  {isLunch && (
                    <Badge variant="outline" className="mt-1 text-[9px] py-0 px-1 w-fit">
                      Lunch
                    </Badge>
                  )}
                </div>
                {DAYS.map((day) => {
                  const slot = grid[day]?.[period];
                  return (
                    <div
                      key={day}
                      className="border-l border-border/40 p-1.5"
                    >
                      <SlotCell
                        slot={slot}
                        canEdit={canEdit}
                        isTeacher={isTeacher}
                        onClick={() => onCellClick(day, period)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        {canEdit ? (
          <span className="flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            Click an empty cell to add · click a filled cell to edit
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />
            Read-only view
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ==================== SlotCell ====================

interface SlotCellProps {
  slot?: SlotItem;
  canEdit: boolean;
  isTeacher: boolean;
  onClick: () => void;
}

function SlotCell({ slot, canEdit, isTeacher, onClick }: SlotCellProps) {
  if (!slot) {
    if (!canEdit) {
      return (
        <div className="h-full min-h-[64px] rounded-md border border-dashed border-border/30 flex items-center justify-center text-xs text-muted-foreground/60">
          —
        </div>
      );
    }
    return (
      <button
        onClick={onClick}
        className="h-full min-h-[64px] w-full rounded-md border border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center group"
      >
        <Plus className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary" />
      </button>
    );
  }

  const subjectName = slot.subject?.name ?? "—";
  const teacherName = slot.staff
    ? `${slot.staff.firstName} ${slot.staff.lastName}`
    : "—";

  return (
    <button
      onClick={canEdit ? onClick : undefined}
      className={cn(
        "h-full min-h-[64px] w-full rounded-md p-2 text-left text-xs transition-all relative",
        "ring-1",
        subjectColor(subjectName),
        canEdit && "hover:ring-2 hover:shadow-sm cursor-pointer"
      )}
    >
      <div className="font-semibold leading-tight truncate">{subjectName}</div>
      {slot.subject?.code && (
        <div className="text-[10px] opacity-70 truncate">{slot.subject.code}</div>
      )}
      <div className="mt-1 opacity-80">
        {isTeacher ? (
          slot.class && (
            <span className="flex items-center gap-0.5 text-[10px] truncate">
              <GraduationCap className="w-2.5 h-2.5 shrink-0" />
              {slot.class.name}
              {slot.section ? ` · ${slot.section.name}` : ""}
            </span>
          )
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] truncate">
            <Users className="w-2.5 h-2.5 shrink-0" />
            {teacherName}
          </span>
        )}
      </div>
      <div className="text-[9px] opacity-60 font-mono mt-0.5">
        {slot.startTime} – {slot.endTime}
      </div>
      {canEdit && (
        <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
          <Pencil className="w-2.5 h-2.5" />
        </span>
      )}
    </button>
  );
}
