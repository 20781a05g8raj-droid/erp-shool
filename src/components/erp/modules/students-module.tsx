"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, UserPlus, Search, MoreHorizontal, Eye, Pencil, Trash2,
  Phone, Mail, MapPin, Calendar, Droplet, GraduationCap, User as UserIcon,
  Wallet, ClipboardCheck, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch, formatDate, formatCurrency, getInitials } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// ==================== Types ====================

interface ClassOption {
  id: string;
  name: string;
  order: number;
  sections: { id: string; name: string }[];
}

interface StudentListItem {
  id: string;
  admissionNumber: string;
  rollNumber?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
  status: string;
  gender?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  fatherName?: string | null;
  parentPhone?: string | null;
  admissionDate?: string | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

interface StudentDetail extends StudentListItem {
  dob?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  motherName?: string | null;
  parentEmail?: string | null;
  createdAt: string;
  attendance: { id: string; date: string; status: string }[];
  studentFees: {
    id: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
    feeStructure: { id: string; name: string; term: string };
  }[];
  examResults?: {
    id: string;
    marksObtained: number;
    maxMarks: number;
    grade?: string | null;
    subject?: { id: string; name: string } | null;
    exam?: { id: string; name: string } | null;
  }[];
  stats: {
    attendanceRate: number;
    totalAttendance: number;
    presentCount: number;
    feesTotal: number;
    feesPaid: number;
    feesDue: number;
  };
}

interface StudentFormState {
  admissionNumber: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  address: string;
  photo: string;
  classId: string;
  sectionId: string;
  status: string;
  fatherName: string;
  motherName: string;
  parentPhone: string;
  parentEmail: string;
  admissionDate: string;
}

// ==================== Constants ====================

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "alumni", label: "Alumni" },
  { value: "transferred", label: "Transferred" },
  { value: "suspended", label: "Suspended" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const STUDENT_STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  alumni: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  transferred: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const EMPTY_FORM: StudentFormState = {
  admissionNumber: "",
  rollNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  bloodGroup: "",
  address: "",
  photo: "",
  classId: "",
  sectionId: "",
  status: "active",
  fatherName: "",
  motherName: "",
  parentPhone: "",
  parentEmail: "",
  admissionDate: new Date().toISOString().split("T")[0],
};

// ==================== Component ====================

export function StudentsModule() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Dialog (Add/Edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<StudentDetail | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<StudentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------- Data fetching ----------
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (classFilter !== "all") params.set("classId", classFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<StudentListItem[]>(`/api/students${query}`);
      setStudents(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, statusFilter]);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiFetch<{ classes: ClassOption[] }>(`/api/classes`);
      setClasses(data.classes || []);
    } catch {
      // silent — selects will just be empty
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    void fetchClasses();
  }, [fetchClasses]);

  // Debounced search trigger
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ---------- Derived stats ----------
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.status === "active").length;
    const now = new Date();
    const newThisMonth = students.filter((s) => {
      if (!s.admissionDate) return false;
      const d = new Date(s.admissionDate);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    const inactive = students.filter(
      (s) => s.status === "transferred" || s.status === "alumni"
    ).length;
    return { total, active, newThisMonth, inactive };
  }, [students]);

  // ---------- Pagination ----------
  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = students.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---------- Dialog helpers ----------
  const openAddDialog = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (student: StudentListItem) => {
    setEditingId(student.id);
    setForm({
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber || "",
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email || "",
      phone: student.phone || "",
      dob: "",
      gender: student.gender || "",
      bloodGroup: "",
      address: "",
      photo: student.photo || "",
      classId: student.classId || "",
      sectionId: student.sectionId || "",
      status: student.status,
      fatherName: student.fatherName || "",
      motherName: "",
      parentPhone: student.parentPhone || "",
      parentEmail: "",
      admissionDate: student.admissionDate || "",
    });
    setDialogOpen(true);
  };

  // When editing an existing student, fetch full detail to prefill all fields
  useEffect(() => {
    if (editingId && dialogOpen) {
      void (async () => {
        try {
          const d = await apiFetch<StudentDetail>(`/api/students/${editingId}`);
          setForm((prev) => ({
            ...prev,
            dob: d.dob || "",
            gender: d.gender || prev.gender,
            bloodGroup: d.bloodGroup || "",
            address: d.address || "",
            motherName: d.motherName || "",
            parentEmail: d.parentEmail || "",
            admissionDate: d.admissionDate || prev.admissionDate,
            photo: d.photo || prev.photo,
          }));
        } catch {
          // ignore — basic fields already prefilled
        }
      })();
    }
  }, [editingId, dialogOpen]);

  const updateField = <K extends keyof StudentFormState>(
    key: K,
    value: StudentFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await apiFetch(`/api/students/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Student updated successfully");
      } else {
        await apiFetch(`/api/students`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Student admitted successfully");
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchStudents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save student");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Detail ----------
  const openDetail = async (student: StudentListItem) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await apiFetch<StudentDetail>(`/api/students/${student.id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load student");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------- Delete ----------
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/students/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Student deleted successfully");
      setDeleteTarget(null);
      if (detail?.id === deleteTarget.id) {
        setDetailOpen(false);
        setDetail(null);
      }
      await fetchStudents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete student");
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Sections for form ----------
  const selectedClass = classes.find((c) => c.id === form.classId);
  const availableSections = selectedClass?.sections || [];

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student admissions, profiles, and class assignments."
        icon={Users}
        actionLabel="Add Student"
        onAction={openAddDialog}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Students" value={stats.total} icon={Users} delay={0} />
        <StatsCard title="Active" value={stats.active} icon={GraduationCap} delay={0.05} color="text-emerald-500" />
        <StatsCard title="New This Month" value={stats.newThisMonth} icon={UserPlus} delay={0.1} color="text-blue-500" />
        <StatsCard title="Alumni / Transferred" value={stats.inactive} icon={ClipboardCheck} delay={0.15} color="text-amber-500" />
      </div>

      {/* Filter bar */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, admission no, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="All Classes" />
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table or Empty / Loading */}
      {loading ? (
        <Card className="glass-card p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </Card>
      ) : students.length === 0 ? (
        <Card className="glass-card">
          <EmptyState
            icon={Users}
            title="No students yet"
            description="Add your first student to start managing admissions, profiles, and class assignments."
            actionLabel="Add Student"
            onAction={openAddDialog}
          />
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <div className="max-h-[560px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                <TableRow>
                  <TableHead className="min-w-[220px]">Student</TableHead>
                  <TableHead>Class / Section</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Parent / Guardian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((student, idx) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.2), duration: 0.25 }}
                    className="hover:bg-muted/50 border-b transition-colors"
                  >
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          {student.photo ? (
                            <AvatarImage src={student.photo} alt={`${student.firstName} ${student.lastName}`} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(`${student.firstName} ${student.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {student.admissionNumber}
                            {student.rollNumber ? ` • #${student.rollNumber}` : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{student.class?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {student.section ? `Sec ${student.section.name}` : "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate">{student.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[180px]">{student.email || "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        <div className="font-medium">{student.fatherName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{student.parentPhone || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STUDENT_STATUS_STYLES[student.status] || "bg-muted text-muted-foreground"}
                      >
                        {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void openDetail(student)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(student)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => setDeleteTarget(student)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingId(null);
          setForm(EMPTY_FORM);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Student" : "Admit New Student"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update student information. All fields marked with * are required."
                : "Fill in the admission form. Required fields are marked with *."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Personal Info */}
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Admission Number" hint="Leave blank to auto-generate">
                  <Input
                    value={form.admissionNumber}
                    onChange={(e) => updateField("admissionNumber", e.target.value)}
                    placeholder="GRW0001 (auto)"
                  />
                </FormField>
                <FormField label="Roll Number">
                  <Input
                    value={form.rollNumber}
                    onChange={(e) => updateField("rollNumber", e.target.value)}
                    placeholder="e.g. 12"
                  />
                </FormField>
                <FormField label="First Name" required>
                  <Input
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="Diya"
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <Input
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    placeholder="Das"
                  />
                </FormField>
                <FormField label="Date of Birth">
                  <Input
                    type="date"
                    value={form.dob}
                    onChange={(e) => updateField("dob", e.target.value)}
                  />
                </FormField>
                <FormField label="Gender">
                  <Select value={form.gender || "__none"} onValueChange={(v) => updateField("gender", v === "__none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Not specified —</SelectItem>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Blood Group">
                  <Select value={form.bloodGroup || "__none"} onValueChange={(v) => updateField("bloodGroup", v === "__none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Unknown —</SelectItem>
                      {BLOOD_GROUPS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Photo URL">
                  <Input
                    value={form.photo}
                    onChange={(e) => updateField("photo", e.target.value)}
                    placeholder="https://..."
                  />
                </FormField>
              </div>
              <FormField label="Address">
                <Textarea
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Residential address"
                  rows={2}
                />
              </FormField>
            </FormSection>

            <Separator />

            {/* Contact Info */}
            <FormSection title="Contact Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="diya.das@student.edu"
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+91..."
                  />
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Parent/Guardian */}
            <FormSection title="Parent / Guardian">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Father's Name">
                  <Input
                    value={form.fatherName}
                    onChange={(e) => updateField("fatherName", e.target.value)}
                    placeholder="Father's full name"
                  />
                </FormField>
                <FormField label="Mother's Name">
                  <Input
                    value={form.motherName}
                    onChange={(e) => updateField("motherName", e.target.value)}
                    placeholder="Mother's full name"
                  />
                </FormField>
                <FormField label="Parent Phone">
                  <Input
                    value={form.parentPhone}
                    onChange={(e) => updateField("parentPhone", e.target.value)}
                    placeholder="+91..."
                  />
                </FormField>
                <FormField label="Parent Email">
                  <Input
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => updateField("parentEmail", e.target.value)}
                    placeholder="parent@email.com"
                  />
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Academic */}
            <FormSection title="Academic Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Class">
                  <Select
                    value={form.classId || "__none"}
                    onValueChange={(v) => {
                      updateField("classId", v === "__none" ? "" : v);
                      updateField("sectionId", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Unassigned —</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Section">
                  <Select
                    value={form.sectionId || "__none"}
                    onValueChange={(v) => updateField("sectionId", v === "__none" ? "" : v)}
                    disabled={availableSections.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          availableSections.length === 0
                            ? "Select class first"
                            : "Select section"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Unassigned —</SelectItem>
                      {availableSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Admission Date">
                  <Input
                    type="date"
                    value={form.admissionDate}
                    onChange={(e) => updateField("admissionDate", e.target.value)}
                  />
                </FormField>
                <FormField label="Status">
                  <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </FormSection>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gradient-primary text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingId ? "Saving..." : "Admitting..."}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {editingId ? "Save Changes" : "Admit Student"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="sr-only">Student Profile</SheetTitle>
            <SheetDescription className="sr-only">
              Full profile information for the selected student.
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading student profile...</p>
            </div>
          ) : detail ? (
            <div className="px-4 pb-8 space-y-6">
              {/* Header card */}
              <div className="flex items-center gap-4 pt-4">
                <Avatar className="w-16 h-16">
                  {detail.photo ? (
                    <AvatarImage src={detail.photo} alt={`${detail.firstName} ${detail.lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {getInitials(`${detail.firstName} ${detail.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">
                    {detail.firstName} {detail.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {detail.admissionNumber}
                    {detail.class?.name ? ` • ${detail.class.name}` : ""}
                    {detail.section?.name ? ` • Sec ${detail.section.name}` : ""}
                  </p>
                  <Badge
                    variant="outline"
                    className={`mt-1.5 ${STUDENT_STATUS_STYLES[detail.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <QuickStat
                  icon={ClipboardCheck}
                  label="Attendance"
                  value={`${detail.stats.attendanceRate}%`}
                  hint={`${detail.stats.presentCount}/${detail.stats.totalAttendance} days`}
                  color="text-emerald-500"
                />
                <QuickStat
                  icon={Wallet}
                  label="Fees Paid"
                  value={formatCurrency(detail.stats.feesPaid)}
                  hint={`of ${formatCurrency(detail.stats.feesTotal)}`}
                  color="text-blue-500"
                />
                <QuickStat
                  icon={Wallet}
                  label="Fees Due"
                  value={formatCurrency(detail.stats.feesDue)}
                  hint={detail.stats.feesDue > 0 ? "Pending" : "Clear"}
                  color={detail.stats.feesDue > 0 ? "text-red-500" : "text-emerald-500"}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setDetailOpen(false);
                    openEditDialog(detail);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  onClick={() => setDeleteTarget(detail)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>

              <DetailSection title="Personal Information" icon={UserIcon}>
                <DetailRow label="Date of Birth" value={formatDate(detail.dob)} />
                <DetailRow label="Gender" value={detail.gender ? detail.gender.charAt(0).toUpperCase() + detail.gender.slice(1) : "—"} />
                <DetailRow label="Blood Group" value={detail.bloodGroup || "—"} icon={Droplet} />
                <DetailRow label="Address" value={detail.address || "—"} icon={MapPin} />
              </DetailSection>

              <DetailSection title="Contact" icon={Phone}>
                <DetailRow label="Phone" value={detail.phone || "—"} icon={Phone} />
                <DetailRow label="Email" value={detail.email || "—"} icon={Mail} />
              </DetailSection>

              <DetailSection title="Parent / Guardian" icon={Users}>
                <DetailRow label="Father" value={detail.fatherName || "—"} />
                <DetailRow label="Mother" value={detail.motherName || "—"} />
                <DetailRow label="Parent Phone" value={detail.parentPhone || "—"} icon={Phone} />
                <DetailRow label="Parent Email" value={detail.parentEmail || "—"} icon={Mail} />
              </DetailSection>

              <DetailSection title="Academic" icon={GraduationCap}>
                <DetailRow label="Class" value={detail.class?.name || "—"} />
                <DetailRow label="Section" value={detail.section?.name ? `Section ${detail.section.name}` : "—"} />
                <DetailRow label="Roll Number" value={detail.rollNumber || "—"} />
                <DetailRow label="Admission Date" value={formatDate(detail.admissionDate)} icon={Calendar} />
              </DetailSection>

              {/* Fees breakdown */}
              {detail.studentFees.length > 0 && (
                <DetailSection title="Fee Records" icon={Wallet}>
                  <div className="space-y-2">
                    {detail.studentFees.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-md border p-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {f.feeStructure.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {f.feeStructure.term} • {formatCurrency(f.totalAmount)}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            f.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : f.status === "partial"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-amber-500/10 text-amber-600"
                          }
                        >
                          {formatCurrency(f.paidAmount)} / {formatCurrency(f.totalAmount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Recent exam results */}
              {detail.examResults && detail.examResults.length > 0 && (
                <DetailSection title="Recent Exam Results" icon={GraduationCap}>
                  <div className="space-y-2">
                    {detail.examResults.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{r.subject?.name || "—"}</span>
                        <span className="font-medium">
                          {r.marksObtained}/{r.maxMarks}
                          {r.grade ? ` (${r.grade})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">No data available.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.firstName} {deleteTarget?.lastName}
              </span>{" "}
              ({deleteTarget?.admissionNumber}). All related attendance, fee records,
              transport assignments, and certificates will also be removed. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== Sub Components ====================

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
      {children}
    </div>
  );
}

function FormField({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </h3>
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  hint,
  color = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-base font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
