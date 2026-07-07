"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap, UserPlus, Search, MoreHorizontal, Eye, Pencil, Trash2,
  Phone, Mail, Calendar, Briefcase, Users, UserCog, IndianRupee,
  ChevronLeft, ChevronRight, Loader2, Wallet,
  Building2, Award, CalendarOff, IdCard,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch, formatDate, formatCurrency, getInitials, STATUS_COLORS } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// ==================== Types ====================

interface StaffListItem {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  designation?: string | null;
  department?: string | null;
  qualification?: string | null;
  joiningDate?: string | null;
  type: string;
  photo?: string | null;
  salary: number;
  status: string;
}

interface StaffLeaveRow {
  id: string;
  fromDate: string;
  toDate: string;
  reason?: string | null;
  type: string;
  status: string;
}

interface PayrollRow {
  id: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: string;
  paidDate?: string | null;
}

interface StaffDetail extends StaffListItem {
  createdAt: string;
  leaves: StaffLeaveRow[];
  payrolls: PayrollRow[];
  leaveSummary: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    onLeaveToday: boolean;
  };
  payrollSummary: {
    totalGenerated: number;
    totalPaid: number;
    totalNetSalary: number;
    currentMonthPayroll: {
      id: string;
      status: string;
      netSalary: number;
      paidDate: string | null;
    } | null;
  };
}

interface StaffFormState {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  designation: string;
  department: string;
  qualification: string;
  joiningDate: string;
  type: string;
  salary: string;
  photo: string;
  status: string;
}

// ==================== Constants ====================

const PAGE_SIZE = 10;

const DEPARTMENTS = [
  "Administration",
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
  "Hindi",
  "Computer Science",
  "Finance",
  "Library",
  "Transport",
  "Human Resources",
  "Other",
];

const TYPE_OPTIONS = [
  { value: "teaching", label: "Teaching" },
  { value: "non_teaching", label: "Non-Teaching" },
];

const STAFF_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const STAFF_STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  on_leave: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const TYPE_STYLES: Record<string, string> = {
  teaching: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  non_teaching: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const DEPT_STYLES = "bg-primary/10 text-primary";

const EMPTY_FORM: StaffFormState = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  designation: "",
  department: "",
  qualification: "",
  joiningDate: new Date().toISOString().split("T")[0],
  type: "teaching",
  salary: "",
  photo: "",
  status: "active",
};

// ==================== Component ====================

