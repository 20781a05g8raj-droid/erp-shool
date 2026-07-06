"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  School,
  Plus,
  Users,
  BookOpen,
  Layers,
  Trash2,
  Pencil,
  UserCog,
  X,
  Check,
  Loader2,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  designation?: string | null;
  department?: string | null;
  fullName: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
  classCount?: number;
}

interface SectionItem {
  id: string;
  name: string;
  classTeacherId?: string | null;
  classTeacher?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    designation?: string | null;
  } | null;
}

interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  order: number;
  studentCount: number;
  sections: SectionItem[];
  subjects: SubjectItem[];
}

// ==================== Constants ====================

const SUBJECT_BADGE_COLORS = [
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-indigo-500/20",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-amber-500/20",
  "bg-pink-500/10 text-pink-600 dark:text-pink-300 ring-pink-500/20",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 ring-cyan-500/20",
  "bg-purple-500/10 text-purple-600 dark:text-purple-300 ring-purple-500/20",
  "bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-rose-500/20",
  "bg-teal-500/10 text-teal-600 dark:text-teal-300 ring-teal-500/20",
];

function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_BADGE_COLORS[Math.abs(hash) % SUBJECT_BADGE_COLORS.length];
}

// ==================== Component ====================

export function ClassesModule() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Dialog states
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [manageSubjectsOpen, setManageSubjectsOpen] = useState(false);
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);

  // Class form
  const [className, setClassName] = useState("");
  const [classOrder, setClassOrder] = useState(0);

  // Section form
  const [sectionName, setSectionName] = useState("");
  const [sectionTeacherId, setSectionTeacherId] = useState<string>("");

  // Subject form
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [classesRes, subjectsRes, staffRes] = await Promise.all([
        apiFetch<{ classes: ClassItem[] }>("/api/classes"),
        apiFetch<{ subjects: SubjectOption[] }>("/api/subjects"),
        apiFetch<{ staff: StaffOption[] }>("/api/staff?teaching=true"),
      ]);
      setClasses(classesRes.classes);
      setSubjects(subjectsRes.subjects);
      setStaff(staffRes.staff);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-select the first class when the list loads (only once when going
  // from empty -> non-empty and nothing is selected).
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
    if (selectedClassId && !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0]?.id ?? null);
    }
  }, [classes, selectedClassId]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  // ---------- Handlers ----------

  const handleCreateClass = async () => {
    if (!className.trim()) {
      toast.error("Class name is required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/classes", {
        method: "POST",
        body: JSON.stringify({ name: className.trim(), order: classOrder }),
      });
      toast.success("Class created");
      setClassDialogOpen(false);
      setClassName("");
      setClassOrder(0);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClass = async () => {
    if (!selectedClass || !className.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/classes/${selectedClass.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: className.trim(), order: classOrder }),
      });
      toast.success("Class updated");
      setEditClassOpen(false);
      setClassName("");
      setClassOrder(0);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update class");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!deleteClassId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/classes/${deleteClassId}`, { method: "DELETE" });
      toast.success("Class deleted");
      setDeleteClassId(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete class");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = async () => {
    if (!selectedClass) return;
    if (!sectionName.trim()) {
      toast.error("Section name is required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/sections", {
        method: "POST",
        body: JSON.stringify({
          classId: selectedClass.id,
          name: sectionName.trim(),
          classTeacherId: sectionTeacherId || null,
        }),
      });
      toast.success("Section added");
      setSectionDialogOpen(false);
      setSectionName("");
      setSectionTeacherId("");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignClassTeacher = async (sectionId: string, teacherId: string) => {
    try {
      await apiFetch(`/api/sections/${sectionId}`, {
        method: "PUT",
        body: JSON.stringify({ classTeacherId: teacherId || null }),
      });
      toast.success("Class teacher updated");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update teacher");
    }
  };

  const handleDeleteSection = async () => {
    if (!deleteSectionId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/sections/${deleteSectionId}`, { method: "DELETE" });
      toast.success("Section deleted");
      setDeleteSectionId(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete section");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!subjectName.trim()) {
      toast.error("Subject name is required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/subjects", {
        method: "POST",
        body: JSON.stringify({ name: subjectName.trim(), code: subjectCode.trim() || null }),
      });
      toast.success("Subject created");
      setSubjectName("");
      setSubjectCode("");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create subject");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSubject = async (subjectId: string) => {
    if (!selectedClass) return;
    try {
      await apiFetch("/api/class-subjects", {
        method: "POST",
        body: JSON.stringify({ classId: selectedClass.id, subjectId }),
      });
      toast.success("Subject assigned");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign subject");
    }
  };

  const handleUnassignSubject = async (subjectId: string) => {
    if (!selectedClass) return;
    try {
      await apiFetch("/api/class-subjects", {
        method: "DELETE",
        body: JSON.stringify({ classId: selectedClass.id, subjectId }),
      });
      toast.success("Subject removed");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove subject");
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Classes & Sections"
          description="Organize classes, sections, subjects, and class teachers."
          icon={School}
          actionLabel="Add Class"
          onAction={() => {
            setClassName("");
            setClassOrder(0);
            setClassDialogOpen(true);
          }}
        />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div>
        <PageHeader
          title="Classes & Sections"
          description="Organize classes, sections, subjects, and class teachers."
          icon={School}
          actionLabel="Add Class"
          onAction={() => {
            setClassName("");
            setClassOrder(0);
            setClassDialogOpen(true);
          }}
        />
        <EmptyState
          icon={School}
          title="No classes yet"
          description="Start by creating your first class. Then add sections, assign class teachers, and link subjects."
          actionLabel="Add Class"
          onAction={() => {
            setClassName("");
            setClassOrder(0);
            setClassDialogOpen(true);
          }}
        />
        <ClassDialog
          open={classDialogOpen}
          onOpenChange={setClassDialogOpen}
          name={className}
          setName={setClassName}
          order={classOrder}
          setOrder={setClassOrder}
          onSave={handleCreateClass}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Classes & Sections"
        description="Organize classes, sections, subjects, and class teachers."
        icon={School}
        actionLabel="Add Class"
        onAction={() => {
          setClassName("");
          setClassOrder(0);
          setClassDialogOpen(true);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* LEFT — class list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-medium text-muted-foreground">
              {classes.length} class{classes.length !== 1 ? "es" : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setSubjectName("");
                setSubjectCode("");
                setSubjectDialogOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Subject
            </Button>
          </div>
          <motion.div layout className="space-y-2.5">
            {classes.map((cls) => {
              const active = cls.id === selectedClassId;
              return (
                <motion.button
                  key={cls.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all glass-card",
                    active
                      ? "border-primary/40 ring-1 ring-primary/20 shadow-sm"
                      : "border-border/60 hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          active ? "gradient-primary text-white" : "bg-primary/10 text-primary"
                        )}
                      >
                        <School className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{cls.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          order {cls.order}
                        </p>
                      </div>
                    </div>
                    {active && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Plus className="w-4 h-4 rotate-90" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => {
                              setClassName(cls.name);
                              setClassOrder(cls.order);
                              setEditClassOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Class
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSectionName("");
                              setSectionTeacherId("");
                              setSectionDialogOpen(true);
                            }}
                          >
                            <Layers className="w-4 h-4 mr-2" />
                            Add Section
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setManageSubjectsOpen(true)}
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            Manage Subjects
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteClassId(cls.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      {cls.sections.length} section{cls.sections.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {cls.subjects.length} subject{cls.subjects.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>

        {/* RIGHT — selected class details */}
        {selectedClass ? (
          <motion.div
            key={selectedClass.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header card */}
            <Card className="glass-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{selectedClass.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Order #{selectedClass.order} • {selectedClass.studentCount} students
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSectionName("");
                      setSectionTeacherId("");
                      setSectionDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Section
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManageSubjectsOpen(true)}
                  >
                    <BookOpen className="w-4 h-4 mr-1.5" />
                    Subjects
                  </Button>
                </div>
              </div>
            </Card>

            {/* Sections table */}
            <Card className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Sections</h3>
                  <Badge variant="secondary">{selectedClass.sections.length}</Badge>
                </div>
              </div>
              {selectedClass.sections.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No sections yet. Add one to start enrolling students.
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Section</TableHead>
                        <TableHead>Class Teacher</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClass.sections.map((sec) => (
                        <TableRow key={sec.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {sec.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sec.classTeacher ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                  {sec.classTeacher.firstName[0]}
                                  {sec.classTeacher.lastName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {sec.classTeacher.firstName} {sec.classTeacher.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {sec.classTeacher.designation ?? "Teacher"} •{" "}
                                    {sec.classTeacher.employeeId}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                Not assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              <Select
                                value={sec.classTeacherId ?? "none"}
                                onValueChange={(v) =>
                                  handleAssignClassTeacher(
                                    sec.id,
                                    v === "none" ? "" : v
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-8 p-0 border-0 [&>svg]:hidden gap-0">
                                  <UserCog className="w-4 h-4 text-muted-foreground" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— No teacher —</SelectItem>
                                  {staff.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.fullName} ({s.employeeId})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setDeleteSectionId(sec.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            {/* Subjects chips */}
            <Card className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Subjects Taught</h3>
                  <Badge variant="secondary">{selectedClass.subjects.length}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManageSubjectsOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Assign
                </Button>
              </div>
              {selectedClass.subjects.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No subjects assigned. Click &quot;Assign&quot; to link subjects.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedClass.subjects.map((subj) => (
                    <Badge
                      key={subj.id}
                      variant="outline"
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium ring-1",
                        subjectColor(subj.name)
                      )}
                    >
                      {subj.name}
                      {subj.code ? (
                        <span className="opacity-60 ml-1.5">· {subj.code}</span>
                      ) : null}
                      <button
                        className="ml-1.5 hover:opacity-70"
                        onClick={() => handleUnassignSubject(subj.id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        ) : (
          <div className="flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a class to view details</p>
          </div>
        )}
      </div>

      {/* ===== Dialogs ===== */}

      <ClassDialog
        open={classDialogOpen}
        onOpenChange={setClassDialogOpen}
        name={className}
        setName={setClassName}
        order={classOrder}
        setOrder={setClassOrder}
        onSave={handleCreateClass}
        saving={saving}
      />

      <ClassDialog
        open={editClassOpen}
        onOpenChange={setEditClassOpen}
        name={className}
        setName={setClassName}
        order={classOrder}
        setOrder={setClassOrder}
        onSave={handleEditClass}
        saving={saving}
        mode="edit"
      />

      {/* Add Section dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Section to {selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Create a new section (e.g. A, B, C) and optionally assign a class teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="section-name">Section Name *</Label>
              <Input
                id="section-name"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="e.g. A"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Class Teacher (optional)</Label>
              <Select
                value={sectionTeacherId}
                onValueChange={setSectionTeacherId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {staff.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No teaching staff available
                    </SelectItem>
                  ) : (
                    staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName} ({s.employeeId})
                        {s.designation ? ` · ${s.designation}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSection}
              disabled={saving}
              className="gradient-primary text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subject dialog */}
      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Subject</DialogTitle>
            <DialogDescription>
              Subjects can be assigned to any class once created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="subject-name">Subject Name *</Label>
              <Input
                id="subject-name"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-code">Subject Code (optional)</Label>
              <Input
                id="subject-code"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="e.g. MATH101"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubject}
              disabled={saving}
              className="gradient-primary text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Subjects dialog (assign/unassign to selected class) */}
      <Dialog open={manageSubjectsOpen} onOpenChange={setManageSubjectsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Subjects — {selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Tick the subjects taught in this class. Untick to remove.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto py-1 pr-1">
            {subjects.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No subjects created yet. Close this dialog and create one.
              </div>
            ) : (
              subjects.map((subj) => {
                const assigned = selectedClass?.subjects.some((s) => s.id === subj.id);
                return (
                  <button
                    key={subj.id}
                    onClick={() =>
                      assigned
                        ? handleUnassignSubject(subj.id)
                        : handleAssignSubject(subj.id)
                    }
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                      assigned
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 hover:border-primary/30"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{subj.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {subj.code ? `Code: ${subj.code}` : "No code"} • used in{" "}
                        {subj.classCount ?? 0} class
                        {(subj.classCount ?? 0) !== 1 ? "es" : ""}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center shrink-0 ml-3",
                        assigned
                          ? "gradient-primary text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {assigned ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setManageSubjectsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete class confirm */}
      <AlertDialog open={!!deleteClassId} onOpenChange={(v) => !v && setDeleteClassId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the class along with all its sections, class-subject
              links, timetables, and homework. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClass}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete section confirm */}
      <AlertDialog
        open={!!deleteSectionId}
        onOpenChange={(v) => !v && setDeleteSectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              Section timetables and homework will be removed. Students in this section will
              remain but lose their section link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
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

// ==================== ClassDialog sub-component ====================

interface ClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  setName: (v: string) => void;
  order: number;
  setOrder: (v: number) => void;
  onSave: () => void;
  saving: boolean;
  mode?: "create" | "edit";
}

function ClassDialog({
  open,
  onOpenChange,
  name,
  setName,
  order,
  setOrder,
  onSave,
  saving,
  mode = "create",
}: ClassDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Class" : "Add New Class"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the class name and ordering."
              : "Create a new class. You can add sections and subjects next."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="class-name">Class Name *</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class 10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-order">Display Order</Label>
            <Input
              id="class-order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in lists.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="gradient-primary text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "edit" ? "Save Changes" : "Create Class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
