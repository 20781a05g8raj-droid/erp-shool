"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Receipt as ReceiptIcon,
  TrendingUp,
  AlertTriangle,
  Printer,
  Search,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  IndianRupee,
  Users,
  FileText,
  Layers,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { apiFetch, formatDate, formatCurrency, STATUS_COLORS } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ===================== Types =====================
interface ClassOption {
  id: string;
  name: string;
  order: number;
  studentCount?: number;
  sections?: { id: string; name: string }[];
}

interface FeeItemInput {
  name: string;
  amount: number;
}

interface FeeStructureRow {
  id: string;
  name: string;
  classId: string | null;
  schoolId: string;
  term: string;
  totalAmount: number;
  dueDate: string | null;
  createdAt: string;
  class?: { id: string; name: string } | null;
  items: { id: string; name: string; amount: number }[];
  _count?: { studentFees: number };
}

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  class?: { id: string; name: string } | null;
}

interface FeeStructureLite {
  id: string;
  name: string;
  term: string;
  totalAmount: number;
  dueDate: string | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  receiptNumber: string;
  transactionId: string | null;
  collectedBy: string | null;
  remarks: string | null;
}

interface StudentFeeRow {
  id: string;
  studentId: string;
  feeStructureId: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string | null;
  status: string;
  createdAt: string;
  student: StudentRow;
  feeStructure: FeeStructureLite;
  payments: PaymentRow[];
}

interface DashboardData {
  totalCollected: number;
  totalDue: number;
  totalExpected: number;
  collectedThisMonth: number;
  collectionRate: number;
  defaulters: number;
  statusBreakdown: { paid: number; partial: number; pending: number; overdue: number };
  collectionByMonth: { month: string; amount: number }[];
  recentPayments: {
    id: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    collectedBy: string | null;
    student: { name: string; admissionNumber: string; className: string } | null;
    feeStructure: { name: string; term: string } | null;
  }[];
}

interface ReceiptPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  receiptNumber: string;
  transactionId: string | null;
  collectedBy: string | null;
  remarks: string | null;
  studentFee: {
    id: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    student: {
      firstName: string;
      lastName: string;
      admissionNumber: string;
      class: { name: string } | null;
    };
    feeStructure: {
      name: string;
      term: string;
      items: { id: string; name: string; amount: number }[];
    };
  };
}

const STATUS_PIE_COLORS: Record<string, string> = {
  paid: "oklch(0.65 0.17 150)",
  partial: "oklch(0.60 0.18 250)",
  pending: "oklch(0.75 0.15 85)",
  overdue: "oklch(0.60 0.22 25)",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  online: "Online",
  cheque: "Cheque",
};