export function StaffModule() {
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [onLeaveTodayCount, setOnLeaveTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Dialog (Add/Edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<StaffDetail | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<StaffListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------- Data fetching ----------
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (departmentFilter !== "all") params.set("department", departmentFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<{ staff: StaffListItem[] }>(`/api/staff${query}`);
      setStaff(data.staff || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [search, departmentFilter, typeFilter]);

  // Fetch approved leaves to determine "On Leave Today"
  const fetchOnLeaveToday = useCallback(async () => {
    try {
      const data = await apiFetch<{ leaves: { fromDate: string; toDate: string; status: string }[] }>(
        `/api/hr/leaves?status=approved`
      );
      const today = new Date().toISOString().split("T")[0];
      const count = (data.leaves || []).filter(
        (l) => l.status === "approved" && l.fromDate <= today && l.toDate >= today
      ).length;
      setOnLeaveTodayCount(count);
    } catch {
      // silent — stat just shows 0
    }
  }, []);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    void fetchOnLeaveToday();
  }, [fetchOnLeaveToday]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, typeFilter]);

  // ---------- Derived stats ----------
  const stats = useMemo(() => {
    const total = staff.length;
    const teaching = staff.filter((s) => s.type === "teaching").length;
    const nonTeaching = staff.filter((s) => s.type === "non_teaching").length;
    return { total, teaching, nonTeaching, onLeaveToday: onLeaveTodayCount };
  }, [staff, onLeaveTodayCount]);

  // ---------- Pagination ----------
  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = staff.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---------- Dialog helpers ----------
  const openAddDialog = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (s: StaffListItem) => {
    setEditingId(s.id);
    setForm({
      employeeId: s.employeeId,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email || "",
      phone: s.phone || "",
      dob: s.dob || "",
      gender: s.gender || "",
      designation: s.designation || "",
      department: s.department || "",
      qualification: s.qualification || "",
      joiningDate: s.joiningDate || "",
      type: s.type,
      salary: s.salary ? String(s.salary) : "",
      photo: s.photo || "",
      status: s.status,
    });
    setDialogOpen(true);
  };

  const updateField = <K extends keyof StaffFormState>(
    key: K,
    value: StaffFormState[K]
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
      const payload = {
        ...form,
        salary: form.salary ? parseFloat(form.salary) : 0,
      };
      if (editingId) {
        await apiFetch(`/api/staff/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Staff updated successfully");
      } else {
        await apiFetch(`/api/staff`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Staff added successfully");
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchStaff();
      await fetchOnLeaveToday();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save staff");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Detail ----------
  const openDetail = async (s: StaffListItem) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await apiFetch<StaffDetail>(`/api/staff/${s.id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load staff");
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
      await apiFetch(`/api/staff/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Staff deleted successfully");
      setDeleteTarget(null);
      if (detail?.id === deleteTarget.id) {
        setDetailOpen(false);
        setDetail(null);
      }
      await fetchStaff();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete staff");
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Manage teaching and non-teaching staff records, profiles, and assignments."
        icon={GraduationCap}
        actionLabel="Add Staff"
        onAction={openAddDialog}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Staff" value={stats.total} icon={Users} delay={0} />
        <StatsCard title="Teaching" value={stats.teaching} icon={GraduationCap} delay={0.05} color="text-blue-500" />
        <StatsCard title="Non-Teaching" value={stats.nonTeaching} icon={UserCog} delay={0.1} color="text-purple-500" />
        <StatsCard title="On Leave Today" value={stats.onLeaveToday} icon={CalendarOff} delay={0.15} color="text-amber-500" />
      </div>

      {/* Filter bar */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, employee ID, designation, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
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
      ) : staff.length === 0 ? (
        <Card className="glass-card">
          <EmptyState
            icon={GraduationCap}
            title="No staff yet"
            description="Add your first staff member to start managing teaching and non-teaching records."
            actionLabel="Add Staff"
            onAction={openAddDialog}
          />
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <div className="max-h-[560px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                <TableRow>
                  <TableHead className="min-w-[220px]">Staff</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((s, idx) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.2), duration: 0.25 }}
                    className="hover:bg-muted/50 border-b transition-colors"
                  >
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          {s.photo ? (
                            <AvatarImage src={s.photo} alt={`${s.firstName} ${s.lastName}`} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(`${s.firstName} ${s.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <IdCard className="w-3 h-3" />
                            {s.employeeId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium truncate max-w-[160px]">
                        {s.designation || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.department ? (
                        <Badge variant="outline" className={DEPT_STYLES}>
                          {s.department}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={TYPE_STYLES[s.type] || "bg-muted text-muted-foreground"}
                      >
                        {s.type === "non_teaching" ? "Non-Teaching" : "Teaching"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate">{s.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[160px]">{s.email || "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(s.joiningDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-semibold">
                        {formatCurrency(s.salary)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STAFF_STATUS_STYLES[s.status] || "bg-muted text-muted-foreground"}
                      >
                        {s.status === "on_leave"
                          ? "On Leave"
                          : (s.status || "active").charAt(0).toUpperCase() + (s.status || "active").slice(1)}
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
                          <DropdownMenuItem onClick={() => void openDetail(s)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(s)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => setDeleteTarget(s)}
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
                {Math.min(currentPage * PAGE_SIZE, staff.length)} of {staff.length}
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
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Staff" : "Add New Staff"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update staff information. Required fields are marked with *."
                : "Fill in the staff form. Leave Employee ID blank to auto-generate (e.g. EMP0001)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Personal Info */}
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Employee ID" hint="Leave blank to auto-generate EMP0001, EMP0002...">
                  <Input
                    value={form.employeeId}
                    onChange={(e) => updateField("employeeId", e.target.value)}
                    placeholder="EMP0001 (auto)"
                  />
                </FormField>
                <FormField label="Photo URL">
                  <Input
                    value={form.photo}
                    onChange={(e) => updateField("photo", e.target.value)}
                    placeholder="https://..."
                  />
                </FormField>
                <FormField label="First Name" required>
                  <Input
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="Anita"
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <Input
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    placeholder="Verma"
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
                  <Select
                    value={form.gender || "__none"}
                    onValueChange={(v) => updateField("gender", v === "__none" ? "" : v)}
                  >
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
              </div>
            </FormSection>

            <Separator />

            {/* Professional */}
            <FormSection title="Professional Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Designation">
                  <Input
                    value={form.designation}
                    onChange={(e) => updateField("designation", e.target.value)}
                    placeholder="e.g. Mathematics Teacher"
                  />
                </FormField>
                <FormField label="Department">
                  <Select
                    value={form.department || "__none"}
                    onValueChange={(v) => updateField("department", v === "__none" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— None —</SelectItem>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Staff Type">
                  <Select value={form.type} onValueChange={(v) => updateField("type", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Qualification">
                  <Input
                    value={form.qualification}
                    onChange={(e) => updateField("qualification", e.target.value)}
                    placeholder="e.g. M.Sc, B.Ed"
                  />
                </FormField>
                <FormField label="Joining Date">
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => updateField("joiningDate", e.target.value)}
                  />
                </FormField>
                <FormField label="Status">
                  <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </FormSection>

            <Separator />

            {/* Contact + Salary */}
            <FormSection title="Contact & Salary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="anita.verma@greenwood.edu"
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+91..."
                  />
                </FormField>
                <FormField label="Monthly Salary (₹)">
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={form.salary}
                    onChange={(e) => updateField("salary", e.target.value)}
                    placeholder="e.g. 35000"
                  />
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
                  {editingId ? "Saving..." : "Adding..."}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {editingId ? "Save Changes" : "Add Staff"}
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
            <SheetTitle className="sr-only">Staff Profile</SheetTitle>
            <SheetDescription className="sr-only">
              Full profile information for the selected staff member.
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading staff profile...</p>
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
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5" />
                    {detail.employeeId}
                    {detail.designation ? ` • ${detail.designation}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="outline" className={TYPE_STYLES[detail.type]}>
                      {detail.type === "non_teaching" ? "Non-Teaching" : "Teaching"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={STAFF_STATUS_STYLES[detail.status] || "bg-muted text-muted-foreground"}
                    >
                      {detail.status === "on_leave"
                        ? "On Leave"
                        : (detail.status || "active").charAt(0).toUpperCase() + (detail.status || "active").slice(1)}
                    </Badge>
                    {detail.leaveSummary.onLeaveToday && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        On Leave Today
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <QuickStat
                  icon={IndianRupee}
                  label="Monthly Salary"
                  value={formatCurrency(detail.salary)}
                  color="text-emerald-500"
                />
                <QuickStat
                  icon={CalendarOff}
                  label="Leaves Taken"
                  value={String(detail.leaveSummary.approved)}
                  hint={`${detail.leaveSummary.pending} pending`}
                  color="text-amber-500"
                />
                <QuickStat
                  icon={Wallet}
                  label="Current Payroll"
                  value={
                    detail.payrollSummary.currentMonthPayroll
                      ? detail.payrollSummary.currentMonthPayroll.status === "paid"
                        ? "Paid"
                        : "Pending"
                      : "Not Generated"
                  }
                  hint={
                    detail.payrollSummary.currentMonthPayroll
                      ? formatCurrency(detail.payrollSummary.currentMonthPayroll.netSalary)
                      : undefined
                  }
                  color={
                    detail.payrollSummary.currentMonthPayroll?.status === "paid"
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }
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

              <DetailSection title="Personal Information" icon={Users}>
                <DetailRow label="Date of Birth" value={formatDate(detail.dob)} />
                <DetailRow
                  label="Gender"
                  value={
                    detail.gender
                      ? detail.gender.charAt(0).toUpperCase() + detail.gender.slice(1)
                      : "—"
                  }
                />
              </DetailSection>

              <DetailSection title="Professional" icon={Briefcase}>
                <DetailRow label="Designation" value={detail.designation || "—"} />
                <DetailRow label="Department" value={detail.department || "—"} icon={Building2} />
                <DetailRow label="Staff Type" value={detail.type === "non_teaching" ? "Non-Teaching" : "Teaching"} />
                <DetailRow label="Qualification" value={detail.qualification || "—"} icon={Award} />
                <DetailRow label="Joining Date" value={formatDate(detail.joiningDate)} icon={Calendar} />
                <DetailRow label="Monthly Salary" value={formatCurrency(detail.salary)} icon={IndianRupee} />
              </DetailSection>

              <DetailSection title="Contact" icon={Phone}>
                <DetailRow label="Phone" value={detail.phone || "—"} icon={Phone} />
                <DetailRow label="Email" value={detail.email || "—"} icon={Mail} />
              </DetailSection>

              {/* Leave summary */}
              <DetailSection title="Leave Summary" icon={CalendarOff}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-bold">{detail.leaveSummary.total}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Approved</div>
                    <div className="font-bold text-emerald-600">{detail.leaveSummary.approved}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Pending</div>
                    <div className="font-bold text-amber-600">{detail.leaveSummary.pending}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Rejected</div>
                    <div className="font-bold text-red-600">{detail.leaveSummary.rejected}</div>
                  </div>
                </div>
                {detail.leaves.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Recent Leaves</div>
                    {detail.leaves.slice(0, 5).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between rounded-md border p-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium capitalize">{l.type} Leave</div>
                          <div className="text-muted-foreground">
                            {formatDate(l.fromDate)} → {formatDate(l.toDate)}
                          </div>
                          {l.reason && (
                            <div className="text-muted-foreground truncate">{l.reason}</div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[l.status] || "bg-muted text-muted-foreground"}
                        >
                          {(l.status || "pending").charAt(0).toUpperCase() + (l.status || "pending").slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>

              {/* Payroll summary */}
              <DetailSection title="Payroll Summary" icon={Wallet}>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Generated</div>
                    <div className="font-bold">{detail.payrollSummary.totalGenerated}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Paid</div>
                    <div className="font-bold text-emerald-600">{detail.payrollSummary.totalPaid}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-xs text-muted-foreground">Total Net</div>
                    <div className="font-bold text-xs">{formatCurrency(detail.payrollSummary.totalNetSalary)}</div>
                  </div>
                </div>
                {detail.payrolls.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Recent Payrolls</div>
                    {detail.payrolls.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border p-2 text-xs"
                      >
                        <div>
                          <div className="font-medium">
                            {new Date(p.year, p.month - 1).toLocaleDateString("en-IN", {
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-muted-foreground">Net: {formatCurrency(p.netSalary)}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[p.status] || "bg-muted text-muted-foreground"}
                        >
                          {(p.status || "pending").charAt(0).toUpperCase() + (p.status || "pending").slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            </div>
          ) : (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">No data available.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.firstName} {deleteTarget?.lastName}
              </span>{" "}
              ({deleteTarget?.employeeId}). All related leaves and payroll records will
              also be removed. This action cannot be undone.
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
      <div className="text-sm font-bold truncate">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

