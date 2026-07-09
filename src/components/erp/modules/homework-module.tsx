"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarClock,
  Paperclip,
  User,
  Filter,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch, formatDate } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { useAuthStore } from "@/store/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ==================== Types ====================

interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
}

interface HomeworkItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  attachment?: string | null;
  classId: string;
  sectionId?: string | null;
  subjectId?: string | null;
  staffId?: string | null;
  createdAt: string;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  subject?: { id: string; name: string; code?: string | null } | null;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  } | null;
}

// ==================== Constants ====================

const SUBJECT_COLORS = [
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-indigo-500/20",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-amber-500/20",
  "bg-pink-500/10 text-pink-600 dark:text-pink-300 ring-pink-500/20",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 ring-cyan-500/20",
  "bg-purple-500/10 text-purple-600 dark:text-purple-300 ring-purple-500/20",
];

function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function isOverdue(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

function daysUntil(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ==================== Component ====================

export function HomeworkModule() {
  const { user } = useAuthStore();
  const role = user?.role ?? "school_admin";

  const isStudent = role === "student" || role === "parent";
  const canPost = role === "teacher" || role === "school_admin" || role === "super_admin";
  const canManageAll = role === "school_admin" || role === "super_admin";

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterClassId, setFilterClassId] = useState<string>("all");

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HomeworkItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    classId: "",
    sectionId: "",
    subjectId: "",
    staffId: "",
    dueDate: "",
    attachment: "",
  });

  // ---------- Data loading ----------
  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, subjectsRes] = await Promise.all([
        apiFetch<{ classes: ClassOption[] }>("/api/classes"),
        apiFetch<{ subjects: SubjectOption[] }>("/api/subjects"),
      ]);
      setClasses(classesRes.classes);
      setSubjects(subjectsRes.subjects);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load metadata");
    }
  }, []);

  const fetchHomework = useCallback(async () => {
    setLoading(true);
    try {
      // For students/parents the API auto-scopes to their own class.
      // For staff/admin, optional classId filter applies.
      const params = new URLSearchParams();
      if (!isStudent && filterClassId !== "all") {
        params.set("classId", filterClassId);
      }
      if (role === "teacher" && user?.staffId) {
        params.set("staffId", user.staffId);
      }
      const query = params.toString();
      const res = await apiFetch<{ homework: HomeworkItem[] }>(
        `/api/homework${query ? `?${query}` : ""}`
      );
      setHomework(res.homework);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load homework");
      setHomework([]);
    } finally {
      setLoading(false);
    }
  }, [isStudent, filterClassId, role, user?.staffId]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  const selectedFormClass = classes.find((c) => c.id === form.classId);

  // ---------- Handlers ----------

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      classId: classes[0]?.id ?? "",
      sectionId: classes[0]?.sections[0]?.id ?? "",
      subjectId: "",
      staffId: user?.staffId ?? "",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      attachment: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (hw: HomeworkItem) => {
    setEditing(hw);
    setForm({
      title: hw.title,
      description: hw.description ?? "",
      classId: hw.classId,
      sectionId: hw.sectionId ?? "",
      subjectId: hw.subjectId ?? "",
      staffId: hw.staffId ?? "",
      dueDate: hw.dueDate,
      attachment: hw.attachment ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.classId) {
      toast.error("Class is required");
      return;
    }
    if (!form.dueDate) {
      toast.error("Due date is required");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      classId: form.classId,
      sectionId: form.sectionId || null,
      subjectId: form.subjectId || null,
      staffId: form.staffId || null,
      dueDate: form.dueDate,
      attachment: form.attachment.trim() || null,
    };
    try {
      if (editing) {
        await apiFetch(`/api/homework/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Homework updated");
      } else {
        await apiFetch("/api/homework", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Homework posted");
      }
      setDialogOpen(false);
      setEditing(null);
      await fetchHomework();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save homework");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/homework/${deleteId}`, { method: "DELETE" });
      toast.success("Homework deleted");
      setDeleteId(null);
      await fetchHomework();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  // Group homework for the "By Class" tab.
  const byClass = useMemo(() => {
    const groups: Record<string, HomeworkItem[]> = {};
    for (const hw of homework) {
      const key = hw.class?.name ?? "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(hw);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [homework]);

  // ---------- Render ----------

  const canEditItem = (hw: HomeworkItem) =>
    canManageAll ||
    (role === "teacher" && (!hw.staffId || hw.staffId === user?.staffId));

  return (
    <div>
      <PageHeader
        title="Homework"
        description={
          isStudent
            ? "Homework and assignments for your class."
            : canPost
              ? "Post and track homework and assignments."
              : "Homework and assignments."
        }
        icon={BookOpen}
        actionLabel={canPost ? "Post Homework" : undefined}
        onAction={canPost ? openCreate : undefined}
      />

      {classes.length === 0 && !loading ? (
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description="Homework is organized by class. Create classes first to post homework."
        />
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <TabsList className="glass-card">
              <TabsTrigger value="all">All Homework</TabsTrigger>
              <TabsTrigger value="by-class">By Class</TabsTrigger>
            </TabsList>

            {!isStudent && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterClassId} onValueChange={setFilterClassId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <TabsContent value="all">
            {loading ? (
              <LoadingState />
            ) : homework.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No homework yet"
                description={
                  canPost
                    ? "Post your first homework assignment and students will see it here."
                    : "No homework has been posted for your class yet."
                }
                actionLabel={canPost ? "Post Homework" : undefined}
                onAction={canPost ? openCreate : undefined}
              />
            ) : (
              <HomeworkList
                items={homework}
                canEdit={canEditItem}
                onEdit={openEdit}
                onDelete={setDeleteId}
              />
            )}
          </TabsContent>

          <TabsContent value="by-class">
            {loading ? (
              <LoadingState />
            ) : byClass.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No homework to group"
                description="Homework will be grouped by class here once posted."
              />
            ) : (
              <div className="space-y-6">
                {byClass.map(([className, items]) => (
                  <motion.div
                    key={className}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                        {className}
                      </h3>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                    <HomeworkList
                      items={items}
                      canEdit={canEditItem}
                      onEdit={openEdit}
                      onDelete={setDeleteId}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ===== Add / Edit dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Homework" : "Post New Homework"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the homework details below."
                : "Assign homework to a class. Students and parents will see it in their dashboard."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hw-title">Title *</Label>
              <Input
                id="hw-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Chapter 5 — Algebra exercises"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select
                  value={form.classId}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      classId: v,
                      sectionId:
                        classes.find((c) => c.id === v)?.sections[0]?.id ?? "",
                    })
                  }
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
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={form.sectionId}
                  onValueChange={(v) => setForm({ ...form, sectionId: v })}
                  disabled={!selectedFormClass || selectedFormClass.sections.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {selectedFormClass?.sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={form.subjectId}
                  onValueChange={(v) => setForm({ ...form, subjectId: v })}
                >
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hw-due">Due Date *</Label>
                <Input
                  id="hw-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hw-attach">Attachment URL (optional)</Label>
                <Input
                  id="hw-attach"
                  value={form.attachment}
                  onChange={(e) => setForm({ ...form, attachment: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-desc">Description / Instructions</Label>
              <Textarea
                id="hw-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed instructions, exercises, page numbers, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gradient-primary text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Post Homework"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete confirm ===== */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this homework?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the homework. Students will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== HomeworkList sub-component ====================

interface HomeworkListProps {
  items: HomeworkItem[];
  canEdit: (hw: HomeworkItem) => boolean;
  onEdit: (hw: HomeworkItem) => void;
  onDelete: (id: string) => void;
}

function HomeworkList({ items, canEdit, onEdit, onDelete }: HomeworkListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((hw, idx) => (
        <HomeworkCard
          key={hw.id}
          hw={hw}
          canEdit={canEdit(hw)}
          onEdit={() => onEdit(hw)}
          onDelete={() => onDelete(hw.id)}
          index={idx}
        />
      ))}
    </div>
  );
}

// ==================== HomeworkCard ====================

interface HomeworkCardProps {
  hw: HomeworkItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}

function HomeworkCard({ hw, canEdit, onEdit, onDelete, index }: HomeworkCardProps) {
  const overdue = isOverdue(hw.dueDate);
  const days = daysUntil(hw.dueDate);
  const subjectName = hw.subject?.name ?? "General";
  const teacherName = hw.staff
    ? `${hw.staff.firstName} ${hw.staff.lastName}`
    : "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="glass-card p-5 h-full flex flex-col group relative">
        {canEdit && (
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-60 group-hover:opacity-100">
                  <Plus className="w-4 h-4 rotate-45" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="flex items-start gap-3 pr-8">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-snug">{hw.title}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge
                variant="outline"
                className={cn("text-[10px] ring-1", subjectColor(subjectName))}
              >
                {subjectName}
                {hw.subject?.code ? ` · ${hw.subject.code}` : ""}
              </Badge>
              {hw.class && (
                <Badge variant="secondary" className="text-[10px]">
                  {hw.class.name}
                  {hw.section ? ` · ${hw.section.name}` : ""}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {hw.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-3 whitespace-pre-wrap">
            {hw.description}
          </p>
        )}

        <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {teacherName}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 font-medium",
              overdue
                ? "text-red-600 dark:text-red-400"
                : days <= 1
                  ? "text-amber-600 dark:text-amber-400"
                  : ""
            )}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Due {formatDate(hw.dueDate)}
            {overdue
              ? " · Overdue"
              : days === 0
                ? " · Today"
                : days === 1
                  ? " · Tomorrow"
                  : days > 0
                    ? ` · in ${days} days`
                    : ""}
          </span>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              overdue
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            )}
          >
            <Clock className="w-2.5 h-2.5 mr-1" />
            {overdue ? "Overdue" : "Pending"}
          </Badge>
          {hw.attachment && (
            <a
              href={hw.attachment}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Paperclip className="w-3 h-3" />
              Attachment
            </a>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ==================== LoadingState ====================

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card p-5 h-44 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        </Card>
      ))}
    </div>
  );
}