// ===================== Main Component =====================
export function FeesModule() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("overview");

  const isStudentOrParent = user?.role === "student" || user?.role === "parent";

  // Shared data
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Per-tab data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFeeRow[]>([]);

  // Loading flags
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingStructures, setLoadingStructures] = useState(false);
  const [loadingStudentFees, setLoadingStudentFees] = useState(false);

  // Filters for student fees tab
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructureRow | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<StudentFeeRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<StudentFeeRow | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptPayment | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const data = await apiFetch<{ classes: ClassOption[] }>("/api/classes");
      setClasses(data.classes || []);
    } catch {
      toast.error("Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const data = await apiFetch<DashboardData>("/api/fees/dashboard");
      setDashboard(data);
    } catch {
      toast.error("Failed to load fee dashboard");
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const fetchStructures = useCallback(async () => {
    setLoadingStructures(true);
    try {
      const data = await apiFetch<{ structures: FeeStructureRow[] }>(
        "/api/fees/structures"
      );
      setStructures(data.structures || []);
    } catch {
      toast.error("Failed to load fee structures");
    } finally {
      setLoadingStructures(false);
    }
  }, []);

  const fetchStudentFees = useCallback(async () => {
    setLoadingStudentFees(true);
    try {
      const params = new URLSearchParams();
      if (!isStudentOrParent && filterClassId !== "all")
        params.set("classId", filterClassId);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const qs = params.toString();
      const data = await apiFetch<{ studentFees: StudentFeeRow[] }>(
        `/api/fees${qs ? `?${qs}` : ""}`
      );
      setStudentFees(data.studentFees || []);
    } catch {
      toast.error("Failed to load student fees");
    } finally {
      setLoadingStudentFees(false);
    }
  }, [filterClassId, filterStatus, searchTerm, isStudentOrParent]);

  // Initial classes fetch (needed by structures + filters)
  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Tab-driven data fetching
  useEffect(() => {
    if (activeTab === "overview") fetchDashboard();
    else if (activeTab === "structures") fetchStructures();
    else if (activeTab === "studentFees") fetchStudentFees();
    // Receipts tab data is sourced from studentFees payments; ensure loaded
    if (activeTab === "receipts" && studentFees.length === 0) fetchStudentFees();
  }, [activeTab, fetchDashboard, fetchStructures, fetchStudentFees, studentFees.length]);

  // Refresh handler
  const refreshCurrent = useCallback(() => {
    if (activeTab === "overview") fetchDashboard();
    else if (activeTab === "structures") fetchStructures();
    else if (activeTab === "studentFees" || activeTab === "receipts")
      fetchStudentFees();
  }, [activeTab, fetchDashboard, fetchStructures, fetchStudentFees]);

  // Handlers
  const handleOpenAddStructure = () => {
    setEditingStructure(null);
    setStructureDialogOpen(true);
  };

  const handleOpenEditStructure = (s: FeeStructureRow) => {
    setEditingStructure(s);
    setStructureDialogOpen(true);
  };

  const handleDeleteStructure = async (s: FeeStructureRow) => {
    if (
      !confirm(
        `Delete fee structure "${s.name}"? This cannot be undone if no students are assigned.`
      )
    )
      return;
    try {
      await apiFetch(`/api/fees/structures/${s.id}`, { method: "DELETE" });
      toast.success("Fee structure deleted");
      fetchStructures();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleAssignToClass = async (s: FeeStructureRow) => {
    if (!s.classId) {
      toast.error(
        "This fee structure is not linked to a class. Edit it to set a class first."
      );
      return;
    }
    const cls = classes.find((c) => c.id === s.classId);
    if (
      !confirm(
        `Assign "${s.name}" to all active students in ${cls?.name || "this class"}? Students already assigned will be skipped.`
      )
    )
      return;
    try {
      const res = await apiFetch<{ assigned: number; skipped: number }>(
        "/api/fees",
        {
          method: "POST",
          body: JSON.stringify({
            feeStructureId: s.id,
            classId: s.classId,
            scope: "class",
          }),
        }
      );
      toast.success(
        `Assigned to ${res.assigned} student(s)${
          res.skipped ? `, ${res.skipped} already assigned` : ""
        }.`
      );
      fetchStructures();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    }
  };

  const handleOpenPayment = (sf: StudentFeeRow) => {
    setPaymentTarget(sf);
    setPaymentDialogOpen(true);
  };

  const handleOpenDetails = (sf: StudentFeeRow) => {
    setDetailsTarget(sf);
    setDetailsDialogOpen(true);
  };

  const handleOpenReceipt = async (paymentId: string) => {
    setReceiptLoading(true);
    setReceiptDialogOpen(true);
    try {
      const data = await apiFetch<{ payment: ReceiptPayment }>(
        `/api/fees/payments/${paymentId}`
      );
      setReceiptData(data.payment);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load receipt");
      setReceiptDialogOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Collect all payments across student fees for receipts tab
  const allPayments = useMemo(() => {
    const rows: {
      payment: PaymentRow;
      studentFee: StudentFeeRow;
    }[] = [];
    for (const sf of studentFees) {
      for (const p of sf.payments) {
        rows.push({ payment: p, studentFee: sf });
      }
    }
    rows.sort(
      (a, b) =>
        new Date(b.payment.paymentDate).getTime() -
        new Date(a.payment.paymentDate).getTime()
    );
    return rows;
  }, [studentFees]);

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border: none !important;
            transform: none !important;
            max-height: none !important; overflow: visible !important;
          }
          .receipt-print-area .receipt-paper {
            box-shadow: none !important; border: none !important;
            margin: 0 !important; padding: 16px !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
        }
        `,
        }}
      />

      <PageHeader
        title="Fee Management"
        description="Structures, payments, dues tracking, receipts & analytics."
        icon={Wallet}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="studentFees">Student Fees</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        {/* ===================== OVERVIEW ===================== */}
        <TabsContent value="overview">
          {loadingDashboard || !dashboard ? (
            <OverviewSkeleton />
          ) : (
            <OverviewTab dashboard={dashboard} />
          )}
        </TabsContent>

        {/* ===================== STRUCTURES ===================== */}
        <TabsContent value="structures">
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleOpenAddStructure}
              className="gradient-primary text-white"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Structure
            </Button>
          </div>
          {loadingStructures ? (
            <StructuresSkeleton />
          ) : structures.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No fee structures yet"
              description="Create fee structures per class with itemized amounts (tuition, lab, exam, etc.). Then assign to students."
              actionLabel="Add Structure"
              onAction={handleOpenAddStructure}
            />
          ) : (
            <StructuresGrid
              structures={structures}
              onEdit={handleOpenEditStructure}
              onDelete={handleDeleteStructure}
              onAssign={handleAssignToClass}
            />
          )}
        </TabsContent>

        {/* ===================== STUDENT FEES ===================== */}
        <TabsContent value="studentFees">
          {!isStudentOrParent && (
            <Card className="glass-card p-4 mb-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-end">
                <div className="flex-1">
                  <Label className="mb-1.5">Search Student</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Name or admission no…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchStudentFees()}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Label className="mb-1.5">Class</Label>
                  <Select
                    value={filterClassId}
                    onValueChange={setFilterClassId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-44">
                  <Label className="mb-1.5">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchStudentFees} variant="outline">
                  <Search className="w-4 h-4 mr-2" /> Apply
                </Button>
              </div>
            </Card>
          )}

          {loadingStudentFees ? (
            <StudentFeesSkeleton />
          ) : studentFees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No student fee records"
              description={
                isStudentOrParent
                  ? "You don't have any fee records yet."
                  : "Assign fee structures to students from the Fee Structures tab to see them here."
              }
            />
          ) : (
            <StudentFeesTable
              rows={studentFees}
              isStudentOrParent={isStudentOrParent}
              onRecordPayment={handleOpenPayment}
              onViewDetails={handleOpenDetails}
              onOpenReceipt={handleOpenReceipt}
            />
          )}
        </TabsContent>

        {/* ===================== RECEIPTS ===================== */}
        <TabsContent value="receipts">
          {loadingStudentFees ? (
            <StudentFeesSkeleton />
          ) : allPayments.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="No receipts yet"
              description="Once payments are recorded, receipts will appear here for printing."
            />
          ) : (
            <ReceiptsTable
              rows={allPayments}
              onOpenReceipt={handleOpenReceipt}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ===================== Dialogs ===================== */}
      <StructureDialog
        open={structureDialogOpen}
        onOpenChange={setStructureDialogOpen}
        classes={classes}
        editing={editingStructure}
        loadingClasses={loadingClasses}
        onSaved={() => {
          setStructureDialogOpen(false);
          fetchStructures();
          refreshCurrent();
        }}
      />

      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        target={paymentTarget}
        onSaved={() => {
          setPaymentDialogOpen(false);
          fetchStudentFees();
          refreshCurrent();
        }}
      />

      <StudentFeeDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        target={detailsTarget}
        onOpenReceipt={handleOpenReceipt}
      />

      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        data={receiptData}
        loading={receiptLoading}
        onPrint={handlePrintReceipt}
      />
    </div>
  );
}

// ===================== Overview Tab =====================
function OverviewTab({ dashboard }: { dashboard: DashboardData }) {
  const pieData = [
    { name: "Paid", value: dashboard.statusBreakdown.paid, key: "paid" },
    { name: "Partial", value: dashboard.statusBreakdown.partial, key: "partial" },
    { name: "Pending", value: dashboard.statusBreakdown.pending, key: "pending" },
    { name: "Overdue", value: dashboard.statusBreakdown.overdue, key: "overdue" },
  ].filter((d) => d.value > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Collected This Month"
          value={formatCurrency(dashboard.collectedThisMonth)}
          icon={IndianRupee}
          color="text-emerald-600"
          delay={0}
        />
        <StatsCard
          title="Total Dues"
          value={formatCurrency(dashboard.totalDue)}
          icon={AlertTriangle}
          color="text-red-500"
          delay={0.1}
        />
        <StatsCard
          title="Defaulters"
          value={dashboard.defaulters}
          icon={Users}
          color="text-amber-500"
          delay={0.2}
        />
        <StatsCard
          title="Collection Rate"
          value={`${dashboard.collectionRate}%`}
          icon={TrendingUp}
          color="text-primary"
          delay={0.3}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Fee Collection</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
              {formatCurrency(dashboard.totalCollected)} total
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dashboard.collectionByMonth}>
              <defs>
                <linearGradient id="feeBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.20 265)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="oklch(0.55 0.20 265)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="oklch(0.52 0.02 260)"
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid oklch(0.91 0.008 255)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatCurrency(v), "Collected"]}
              />
              <Bar dataKey="amount" fill="url(#feeBar)" radius={[6, 6, 0, 0]} name="Collected" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-1">Status Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">Fee records by status</p>
          {pieData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              No data
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={STATUS_PIE_COLORS[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid oklch(0.91 0.008 255)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d) => (
                  <div key={d.key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: STATUS_PIE_COLORS[d.key] }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Recent Payments</h3>
            <p className="text-xs text-muted-foreground">Last 10 transactions</p>
          </div>
          <Badge variant="outline">
            <ReceiptIcon className="w-3 h-3 mr-1" /> {dashboard.recentPayments.length}
          </Badge>
        </div>
        {dashboard.recentPayments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.recentPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.student?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.student?.admissionNumber}
                    </div>
                  </TableCell>
                  <TableCell>{p.student?.className || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">
                    {formatCurrency(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </motion.div>
  );
}

// ===================== Structures Grid =====================
function StructuresGrid({
  structures,
  onEdit,
  onDelete,
  onAssign,
}: {
  structures: FeeStructureRow[];
  onEdit: (s: FeeStructureRow) => void;
  onDelete: (s: FeeStructureRow) => void;
  onAssign: (s: FeeStructureRow) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {structures.map((s, i) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
        >
          <Card className="glass-card p-5 h-full flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold leading-tight">{s.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline">{s.class?.name || "No class"}</Badge>
                  <span>·</span>
                  <span>{s.term}</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(s)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAssign(s)}>
                    <Users className="w-3.5 h-3.5 mr-2" /> Assign to Class
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(s)}
                    className="text-red-600 focus:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="text-2xl font-bold text-primary mb-1">
              {formatCurrency(s.totalAmount)}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Due: {formatDate(s.dueDate)} ·{" "}
              {s._count?.studentFees ?? 0} student(s) assigned
            </div>

            <div className="space-y-1.5 mb-4 flex-1">
              {s.items.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No itemized components
                </div>
              ) : (
                s.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0"
                  >
                    <span className="text-muted-foreground">{it.name}</span>
                    <span className="font-medium">{formatCurrency(it.amount)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(s)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              <Button
                size="sm"
                className="flex-1 gradient-primary text-white"
                onClick={() => onAssign(s)}
                disabled={!s.classId}
              >
                <Users className="w-3.5 h-3.5 mr-1.5" /> Assign
              </Button>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ===================== Structure Dialog (Add / Edit) =====================
function StructureDialog({
  open,
  onOpenChange,
  classes,
  editing,
  loadingClasses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: ClassOption[];
  editing: FeeStructureRow | null;
  loadingClasses: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [term, setTerm] = useState("Annual");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<FeeItemInput[]>([
    { name: "Tuition Fee", amount: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setClassId(editing.classId || "");
        setTerm(editing.term);
        setDueDate(editing.dueDate || "");
        setItems(
          editing.items.length > 0
            ? editing.items.map((it) => ({ name: it.name, amount: it.amount }))
            : [{ name: "Tuition Fee", amount: 0 }]
        );
      } else {
        setName("");
        setClassId("");
        setTerm("Annual");
        setDueDate("");
        setItems([{ name: "Tuition Fee", amount: 0 }]);
      }
    }
  }, [open, editing]);

  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [items]
  );

  const handleAddItem = () =>
    setItems((prev) => [...prev, { name: "", amount: 0 }]);

  const handleRemoveItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleItemChange = (idx: number, field: keyof FeeItemInput, value: string) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? field === "amount"
            ? { ...it, amount: Number(value) || 0 }
            : { ...it, name: value }
          : it
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !term.trim()) {
      toast.error("Name and term are required");
      return;
    }
    const cleanItems = items
      .filter((it) => it.name.trim() && Number(it.amount) > 0)
      .map((it) => ({ name: it.name.trim(), amount: Number(it.amount) }));

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        classId: classId || null,
        term: term.trim(),
        dueDate: dueDate || null,
        items: cleanItems,
      };
      if (editing) {
        await apiFetch(`/api/fees/structures/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Fee structure updated");
      } else {
        await apiFetch("/api/fees/structures", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Fee structure created");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Fee Structure" : "Add Fee Structure"}
          </DialogTitle>
          <DialogDescription>
            Define fee components (tuition, lab, exam, etc.). The total is auto-calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Structure Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Class 10 - Annual Fee 2024-25"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingClasses ? "Loading…" : "Select class"} />
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
              <Label>Term *</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Annual">Annual</SelectItem>
                  <SelectItem value="Term 1">Term 1</SelectItem>
                  <SelectItem value="Term 2">Term 2</SelectItem>
                  <SelectItem value="Term 3">Term 3</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="One-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fee Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={it.name}
                    onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                    placeholder="Item name (e.g. Tuition Fee)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={it.amount || ""}
                    onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                    placeholder="Amount"
                    className="w-32"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length === 1}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total Amount</div>
                <div className="text-xl font-bold text-primary">
                  {formatCurrency(totalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-primary text-white"
          >
            {saving ? "Saving…" : editing ? "Update Structure" : "Create Structure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Student Fees Table =====================
function StudentFeesTable({
  rows,
  isStudentOrParent,
  onRecordPayment,
  onViewDetails,
  onOpenReceipt,
}: {
  rows: StudentFeeRow[];
  isStudentOrParent: boolean;
  onRecordPayment: (sf: StudentFeeRow) => void;
  onViewDetails: (sf: StudentFeeRow) => void;
  onOpenReceipt: (paymentId: string) => void;
}) {
  return (
    <Card className="glass-card p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Fee Structure</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((sf) => {
            const fullName = `${sf.student.firstName} ${sf.student.lastName}`;
            const isPaid = sf.status === "paid";
            const canPay = !isPaid && sf.dueAmount > 0;
            return (
              <TableRow key={sf.id}>
                <TableCell>
                  <div className="font-medium">{fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {sf.student.admissionNumber}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{sf.student.class?.name || "—"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{sf.feeStructure.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {sf.feeStructure.term} · Due {formatDate(sf.dueDate)}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(sf.totalAmount)}
                </TableCell>
                <TableCell className="text-right text-emerald-600">
                  {formatCurrency(sf.paidAmount)}
                </TableCell>
                <TableCell className="text-right text-red-500">
                  {formatCurrency(sf.dueAmount)}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[sf.status] || ""} variant="outline">
                    {sf.status.charAt(0).toUpperCase() + sf.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {isStudentOrParent ? (
                      canPay ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRecordPayment(sf)}
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay Now
                        </Button>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
                        </Badge>
                      )
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onRecordPayment(sf)}
                        disabled={!canPay}
                        className="gradient-primary text-white"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(sf)}>
                          <FileText className="w-3.5 h-3.5 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {sf.payments.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No receipts
                          </div>
                        ) : (
                          sf.payments.slice(0, 5).map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onClick={() => onOpenReceipt(p.id)}
                            >
                              <ReceiptIcon className="w-3.5 h-3.5 mr-2" /> {p.receiptNumber}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

// ===================== Record Payment Dialog =====================
function RecordPaymentDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: StudentFeeRow | null;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && target) {
      setAmount(String(target.dueAmount));
      setPaymentMethod("cash");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setRemarks("");
    }
  }, [open, target]);

  if (!target) return null;

  const fullName = `${target.student.firstName} ${target.student.lastName}`;
  const payAmount = Number(amount) || 0;
  const exceeds = payAmount > target.dueAmount;

  const handleSave = async () => {
    if (!target) return;
    if (payAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (exceeds) {
      toast.error(`Amount cannot exceed outstanding due of ${formatCurrency(target.dueAmount)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ payment: PaymentRow }>("/api/fees/payments", {
        method: "POST",
        body: JSON.stringify({
          studentFeeId: target.id,
          amount: payAmount,
          paymentMethod,
          paymentDate,
          remarks: remarks.trim() || undefined,
        }),
      });
      toast.success(
        `Payment of ${formatCurrency(payAmount)} recorded. Receipt ${res.payment.receiptNumber}`
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Recording payment for {fullName} · {target.feeStructure.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-muted/50 p-2.5">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold">{formatCurrency(target.totalAmount)}</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="font-semibold text-emerald-600">
                {formatCurrency(target.paidAmount)}
              </div>
            </div>
            <div className="rounded-lg bg-red-500/10 p-2.5">
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className="font-semibold text-red-500">
                {formatCurrency(target.dueAmount)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input
              type="number"
              min={1}
              max={target.dueAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={exceeds ? "border-red-500" : ""}
            />
            {exceeds && (
              <div className="text-xs text-red-500">
                Exceeds outstanding due
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remarks (optional)</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Partial payment, cheque no. 123456"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || exceeds || payAmount <= 0}
            className="gradient-primary text-white"
          >
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Student Fee Details Dialog =====================
function StudentFeeDetailsDialog({
  open,
  onOpenChange,
  target,
  onOpenReceipt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: StudentFeeRow | null;
  onOpenReceipt: (paymentId: string) => void;
}) {
  if (!target) return null;
  const fullName = `${target.student.firstName} ${target.student.lastName}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fee Details</DialogTitle>
          <DialogDescription>
            {fullName} · {target.student.class?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Admission No</div>
              <div className="font-medium">{target.student.admissionNumber}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Fee Structure</div>
              <div className="font-medium">{target.feeStructure.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Term</div>
              <div className="font-medium">{target.feeStructure.term}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Due Date</div>
              <div className="font-medium">{formatDate(target.dueDate)}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 p-2.5">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold text-sm">{formatCurrency(target.totalAmount)}</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="font-semibold text-sm text-emerald-600">
                {formatCurrency(target.paidAmount)}
              </div>
            </div>
            <div className="rounded-lg bg-red-500/10 p-2.5">
              <div className="text-xs text-muted-foreground">Due</div>
              <div className="font-semibold text-sm text-red-500">
                {formatCurrency(target.dueAmount)}
              </div>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-semibold text-sm capitalize">{target.status}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Payment History</div>
            {target.payments.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border rounded-lg">
                No payments recorded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {target.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                  >
                    <div>
                      <div className="font-mono text-xs">{p.receiptNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.paymentDate)} ·{" "}
                        {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                        {p.collectedBy ? ` · by ${p.collectedBy}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onOpenReceipt(p.id)}
                      >
                        <ReceiptIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Receipts Table =====================
function ReceiptsTable({
  rows,
  onOpenReceipt,
}: {
  rows: { payment: PaymentRow; studentFee: StudentFeeRow }[];
  onOpenReceipt: (paymentId: string) => void;
}) {
  return (
    <Card className="glass-card p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Receipt #</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ payment, studentFee }) => (
            <TableRow key={payment.id}>
              <TableCell className="font-mono text-xs">
                {payment.receiptNumber}
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {studentFee.student.firstName} {studentFee.student.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {studentFee.student.admissionNumber}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {studentFee.student.class?.name || "—"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{formatDate(payment.paymentDate)}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-600">
                {formatCurrency(payment.amount)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenReceipt(payment.id)}
                >
                  <ReceiptIcon className="w-3.5 h-3.5 mr-1.5" /> View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ===================== Receipt Dialog (Printable) =====================
function ReceiptDialog({
  open,
  onOpenChange,
  data,
  loading,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReceiptPayment | null;
  loading: boolean;
  onPrint: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg no-print:max-h-[90vh] no-print:overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle>Payment Receipt</DialogTitle>
          <DialogDescription>
            Review the receipt below and use Print for a hard copy.
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
            Loading receipt…
          </div>
        ) : (
          <ReceiptPrintArea data={data} />
        )}

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onPrint} disabled={loading} className="gradient-primary text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptPrintArea({ data }: { data: ReceiptPayment }) {
  const sf = data.studentFee;
  const student = sf.student;
  const fs = sf.feeStructure;
  const fullName = `${student.firstName} ${student.lastName}`;
  const balanceAfter = Math.max(0, sf.totalAmount - sf.paidAmount);

  return (
    <div className="receipt-print-area">
      <div className="receipt-paper bg-white text-black rounded-lg border border-border p-6 font-sans">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold tracking-wide">
            Greenwood International School
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            123 Education Lane, Knowledge Park, New Delhi - 110001
          </p>
          <p className="text-xs text-gray-700">Phone: +91 98765 43210 · info@greenwood.edu</p>
          <h2 className="text-sm font-semibold uppercase tracking-widest mt-2">
            Fee Payment Receipt
          </h2>
        </div>

        {/* Receipt meta */}
        <div className="grid grid-cols-2 gap-y-1.5 text-sm mb-4">
          <div>
            <span className="text-gray-600">Receipt No: </span>
            <span className="font-semibold font-mono">{data.receiptNumber}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-600">Date: </span>
            <span className="font-semibold">{formatDate(data.paymentDate)}</span>
          </div>
          <div>
            <span className="text-gray-600">Payment Method: </span>
            <span className="font-semibold">
              {PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod}
            </span>
          </div>
          {data.transactionId && (
            <div className="text-right">
              <span className="text-gray-600">Transaction ID: </span>
              <span className="font-mono text-xs">{data.transactionId}</span>
            </div>
          )}
        </div>

        {/* Student details */}
        <div className="border border-gray-300 rounded p-3 mb-4 text-sm">
          <div className="grid grid-cols-2 gap-y-1.5">
            <div>
              <span className="text-gray-600">Student Name: </span>
              <span className="font-semibold">{fullName}</span>
            </div>
            <div>
              <span className="text-gray-600">Admission No: </span>
              <span className="font-semibold">{student.admissionNumber}</span>
            </div>
            <div>
              <span className="text-gray-600">Class: </span>
              <span className="font-semibold">{student.class?.name || "—"}</span>
            </div>
            <div>
              <span className="text-gray-600">Fee Term: </span>
              <span className="font-semibold">{fs.term}</span>
            </div>
          </div>
        </div>

        {/* Fee breakdown */}
        <table className="w-full text-sm mb-4 border border-gray-300">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="text-left py-1.5 px-2 font-semibold">Fee Component</th>
              <th className="text-right py-1.5 px-2 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {fs.items.length > 0 ? (
              fs.items.map((it) => (
                <tr key={it.id} className="border-b border-gray-200">
                  <td className="py-1.5 px-2">{it.name}</td>
                  <td className="py-1.5 px-2 text-right">{formatCurrency(it.amount)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-200">
                <td className="py-1.5 px-2">{fs.name}</td>
                <td className="py-1.5 px-2 text-right">{formatCurrency(sf.totalAmount)}</td>
              </tr>
            )}
            <tr className="bg-gray-50 font-semibold">
              <td className="py-1.5 px-2">Total Fee</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(sf.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Payment summary */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
          <div className="border border-gray-300 rounded p-2 text-center">
            <div className="text-xs text-gray-600">Amount Paid</div>
            <div className="font-bold text-emerald-700">{formatCurrency(data.amount)}</div>
          </div>
          <div className="border border-gray-300 rounded p-2 text-center">
            <div className="text-xs text-gray-600">Total Paid</div>
            <div className="font-bold">{formatCurrency(sf.paidAmount)}</div>
          </div>
          <div className="border border-gray-300 rounded p-2 text-center">
            <div className="text-xs text-gray-600">Balance Due</div>
            <div className="font-bold text-red-700">{formatCurrency(balanceAfter)}</div>
          </div>
        </div>

        {data.remarks && (
          <div className="text-sm mb-4">
            <span className="text-gray-600">Remarks: </span>
            <span>{data.remarks}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-300">
          <div className="text-xs text-gray-600">
            <div>Collected By: <span className="font-semibold">{data.collectedBy || "—"}</span></div>
            <div className="mt-0.5">This is a computer-generated receipt.</div>
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

// ===================== Skeletons =====================
function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-muted/40" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 h-80 animate-pulse bg-muted/40" />
        <Card className="h-80 animate-pulse bg-muted/40" />
      </div>
      <Card className="h-64 animate-pulse bg-muted/40" />
    </div>
  );
}

function StructuresSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="h-56 animate-pulse bg-muted/40" />
      ))}
    </div>
  );
}

function StudentFeesSkeleton() {
  return (
    <Card className="glass-card p-0">
      <div className="space-y-2 p-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
        ))}
      </div>
    </Card>
  );
}
