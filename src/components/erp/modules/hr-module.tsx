"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  UserCog, CalendarOff, CheckCircle2, XCircle, Clock, Plus, Printer,
  Wallet, IndianRupee, TrendingDown, TrendingUp, Users, FileText,
  Loader2, Eye, GraduationCap, Building2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/store/auth";
import {
  apiFetch, formatDate, formatCurrency, getInitials, STATUS_COLORS,
} from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

// ==================== Types ====================

interface StaffOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  department?: string | null;
  type: string;
  photo?: string | null;
  salary: number;
}

interface StaffLite {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  department?: string | null;
  type: string;
  photo?: string | null;
}

interface LeaveRow {
  id: string;
  staffId: string;
  fromDate: string;
  toDate: string;
  reason?: string | null;
  type: string;
  status: string;
  approvedBy?: string | null;
  createdAt: string;
  staff: StaffLite;
}

interface PayrollRow {
  id: string;
  staffId: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: string;
  paidDate?: string | null;
  createdAt: string;
  staff: StaffLite & { salary: number };
}

interface PayslipData {
  payroll: PayrollRow & {
    staff: StaffLite & {
      salary: number;
      email?: string | null;
      phone?: string | null;
      joiningDate?: string | null;
    };
  };
  school: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
  } | null;
}

// ==================== Constants ====================

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual: "Casual",
  sick: "Sick",
  earned: "Earned",
  unpaid: "Unpaid",
};

const LEAVE_TYPE_STYLES: Record<string, string> = {
  casual: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sick: "bg-red-500/10 text-red-600 dark:text-red-400",
  earned: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  unpaid: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEAVE_TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
];

const LEAVE_STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const PAYROLL_STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
];

// ==================== Helpers ====================

