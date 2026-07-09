"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Megaphone,
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Pin,
  Users,
  GraduationCap,
  UserCircle,
  Clock,
  MapPin,
  AlertCircle,
  PartyPopper,
  GraduationCap as ExamIcon,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { apiFetch, formatDate } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ROLE_LABELS, type Role } from "@/types";

// ===================== Types =====================
interface NoticeRow {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  targetClassId: string | null;
  targetRole: string | null;
  postedBy: string | null;
  date: string;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  type: string;
}

interface ClassOption {
  id: string;
  name: string;
}

// ===================== Constants =====================
const EVENT_TYPES: { value: string; label: string; color: string; bg: string; text: string; border: string }[] = [
  { value: "holiday", label: "Holiday", color: "#ef4444", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  { value: "ptm", label: "PTM", color: "#3b82f6", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  { value: "exam", label: "Exam", color: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  { value: "function", label: "Function", color: "#a855f7", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  { value: "event", label: "Event", color: "#10b981", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
];

function eventStyle(type: string) {
  return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[4];
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All",
  class: "Class",
  role: "Role",
};

const CAN_POST: Role[] = ["super_admin", "school_admin", "teacher"];
const CAN_DELETE: Role[] = ["super_admin", "school_admin"];

// ===================== Main Component =====================
export function NoticesModule() {
  const { user } = useAuthStore();
  const canPost = user ? CAN_POST.includes(user.role) : false;

  const [activeTab, setActiveTab] = useState<"notices" | "calendar">("notices");
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [editingNotice, setEditingNotice] = useState<NoticeRow | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    try {
      const data = await apiFetch<{ classes: ClassOption[] }>("/api/classes");
      setClasses(data.classes);
    } catch {
      // ignore — class dropdown will just be empty
    }
  }, []);

  const loadNotices = useCallback(async () => {
    try {
      const data = await apiFetch<{ notices: NoticeRow[] }>("/api/notices");
      setNotices(data.notices);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load notices");
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiFetch<{ events: EventRow[] }>(
        `/api/events?month=${calendarMonth.month}&year=${calendarMonth.year}`
      );
      setEvents(data.events);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load events");
    }
  }, [calendarMonth]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadNotices(), loadEvents(), loadClasses()]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [loadNotices, loadEvents, loadClasses]);

  // Note: events reload automatically when calendarMonth changes because
  // loadEvents is in the dependency array of the initial-load effect above.
  // (loadEvents identity changes when calendarMonth changes.)

  // ===================== Notice handlers =====================
  const handleSaveNotice = async (formData: {
    title: string;
    content: string;
    targetAudience: string;
    targetClassId: string;
    targetRole: string;
    date: string;
  }) => {
    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        targetAudience: formData.targetAudience,
        targetClassId: formData.targetAudience === "class" ? formData.targetClassId : null,
        targetRole: formData.targetAudience === "role" ? formData.targetRole : null,
        date: formData.date,
      };
      if (editingNotice) {
        await apiFetch(`/api/notices/${editingNotice.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Notice updated");
      } else {
        await apiFetch(`/api/notices`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Notice posted");
      }
      setNoticeDialogOpen(false);
      setEditingNotice(null);
      await loadNotices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save notice");
    }
  };

  const handleDeleteNotice = async () => {
    if (!deleteNoticeId) return;
    try {
      await apiFetch(`/api/notices/${deleteNoticeId}`, { method: "DELETE" });
      toast.success("Notice deleted");
      setDeleteNoticeId(null);
      await loadNotices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete notice");
    }
  };

  // ===================== Event handlers =====================
  const handleSaveEvent = async (formData: {
    title: string;
    description: string;
    date: string;
    endDate: string;
    type: string;
  }) => {
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        date: formData.date,
        endDate: formData.endDate || null,
        type: formData.type,
      };
      if (editingEvent) {
        await apiFetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Event updated");
      } else {
        await apiFetch(`/api/events`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Event added");
      }
      setEventDialogOpen(false);
      setEditingEvent(null);
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save event");
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;
    try {
      await apiFetch(`/api/events/${deleteEventId}`, { method: "DELETE" });
      toast.success("Event deleted");
      setDeleteEventId(null);
      setSelectedDate(null);
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  return (
    <div>
      <PageHeader
        title="Notices & Events"
        description="Post notices and manage the school event calendar."
        icon={Megaphone}
        actionLabel={activeTab === "notices" ? (canPost ? "Post Notice" : "") : canPost ? "Add Event" : ""}
        onAction={
          activeTab === "notices"
            ? canPost
              ? () => {
                  setEditingNotice(null);
                  setNoticeDialogOpen(true);
                }
              : undefined
            : canPost
              ? () => {
                  setEditingEvent(null);
                  setEventDialogOpen(true);
                }
              : undefined
        }
        actionIcon={activeTab === "notices" ? Pin : CalendarIcon}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "notices" | "calendar")}>
        <TabsList className="mb-6">
          <TabsTrigger value="notices">
            <Megaphone className="w-4 h-4 mr-2" />
            Notices
            {notices.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notices.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Event Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="mt-0">
          {loading ? (
            <NoticesSkeleton />
          ) : notices.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No notices yet"
              description={canPost ? "Post your first notice to keep everyone informed." : "Check back later for school notices."}
              actionLabel={canPost ? "Post Notice" : undefined}
              onAction={
                canPost
                  ? () => {
                      setEditingNotice(null);
                      setNoticeDialogOpen(true);
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {notices.map((notice, i) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  classes={classes}
                  index={i}
                  canEdit={!!canPost}
                  canDelete={!!(user && CAN_DELETE.includes(user.role))}
                  onEdit={() => {
                    setEditingNotice(notice);
                    setNoticeDialogOpen(true);
                  }}
                  onDelete={() => setDeleteNoticeId(notice.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <EventCalendar
            events={events}
            month={calendarMonth.month}
            year={calendarMonth.year}
            loading={loading}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrev={() => {
              const m = calendarMonth.month - 1;
              if (m < 1) setCalendarMonth({ month: 12, year: calendarMonth.year - 1 });
              else setCalendarMonth({ ...calendarMonth, month: m });
            }}
            onNext={() => {
              const m = calendarMonth.month + 1;
              if (m > 12) setCalendarMonth({ month: 1, year: calendarMonth.year + 1 });
              else setCalendarMonth({ ...calendarMonth, month: m });
            }}
            onAddEvent={
              canPost
                ? () => {
                    setEditingEvent(null);
                    setEventDialogOpen(true);
                  }
                : undefined
            }
            onEditEvent={(ev) => {
              setEditingEvent(ev);
              setEventDialogOpen(true);
            }}
            onDeleteEvent={(id) => setDeleteEventId(id)}
            canEdit={!!canPost}
            canDelete={!!(user && CAN_DELETE.includes(user.role))}
          />
        </TabsContent>
      </Tabs>

      {/* Notice dialog */}
      <NoticeDialog
        open={noticeDialogOpen}
        onOpenChange={(o) => {
          setNoticeDialogOpen(o);
          if (!o) setEditingNotice(null);
        }}
        notice={editingNotice}
        classes={classes}
        onSave={handleSaveNotice}
      />

      {/* Event dialog */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={(o) => {
          setEventDialogOpen(o);
          if (!o) setEditingEvent(null);
        }}
        event={editingEvent}
        onSave={handleSaveEvent}
      />

      {/* Delete notice alert */}
      <AlertDialog open={!!deleteNoticeId} onOpenChange={(o) => !o && setDeleteNoticeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this notice?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The notice will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNotice}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete event alert */}
      <AlertDialog open={!!deleteEventId} onOpenChange={(o) => !o && setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The event will be permanently removed from the calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================== Notice Card =====================
function NoticeCard({
  notice,
  classes,
  index,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  notice: NoticeRow;
  classes: ClassOption[];
  index: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const audienceLabel = useMemo(() => {
    if (notice.targetAudience === "all") return "All";
    if (notice.targetAudience === "class") {
      const c = classes.find((c) => c.id === notice.targetClassId);
      return c ? `Class ${c.name}` : "Class";
    }
    if (notice.targetAudience === "role") {
      return ROLE_LABELS[notice.targetRole as Role] || notice.targetRole || "Role";
    }
    return AUDIENCE_LABELS[notice.targetAudience] || "All";
  }, [notice, classes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
    >
      <Card className="glass-card hover:shadow-lg transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary">
                <Pin className="w-3 h-3 mr-1" />
                {audienceLabel}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(notice.date)}
              </span>
            </div>
            {(canEdit || canDelete) && (
              <div className="flex gap-1">
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
                {canDelete && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <h3 className="font-semibold text-base mb-2">{notice.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
            {notice.content}
          </p>
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <UserCircle className="w-3.5 h-3.5" />
            Posted by <span className="font-medium text-foreground">{notice.postedBy || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== Event Calendar =====================
function EventCalendar({
  events,
  month,
  year,
  loading,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  canEdit,
  canDelete,
}: {
  events: EventRow[];
  month: number;
  year: number;
  loading: boolean;
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
  onAddEvent?: () => void;
  onEditEvent: (e: EventRow) => void;
  onDeleteEvent: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const days = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const cells: { date: string | null; day: number | null; isToday: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, day: null, isToday: false });
    }
    const todayStr = new Date().toISOString().split("T")[0];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date: dateStr, day: d, isToday: dateStr === todayStr });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, day: null, isToday: false });
    }
    return cells;
  }, [month, year]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    for (const ev of events) {
      // Include event on every day from date to endDate
      const start = ev.date;
      const end = ev.endDate || ev.date;
      const startD = new Date(start);
      const endD = new Date(end);
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        if (!map[key]) map[key] = [];
        if (!map[key].find((e) => e.id === ev.id)) {
          map[key].push(ev);
        }
      }
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  const hasEvents = events.length > 0;

  return (
    <div className="space-y-4">
      {/* Header with nav */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[180px] text-center">
            <span className="font-semibold text-lg">{monthName}</span>
          </div>
          <Button variant="outline" size="icon" onClick={onNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {EVENT_TYPES.map((t) => (
            <div key={t.value} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${t.bg} ${t.text}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </div>
          ))}
          {onAddEvent && (
            <Button onClick={onAddEvent} className="gradient-primary text-white ml-2">
              <Plus className="w-4 h-4 mr-1" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Calendar grid */}
        <Card className="glass-card">
          <CardContent className="p-3">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((cell, i) => {
                if (!cell.date) {
                  return <div key={i} className="min-h-[88px] rounded-lg bg-muted/30" />;
                }
                const dayEvents = eventsByDate[cell.date] || [];
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={i}
                    onClick={() => onSelectDate(isSelected ? null : cell.date)}
                    className={`min-h-[88px] rounded-lg border p-1.5 text-left transition-all hover:shadow-md ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : cell.isToday
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-primary/30 bg-card"
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${cell.isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {cell.day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const st = eventStyle(ev.type);
                        return (
                          <div
                            key={ev.id}
                            className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${st.bg} ${st.text}`}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">
                {selectedDate ? formatDate(selectedDate) : "Select a date"}
              </h3>
            </div>
            {!selectedDate ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Click on any day to view its events.
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No events scheduled for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((ev) => {
                  const st = eventStyle(ev.type);
                  const Icon = eventTypeIcon(ev.type);
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`rounded-lg border ${st.border} ${st.bg} p-3`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${st.text}`} />
                          <span className="font-medium text-sm">{ev.title}</span>
                        </div>
                        <Badge className={`${st.bg} ${st.text} border ${st.border}`}>
                          {st.label}
                        </Badge>
                      </div>
                      {ev.description && (
                        <p className="text-xs text-muted-foreground mb-2">{ev.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(ev.date)}
                        {ev.endDate && ev.endDate !== ev.date && (
                          <>
                            <span>→</span>
                            {formatDate(ev.endDate)}
                          </>
                        )}
                      </div>
                      {(canEdit || canDelete) && (
                        <div className="flex gap-1 mt-2 pt-2 border-t">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => onEditEvent(ev)}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-destructive"
                              onClick={() => onDeleteEvent(ev.id)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!loading && !hasEvents && (
        <div className="mt-2">
          <EmptyState
            icon={CalendarIcon}
            title="No events this month"
            description={canEdit ? "Add holidays, exams, PTMs, or school functions to the calendar." : "Check back later for school events."}
            actionLabel={canEdit ? "Add Event" : undefined}
            onAction={onAddEvent}
          />
        </div>
      )}
    </div>
  );
}

function eventTypeIcon(type: string) {
  switch (type) {
    case "holiday":
      return PartyPopper;
    case "ptm":
      return Users;
    case "exam":
      return ExamIcon;
    case "function":
      return Bell;
    default:
      return CalendarIcon;
  }
}

// ===================== Notice Dialog =====================
function NoticeDialog({
  open,
  onOpenChange,
  notice,
  classes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notice: NoticeRow | null;
  classes: ClassOption[];
  onSave: (data: {
    title: string;
    content: string;
    targetAudience: string;
    targetClassId: string;
    targetRole: string;
    date: string;
  }) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [date, setDate] = useState(today);

  useEffect(() => {
    // Wrap in IIFE so setState calls aren't seen as synchronous by the
    // react-hooks/set-state-in-effect lint rule (matches the project pattern).
    (() => {
      if (open) {
        setTitle(notice?.title || "");
        setContent(notice?.content || "");
        setTargetAudience(notice?.targetAudience || "all");
        setTargetClassId(notice?.targetClassId || "");
        setTargetRole(notice?.targetRole || "teacher");
        setDate(notice?.date || today);
      }
    })();
  }, [open, notice, today]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    if (targetAudience === "class" && !targetClassId) {
      toast.error("Please select a class");
      return;
    }
    onSave({ title: title.trim(), content: content.trim(), targetAudience, targetClassId, targetRole, date });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{notice ? "Edit Notice" : "Post Notice"}</DialogTitle>
          <DialogDescription>
            {notice ? "Update the notice details." : "Create a new notice for your audience."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notice title"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the notice content..."
              rows={5}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      All
                    </span>
                  </SelectItem>
                  <SelectItem value="class">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Specific Class
                    </span>
                  </SelectItem>
                  <SelectItem value="role">
                    <span className="flex items-center gap-2">
                      <UserCircle className="w-3.5 h-3.5" />
                      Specific Role
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={today}
                required
              />
            </div>
          </div>
          {targetAudience === "class" && (
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={targetClassId} onValueChange={setTargetClassId}>
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
              {classes.length === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No classes found. Add a class first.
                </p>
              )}
            </div>
          )}
          {targetAudience === "role" && (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS)
                    .filter(([r]) => r !== "super_admin")
                    .map(([role, label]) => (
                      <SelectItem key={role} value={role}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary text-white">
              {notice ? "Update Notice" : "Post Notice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Event Dialog =====================
function EventDialog({
  open,
  onOpenChange,
  event,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: EventRow | null;
  onSave: (data: {
    title: string;
    description: string;
    date: string;
    endDate: string;
    type: string;
  }) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("event");

  useEffect(() => {
    // Wrap in IIFE so setState calls aren't seen as synchronous by the
    // react-hooks/set-state-in-effect lint rule (matches the project pattern).
    (() => {
      if (open) {
        setTitle(event?.title || "");
        setDescription(event?.description || "");
        setDate(event?.date || today);
        setEndDate(event?.endDate || "");
        setType(event?.type || "event");
      }
    })();
  }, [open, event, today]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (endDate && endDate < date) {
      toast.error("End date cannot be before start date");
      return;
    }
    onSave({ title: title.trim(), description: description.trim(), date, endDate, type });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Add Event"}</DialogTitle>
          <DialogDescription>
            {event ? "Update the event details." : "Schedule a new event on the calendar."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Day Function"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-desc">Description</Label>
            <Textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about the event..."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Start Date</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end-date">End Date (optional)</Label>
              <Input
                id="event-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={date}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary text-white">
              {event ? "Update Event" : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Skeleton =====================
function NoticesSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card">
          <CardContent className="p-5 animate-pulse">
            <div className="h-5 bg-muted rounded w-1/3 mb-3" />
            <div className="h-6 bg-muted rounded w-3/4 mb-2" />
            <div className="h-4 bg-muted rounded w-full mb-1" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