function daysBetween(from: string, to: string): number {
  const f = new Date(from);
  const t = new Date(to);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return 0;
  const diff = Math.round((t.getTime() - f.getTime()) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

function monthLabel(month: number, year: number): string {
  if (month < 1 || month > 12) return `${year}`;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ==================== Main Component ====================

export function HrModule() {
  const { user } = useAuthStore();
  const isTeacher = user?.role === "teacher";
  const canApprove = !isTeacher;

  const [activeTab, setActiveTab] = useState("leaves");

  // Shared data
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Leaves
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDetail, setLeaveDetail] = useState<LeaveRow | null>(null);
  const [leaveDetailOpen, setLeaveDetailOpen] = useState(false);

  // Payroll
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const now = new Date();
  const [payMonth, setPayMonth] = useState<number>(now.getMonth() + 1);
  const [payYear, setPayYear] = useState<number>(now.getFullYear());
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("all");
  const [payslipData, setPayslipData] = useState<PayslipData | null>(null);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipLoading, setPayslipLoading] = useState(false);

  // Apply leave form
  const [leaveForm, setLeaveForm] = useState({
    staffId: "",
    fromDate: new Date().toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
    type: "casual",
    reason: "",
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ---------- Data fetching ----------
  const fetchStaff = useCallback(async () => {
    try {
      const data = await apiFetch<{ staff: StaffOption[] }>(`/api/staff`);
      setStaffList(data.staff || []);
    } catch {
      toast.error("Failed to load staff list");
    }
  }, []);

  const fetchLeaves = useCallback(async () => {
    setLoadingLeaves(true);
    try {
      const params = new URLSearchParams();
      if (leaveStatusFilter !== "all") params.set("status", leaveStatusFilter);
      const qs = params.toString();
      const data = await apiFetch<{ leaves: LeaveRow[] }>(
        `/api/hr/leaves${qs ? `?${qs}` : ""}`
      );
      setLeaves(data.leaves || []);
    } catch {
      toast.error("Failed to load leave requests");
    } finally {
      setLoadingLeaves(false);
    }
  }, [leaveStatusFilter]);

  const fetchPayrolls = useCallback(async () => {
    setLoadingPayroll(true);
    try {
      const params = new URLSearchParams();
      params.set("month", String(payMonth));
      params.set("year", String(payYear));
      if (payrollStatusFilter !== "all") params.set("status", payrollStatusFilter);
      const data = await apiFetch<{ payrolls: PayrollRow[] }>(
        `/api/hr/payroll?${params.toString()}`
      );
      setPayrolls(data.payrolls || []);
    } catch {
      toast.error("Failed to load payroll");
    } finally {
      setLoadingPayroll(false);
    }
  }, [payMonth, payYear, payrollStatusFilter]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    if (activeTab === "leaves") fetchLeaves();
  }, [activeTab, fetchLeaves]);

  useEffect(() => {
    if (activeTab === "payroll") fetchPayrolls();
  }, [activeTab, fetchPayrolls]);

  // For teachers: lock leaveForm.staffId to their own staffId
  useEffect(() => {
    if (isTeacher && user?.staffId) {
      setLeaveForm((prev) => ({ ...prev, staffId: user.staffId! }));
    }
  }, [isTeacher, user]);

  // ---------- Derived stats ----------
  const leaveStats = useMemo(() => {
    const nowDate = new Date();
    const total = leaves.length;
    const pending = leaves.filter((l) => l.status === "pending").length;
    const approved = leaves.filter((l) => l.status === "approved").length;
    const rejected = leaves.filter((l) => l.status === "rejected").length;
    const thisMonth = leaves.filter((l) => {
      const d = new Date(l.createdAt);
      return (
        d.getMonth() === nowDate.getMonth() &&
        d.getFullYear() === nowDate.getFullYear()
      );
    }).length;
    return { total, pending, approved, rejected, thisMonth };
  }, [leaves]);

  const payrollStats = useMemo(() => {
    const totalSalary = payrolls.reduce((s, p) => s + p.basicSalary, 0);
    const totalAllowances = payrolls.reduce((s, p) => s + p.allowances, 0);
    const totalDeductions = payrolls.reduce((s, p) => s + p.deductions, 0);
    const netPayable = payrolls.reduce((s, p) => s + p.netSalary, 0);
    const paidCount = payrolls.filter((p) => p.status === "paid").length;
    return { totalSalary, totalAllowances, totalDeductions, netPayable, paidCount };
  }, [payrolls]);

  // ---------- Handlers ----------
  const handleOpenLeaveDialog = () => {
    setLeaveForm({
      staffId: isTeacher && user?.staffId ? user.staffId : "",
      fromDate: new Date().toISOString().split("T")[0],
      toDate: new Date().toISOString().split("T")[0],
      type: "casual",
      reason: "",
    });
    setLeaveDialogOpen(true);
  };

  const handleSubmitLeave = async () => {
    if (!leaveForm.staffId) {
      toast.error("Please select a staff member");
      return;
    }
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      toast.error("From date and to date are required");
      return;
    }
    if (leaveForm.fromDate > leaveForm.toDate) {
      toast.error("From date cannot be after to date");
      return;
    }
    setSubmittingLeave(true);
    try {
      await apiFetch(`/api/hr/leaves`, {
        method: "POST",
        body: JSON.stringify(leaveForm),
      });
      toast.success("Leave request submitted");
      setLeaveDialogOpen(false);
      await fetchLeaves();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit leave");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleApproveReject = async (leave: LeaveRow, status: "approved" | "rejected") => {
    try {
      await apiFetch(`/api/hr/leaves/${leave.id}`, {
        method: "PUT",
        body: JSON.stringify({ status, approvedBy: user?.name || "HR" }),
      });
      toast.success(`Leave ${status}`);
      await fetchLeaves();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${status} leave`);
    }
  };

  const handleGeneratePayroll = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch<{ generated: number; skipped: number; message?: string }>(
        `/api/hr/payroll`,
        {
          method: "POST",
          body: JSON.stringify({ month: payMonth, year: payYear }),
        }
      );
      if (res.generated > 0) {
        toast.success(`Generated payroll for ${res.generated} staff`);
      } else {
        toast.info(res.message || "Payroll already generated for all staff this month");
      }
      await fetchPayrolls();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate payroll");
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (payroll: PayrollRow) => {
    try {
      await apiFetch(`/api/hr/payroll/${payroll.id}`, {
        method: "PUT",
        body: JSON.stringify({
          paidDate: new Date().toISOString().split("T")[0],
        }),
      });
      toast.success("Marked as paid");
      await fetchPayrolls();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as paid");
    }
  };

  const handleOpenPayslip = async (payroll: PayrollRow) => {
    setPayslipOpen(true);
    setPayslipLoading(true);
    setPayslipData(null);
    try {
      const data = await apiFetch<PayslipData>(`/api/hr/payroll/${payroll.id}`);
      setPayslipData(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payslip");
      setPayslipOpen(false);
    } finally {
      setPayslipLoading(false);
    }
  };

  const handlePrintPayslip = () => {
    window.print();
  };

  // ---------- Render ----------
  return (
    <div>
      {/* Print styles for payslip */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .payslip-print-area, .payslip-print-area * { visibility: visible !important; }
          .payslip-print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border: none !important;
            transform: none !important;
            max-height: none !important; overflow: visible !important;
          }
          .payslip-print-area .payslip-paper {
            box-shadow: none !important; border: none !important;
            margin: 0 !important; padding: 24px !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
        }
        `,
        }}
      />

      <PageHeader
        title="HR & Payroll"
        description="Manage staff leaves, monthly payroll, and payslips."
        icon={UserCog}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="leaves">Leave Requests</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>

        {/* ===================== LEAVE REQUESTS ===================== */}
        <TabsContent value="leaves">
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title="Pending" value={leaveStats.pending} icon={Clock} delay={0} color="text-amber-500" />
              <StatsCard title="Approved" value={leaveStats.approved} icon={CheckCircle2} delay={0.05} color="text-emerald-500" />
              <StatsCard title="Rejected" value={leaveStats.rejected} icon={XCircle} delay={0.1} color="text-red-500" />
              <StatsCard title="Total This Month" value={leaveStats.thisMonth} icon={CalendarOff} delay={0.15} color="text-blue-500" />
            </div>

            {/* Filter + Apply button */}
            <Card className="glass-card p-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Select value={leaveStatusFilter} onValueChange={setLeaveStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_STATUS_FILTERS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleOpenLeaveDialog}
                  className="gradient-primary text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Apply Leave
                </Button>
              </div>
            </Card>

            {/* Leaves table */}
            {loadingLeaves ? (
              <Card className="glass-card p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
                ))}
              </Card>
            ) : leaves.length === 0 ? (
              <Card className="glass-card">
                <EmptyState
                  icon={CalendarOff}
                  title="No leave requests"
                  description={
                    isTeacher
                      ? "You have no leave requests matching the current filter. Apply for leave using the button above."
                      : "There are no leave requests matching the current filter. Apply for leave on behalf of staff using the button above."
                  }
                  actionLabel="Apply Leave"
                  onAction={handleOpenLeaveDialog}
                />
              </Card>
            ) : (
              <Card className="glass-card overflow-hidden">
                <div className="max-h-[560px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <TableRow>
                        <TableHead className="min-w-[200px]">Staff</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead className="min-w-[200px]">Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((l, idx) => (
                        <motion.tr
                          key={l.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.2), duration: 0.25 }}
                          className="hover:bg-muted/50 border-b transition-colors"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                {l.staff.photo ? (
                                  <AvatarImage src={l.staff.photo} alt={`${l.staff.firstName} ${l.staff.lastName}`} />
                                ) : null}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                  {getInitials(`${l.staff.firstName} ${l.staff.lastName}`)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {l.staff.firstName} {l.staff.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {l.staff.employeeId}
                                  {l.staff.department ? ` • ${l.staff.department}` : ""}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={LEAVE_TYPE_STYLES[l.type] || "bg-muted text-muted-foreground"}>
                              {LEAVE_TYPE_LABELS[l.type] || l.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{formatDate(l.fromDate)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{formatDate(l.toDate)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {daysBetween(l.fromDate, l.toDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground line-clamp-2 max-w-[260px]">
                              {l.reason || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={STATUS_COLORS[l.status] || "bg-muted text-muted-foreground"}
                            >
                              {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setLeaveDetail(l);
                                  setLeaveDetailOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                                <span className="sr-only">View</span>
                              </Button>
                              {canApprove && l.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                                    onClick={() => void handleApproveReject(l, "approved")}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-red-600 border-red-500/30 hover:bg-red-500/10"
                                    onClick={() => void handleApproveReject(l, "rejected")}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===================== PAYROLL ===================== */}
        <TabsContent value="payroll">
          <div className="space-y-6">
            {/* Period selector + generate */}
            <Card className="glass-card p-4">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <Label className="text-xs text-muted-foreground mr-1">Period:</Label>
                  <Select
                    value={String(payMonth)}
                    onValueChange={(v) => setPayMonth(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(payYear)}
                    onValueChange={(v) => setPayYear(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={payrollStatusFilter}
                    onValueChange={setPayrollStatusFilter}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYROLL_STATUS_FILTERS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isTeacher && (
                  <Button
                    onClick={() => void handleGeneratePayroll()}
                    disabled={generating}
                    className="gradient-primary text-white"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Generate Payroll
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatsCard
                title="Total Basic"
                value={formatCurrency(payrollStats.totalSalary)}
                icon={IndianRupee}
                delay={0}
              />
              <StatsCard
                title="Allowances"
                value={formatCurrency(payrollStats.totalAllowances)}
                icon={TrendingUp}
                delay={0.05}
                color="text-emerald-500"
              />
              <StatsCard
                title="Deductions"
                value={formatCurrency(payrollStats.totalDeductions)}
                icon={TrendingDown}
                delay={0.1}
                color="text-red-500"
              />
              <StatsCard
                title="Net Payable"
                value={formatCurrency(payrollStats.netPayable)}
                icon={Wallet}
                delay={0.15}
                color="text-blue-500"
              />
              <StatsCard
                title="Paid"
                value={`${payrollStats.paidCount} / ${payrolls.length}`}
                icon={CheckCircle2}
                delay={0.2}
                color="text-emerald-500"
              />
            </div>

            {/* Payroll table */}
            {loadingPayroll ? (
              <Card className="glass-card p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
                ))}
              </Card>
            ) : payrolls.length === 0 ? (
              <Card className="glass-card">
                <EmptyState
                  icon={Wallet}
                  title={`No payroll for ${monthLabel(payMonth, payYear)}`}
                  description={
                    isTeacher
                      ? "Your payslip for the selected period has not been generated yet."
                      : `No payroll records found for ${monthLabel(payMonth, payYear)}. Click "Generate Payroll" to create payslips for all staff.`
                  }
                  actionLabel={isTeacher ? undefined : "Generate Payroll"}
                  onAction={isTeacher ? undefined : () => void handleGeneratePayroll()}
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
                        <TableHead className="text-right">Basic</TableHead>
                        <TableHead className="text-right">Allowances</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Net Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrolls.map((p, idx) => (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.2), duration: 0.25 }}
                          className="hover:bg-muted/50 border-b transition-colors"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                {p.staff.photo ? (
                                  <AvatarImage src={p.staff.photo} alt={`${p.staff.firstName} ${p.staff.lastName}`} />
                                ) : null}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                  {getInitials(`${p.staff.firstName} ${p.staff.lastName}`)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {p.staff.firstName} {p.staff.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {p.staff.employeeId}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium truncate max-w-[160px]">
                                {p.staff.designation || "—"}
                              </div>
                              {p.staff.department && (
                                <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                                  {p.staff.department}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(p.basicSalary)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-emerald-600">
                            +{formatCurrency(p.allowances)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-red-600">
                            −{formatCurrency(p.deductions)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold">
                            {formatCurrency(p.netSalary)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={STATUS_COLORS[p.status] || "bg-muted text-muted-foreground"}
                            >
                              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </Badge>
                            {p.paidDate && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {formatDate(p.paidDate)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => void handleOpenPayslip(p)}
                              >
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                Payslip
                              </Button>
                              {!isTeacher && p.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                                  onClick={() => void handleMarkPaid(p)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ===================== DIRECTORY ===================== */}
        <TabsContent value="directory">
          <DirectoryTab staffList={staffList} onSwitchToStaff={() => useAuthStore.getState().setModule("staff")} />
        </TabsContent>
      </Tabs>

      {/* Apply Leave Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Submit a leave request. Approvers will be notified for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Staff Member</Label>
              <Select
                value={leaveForm.staffId || "__none"}
                onValueChange={(v) =>
                  setLeaveForm((prev) => ({ ...prev, staffId: v === "__none" ? "" : v }))
                }
                disabled={isTeacher}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Select staff —</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={(e) =>
                    setLeaveForm((prev) => ({ ...prev, fromDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={leaveForm.toDate}
                  onChange={(e) =>
                    setLeaveForm((prev) => ({ ...prev, toDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Leave Type</Label>
              <Select
                value={leaveForm.type}
                onValueChange={(v) => setLeaveForm((prev) => ({ ...prev, type: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={leaveForm.reason}
                onChange={(e) =>
                  setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Briefly describe the reason for leave..."
                rows={3}
              />
            </div>

            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Duration: <span className="font-semibold text-foreground">{daysBetween(leaveForm.fromDate, leaveForm.toDate)} day(s)</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeaveDialogOpen(false)}
              disabled={submittingLeave}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmitLeave()}
              disabled={submittingLeave}
              className="gradient-primary text-white"
            >
              {submittingLeave ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Detail Dialog */}
      <Dialog open={leaveDetailOpen} onOpenChange={setLeaveDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              Submitted on {formatDate(leaveDetail?.createdAt || "")}
            </DialogDescription>
          </DialogHeader>
          {leaveDetail && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  {leaveDetail.staff.photo ? (
                    <AvatarImage src={leaveDetail.staff.photo} alt={`${leaveDetail.staff.firstName} ${leaveDetail.staff.lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(`${leaveDetail.staff.firstName} ${leaveDetail.staff.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">
                    {leaveDetail.staff.firstName} {leaveDetail.staff.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {leaveDetail.staff.employeeId}
                    {leaveDetail.staff.designation ? ` • ${leaveDetail.staff.designation}` : ""}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="mt-1">
                    <Badge variant="outline" className={LEAVE_TYPE_STYLES[leaveDetail.type] || "bg-muted text-muted-foreground"}>
                      {LEAVE_TYPE_LABELS[leaveDetail.type] || leaveDetail.type}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <Badge variant="outline" className={STATUS_COLORS[leaveDetail.status] || "bg-muted text-muted-foreground"}>
                      {leaveDetail.status.charAt(0).toUpperCase() + leaveDetail.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="text-xs text-muted-foreground">From</div>
                  <div className="font-medium">{formatDate(leaveDetail.fromDate)}</div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="text-xs text-muted-foreground">To</div>
                  <div className="font-medium">{formatDate(leaveDetail.toDate)}</div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5 col-span-2">
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="font-medium">
                    {daysBetween(leaveDetail.fromDate, leaveDetail.toDate)} day(s)
                  </div>
                </div>
                {leaveDetail.approvedBy && (
                  <div className="rounded-md border bg-muted/30 p-2.5 col-span-2">
                    <div className="text-xs text-muted-foreground">Approved / Rejected By</div>
                    <div className="font-medium">{leaveDetail.approvedBy}</div>
                  </div>
                )}
              </div>

              {leaveDetail.reason && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Reason</div>
                  <div className="text-sm">{leaveDetail.reason}</div>
                </div>
              )}

              {canApprove && leaveDetail.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 text-white bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      void handleApproveReject(leaveDetail, "approved");
                      setLeaveDetailOpen(false);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    className="flex-1 text-white bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      void handleApproveReject(leaveDetail, "rejected");
                      setLeaveDetailOpen(false);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payslip Dialog */}
      <Dialog open={payslipOpen} onOpenChange={setPayslipOpen}>
        <DialogContent className="max-w-lg no-print:max-h-[90vh] no-print:overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Pay Slip</DialogTitle>
            <DialogDescription>
              Review the payslip below and use Print for a hard copy.
            </DialogDescription>
          </DialogHeader>

          {payslipLoading || !payslipData ? (
            <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading payslip…
            </div>
          ) : (
            <PayslipPrintArea data={payslipData} />
          )}

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setPayslipOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handlePrintPayslip}
              disabled={payslipLoading || !payslipData}
              className="gradient-primary text-white"
            >
              <Printer className="w-4 h-4 mr-2" /> Print Payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Directory Tab ====================

function DirectoryTab({
  staffList,
  onSwitchToStaff,
}: {
  staffList: StaffOption[];
  onSwitchToStaff: () => void;
}) {
  const teaching = staffList.filter((s) => s.type === "teaching").length;
  const nonTeaching = staffList.filter((s) => s.type === "non_teaching").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatsCard title="Total Staff" value={staffList.length} icon={Users} delay={0} />
        <StatsCard title="Teaching" value={teaching} icon={GraduationCap} delay={0.05} color="text-blue-500" />
        <StatsCard title="Non-Teaching" value={nonTeaching} icon={UserCog} delay={0.1} color="text-purple-500" />
      </div>

      <Card className="glass-card p-8">
        <EmptyState
          icon={Building2}
          title="Open Staff Directory"
          description="The full staff directory — with profiles, departments, salary, leave history, and payroll records — lives in the dedicated Staff module. Click below to switch."
          actionLabel="Go to Staff Directory"
          onAction={onSwitchToStaff}
        />
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onSwitchToStaff}
            className="no-print"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Switch to Staff Module
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ==================== Payslip Print Area ====================

function PayslipPrintArea({ data }: { data: PayslipData }) {
  const { payroll, school } = data;
  const staff = payroll.staff;
  const fullName = `${staff.firstName} ${staff.lastName}`;
  const totalEarnings = payroll.basicSalary + payroll.allowances;
  const hraAmount = Math.round(payroll.allowances * 0.5 * 100) / 100;
  const daAmount = Math.round((payroll.allowances - hraAmount) * 100) / 100;
  const pfAmount = Math.round(payroll.deductions * 0.5 * 100) / 100;
  const taxAmount = Math.round((payroll.deductions - pfAmount) * 100) / 100;

  return (
    <div className="payslip-print-area">
      <div className="payslip-paper bg-white text-black rounded-lg border border-border p-6 font-sans">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold tracking-wide">
            {school?.name || "Greenwood International School"}
          </h1>
          {school?.address && (
            <p className="text-xs text-gray-700 mt-0.5">{school.address}</p>
          )}
          <p className="text-xs text-gray-700">
            {school?.phone ? `Phone: ${school.phone}` : ""}
            {school?.email ? ` · ${school.email}` : ""}
          </p>
          <h2 className="text-sm font-semibold uppercase tracking-widest mt-2">
            Pay Slip
          </h2>
          <p className="text-xs text-gray-700 mt-0.5">
            For the month of <span className="font-semibold">{monthLabel(payroll.month, payroll.year)}</span>
          </p>
        </div>

        {/* Staff details */}
        <div className="grid grid-cols-2 gap-y-1.5 text-sm mb-4 border border-gray-300 rounded p-3">
          <div>
            <span className="text-gray-600">Employee Name: </span>
            <span className="font-semibold">{fullName}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-600">Employee ID: </span>
            <span className="font-semibold font-mono">{staff.employeeId}</span>
          </div>
          <div>
            <span className="text-gray-600">Designation: </span>
            <span className="font-semibold">{staff.designation || "—"}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-600">Department: </span>
            <span className="font-semibold">{staff.department || "—"}</span>
          </div>
          {staff.joiningDate && (
            <div>
              <span className="text-gray-600">Joining Date: </span>
              <span className="font-semibold">{formatDate(staff.joiningDate)}</span>
            </div>
          )}
          <div className="text-right">
            <span className="text-gray-600">Status: </span>
            <span className="font-semibold uppercase">
              {payroll.status === "paid" ? "PAID" : "PENDING"}
            </span>
          </div>
          {payroll.paidDate && (
            <div>
              <span className="text-gray-600">Paid Date: </span>
              <span className="font-semibold">{formatDate(payroll.paidDate)}</span>
            </div>
          )}
        </div>

        {/* Earnings & Deductions side-by-side */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <table className="text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="text-left py-1.5 px-2 font-semibold">Earnings</th>
                <th className="text-right py-1.5 px-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2">Basic Salary</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(payroll.basicSalary)}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2">House Rent Allowance</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(hraAmount)}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2">Dearness Allowance</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(daAmount)}</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-1.5 px-2">Total Earnings</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(totalEarnings)}</td>
              </tr>
            </tbody>
          </table>

          <table className="text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="text-left py-1.5 px-2 font-semibold">Deductions</th>
                <th className="text-right py-1.5 px-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2">Provident Fund</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(pfAmount)}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2">Professional Tax</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(taxAmount)}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2 text-gray-400">—</td>
                <td className="py-1.5 px-2 text-right text-gray-400">—</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-1.5 px-2">Total Deductions</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(payroll.deductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net pay */}
        <div className="border-2 border-black rounded p-3 mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600 uppercase">Net Pay</div>
            <div className="text-[10px] text-gray-500">
              (Total Earnings − Total Deductions)
            </div>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(payroll.netSalary)}
          </div>
        </div>

        {/* Footer / Signatures */}
        <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-300">
          <div className="text-xs text-gray-600">
            <div>This is a computer-generated payslip.</div>
            {payroll.paidDate && (
              <div className="mt-0.5">
                Payment processed on {formatDate(payroll.paidDate)}.
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="border-t border-black w-32 mt-8 pt-1 text-xs text-gray-600">
              Authorized Signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
