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
  LineChart,
  Line,
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
  IndianRupee,
  Users,
  FileText,
  Layers,
  CreditCard,
  Download,
  Calendar,
  Mail,
  Phone,
  Bell,
  BookOpen,
  Banknote,
  Clock4,
  Stamp,
  History,
  CheckCircle,
  X,
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

interface SchoolInfo {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
}

interface ReceiptPaymentItem {
  id: string;
  name: string;
  amount: number;
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
    dueDate: string | null;
    studentId: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      admissionNumber: string;
      fatherName: string | null;
      class: { id: string; name: string } | null;
      section: { id: string; name: string } | null;
    };
    feeStructure: {
      id: string;
      name: string;
      term: string;
      totalAmount: number;
      items: ReceiptPaymentItem[];
    };
    payments: PaymentRow[];
  };
}

interface LedgerEntry {
  id: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    fatherName: string | null;
    parentPhone: string | null;
    parentEmail: string | null;
    class: { id: string; name: string } | null;
    section: { id: string; name: string } | null;
  };
  feeStructure: FeeStructureLite;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string | null;
  status: string;
  daysOverdue: number;
  lastPayment: {
    id: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    collectedBy: string | null;
  } | null;
  payments: PaymentRow[];
}

interface DefaulterEntry {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    fatherName: string | null;
    parentPhone: string | null;
    parentEmail: string | null;
    class: { id: string; name: string } | null;
    section: { id: string; name: string } | null;
  };
  feeStructure: FeeStructureLite;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string | null;
  status: string;
  daysOverdue: number;
  severityBucket: "critical" | "overdue" | "pending";
  lastPayment: {
    id: string;
    receiptNumber: string;
    amount: number;
    paymentDate: string;
  } | null;
  remindedAt: string | null;
}

interface CollectionReport {
  period: { from: string; to: string; preset: string };
  totalCollected: number;
  transactions: number;
  breakdown: {
    cash: { amount: number; count: number };
    online: { amount: number; count: number };
    cheque: { amount: number; count: number };
  };
  dailyChart: { date: string; label: string; amount: number; count: number }[];
  payments: {
    id: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    collectedBy: string | null;
    transactionId: string | null;
    remarks: string | null;
    student: { id: string; name: string; admissionNumber: string; className: string } | null;
    feeStructure: { name: string; term: string } | null;
  }[];
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

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: "oklch(0.65 0.17 150)",
  online: "oklch(0.60 0.18 250)",
  cheque: "oklch(0.70 0.15 85)",
};

// ===================== Number to Words (Indian format) =====================
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let parts: string[] = [];
  if (hundred) parts.push(ONES[hundred] + " Hundred");
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

export function numberToWords(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";
  const isNegative = amount < 0;
  let n = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - n) * 100);

  let crores = 0, lakhs = 0, thousands = 0, hundreds = 0;
  crores = Math.floor(n / 10000000);
  n %= 10000000;
  lakhs = Math.floor(n / 100000);
  n %= 100000;
  thousands = Math.floor(n / 1000);
  n %= 1000;
  hundreds = n;

  const parts: string[] = [];
  if (crores) parts.push(threeDigitsToWords(crores) + " Crore");
  if (lakhs) parts.push(twoDigitsToWords(lakhs) + " Lakh");
  if (thousands) parts.push(twoDigitsToWords(thousands) + " Thousand");
  if (hundreds) parts.push(threeDigitsToWords(hundreds));

  let words = parts.filter(Boolean).join(" ").trim();
  if (!words) words = "Zero";
  words += " Rupees";
  if (paise > 0) {
    words += " and " + twoDigitsToWords(paise) + " Paise";
  }
  words += " Only";
  return (isNegative ? "Minus " : "") + words;
}

// ===================== Main Component =====================
export function FeesModule() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("overview");

  const isStudentOrParent = user?.role === "student" || user?.role === "parent";
  // Accountant-style roles get the full 6-tab view
  const isAccountantView =
    user?.role === "accountant" ||
    user?.role === "school_admin" ||
    user?.role === "super_admin";

  // Shared data
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Per-tab data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFeeRow[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [defaulters, setDefaulters] = useState<DefaulterEntry[]>([]);
  const [defaultersSummary, setDefaultersSummary] = useState<{
    totalDue: number;
    avgDaysOverdue: number;
    critical: number;
    overdue: number;
    pending: number;
  } | null>(null);
  const [report, setReport] = useState<CollectionReport | null>(null);

  // Loading flags
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingStructures, setLoadingStructures] = useState(false);
  const [loadingStudentFees, setLoadingStudentFees] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [loadingDefaulters, setLoadingDefaulters] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Filters for student fees tab
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters for ledger tab
  const [ledgerClassId, setLedgerClassId] = useState<string>("all");
  const [ledgerStatus, setLedgerStatus] = useState<string>("all");
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Filters for defaulters tab
  const [defaultersClassId, setDefaultersClassId] = useState<string>("all");
  const [defaultersSeverity, setDefaultersSeverity] = useState<string>("all");

  // Filters for report tab
  const [reportPreset, setReportPreset] = useState<string>("today");
  const [reportFrom, setReportFrom] = useState<string>("");
  const [reportTo, setReportTo] = useState<string>("");

  // Dialogs
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructureRow | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<StudentFeeRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<StudentFeeRow | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptPayment | null>(null);
  const [receiptSchool, setReceiptSchool] = useState<SchoolInfo | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Ledger history dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<LedgerEntry | null>(null);

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

  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (ledgerClassId !== "all") params.set("classId", ledgerClassId);
      if (ledgerStatus !== "all") params.set("status", ledgerStatus);
      if (ledgerSearch.trim()) params.set("search", ledgerSearch.trim());
      const qs = params.toString();
      const data = await apiFetch<{ ledger: LedgerEntry[]; count: number }>(
        `/api/fees/ledger${qs ? `?${qs}` : ""}`
      );
      setLedger(data.ledger || []);
    } catch {
      toast.error("Failed to load ledger");
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerClassId, ledgerStatus, ledgerSearch]);

  const fetchDefaulters = useCallback(async () => {
    setLoadingDefaulters(true);
    try {
      const params = new URLSearchParams();
      if (defaultersClassId !== "all") params.set("classId", defaultersClassId);
      if (defaultersSeverity !== "all") params.set("severity", defaultersSeverity);
      const qs = params.toString();
      const data = await apiFetch<{
        defaulters: DefaulterEntry[];
        count: number;
        summary: {
          totalDue: number;
          avgDaysOverdue: number;
          critical: number;
          overdue: number;
          pending: number;
        };
      }>(`/api/fees/defaulters${qs ? `?${qs}` : ""}`);
      setDefaulters(data.defaulters || []);
      setDefaultersSummary(data.summary);
    } catch {
      toast.error("Failed to load defaulters");
    } finally {
      setLoadingDefaulters(false);
    }
  }, [defaultersClassId, defaultersSeverity]);

  const fetchReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const params = new URLSearchParams();
      params.set("preset", reportPreset);
      if (reportPreset === "custom" && reportFrom && reportTo) {
        params.set("from", reportFrom);
        params.set("to", reportTo);
      }
      const data = await apiFetch<CollectionReport>(
        `/api/fees/collection-report?${params.toString()}`
      );
      setReport(data);
    } catch {
      toast.error("Failed to load collection report");
    } finally {
      setLoadingReport(false);
    }
  }, [reportPreset, reportFrom, reportTo]);

  // Initial classes fetch (needed by structures + filters)
  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Tab-driven data fetching
  useEffect(() => {
    if (activeTab === "overview") fetchDashboard();
    else if (activeTab === "structures") fetchStructures();
    else if (activeTab === "studentFees") fetchStudentFees();
    else if (activeTab === "ledger") fetchLedger();
    else if (activeTab === "defaulters") fetchDefaulters();
    else if (activeTab === "reports") fetchReport();
    // Receipts tab data is sourced from studentFees payments; ensure loaded
    if (activeTab === "receipts" && studentFees.length === 0) fetchStudentFees();
  }, [
    activeTab,
    fetchDashboard,
    fetchStructures,
    fetchStudentFees,
    fetchLedger,
    fetchDefaulters,
    fetchReport,
    studentFees.length,
  ]);

  // Refresh handler
  const refreshCurrent = useCallback(() => {
    if (activeTab === "overview") fetchDashboard();
    else if (activeTab === "structures") fetchStructures();
    else if (activeTab === "studentFees" || activeTab === "receipts")
      fetchStudentFees();
    else if (activeTab === "ledger") fetchLedger();
    else if (activeTab === "defaulters") fetchDefaulters();
    else if (activeTab === "reports") fetchReport();
  }, [
    activeTab,
    fetchDashboard,
    fetchStructures,
    fetchStudentFees,
    fetchLedger,
    fetchDefaulters,
    fetchReport,
  ]);

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
    setReceiptData(null);
    setReceiptSchool(null);
    try {
      const data = await apiFetch<{ payment: ReceiptPayment; school: SchoolInfo }>(
        `/api/fees/payments/${paymentId}`
      );
      setReceiptData(data.payment);
      setReceiptSchool(data.school);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load receipt");
      setReceiptDialogOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleOpenLedgerHistory = (entry: LedgerEntry) => {
    setHistoryTarget(entry);
    setHistoryDialogOpen(true);
  };

  const handlePrintReceipt = () => {
    if (!receiptData) return;
    printReceiptInIframe(receiptData, receiptSchool);
  };

  const handleDownloadReceipt = () => {
    if (!receiptData) return;
    // Use the iframe-based print which lets user "Save as PDF"
    printReceiptInIframe(receiptData, receiptSchool);
  };

  const handleRemindDefaulter = async (d: DefaulterEntry) => {
    const studentName = `${d.student.firstName} ${d.student.lastName}`;
    try {
      await apiFetch("/api/fees/defaulters", {
        method: "POST",
        body: JSON.stringify({
          studentFeeId: d.id,
          method: "sms",
        }),
      });
      toast.success(`Reminder logged for ${studentName}`);
      fetchDefaulters();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log reminder");
    }
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
        @media screen {
          .receipt-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 6rem;
            font-weight: 800;
            color: #000;
            opacity: 0.05;
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
          }
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
          {isAccountantView && (
            <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          )}
          <TabsTrigger value="studentFees">
            {isStudentOrParent ? "My Fees" : "Student Fees"}
          </TabsTrigger>
          {isAccountantView && (
            <>
              <TabsTrigger value="ledger">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Ledger
              </TabsTrigger>
              <TabsTrigger value="defaulters">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Defaulters
              </TabsTrigger>
              <TabsTrigger value="reports">
                <BarChart className="w-3.5 h-3.5 mr-1.5" /> Reports
              </TabsTrigger>
            </>
          )}
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
        {isAccountantView && (
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
        )}

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

        {/* ===================== LEDGER (NEW) ===================== */}
        {isAccountantView && (
          <TabsContent value="ledger">
            <LedgerTab
              ledger={ledger}
              loading={loadingLedger}
              classes={classes}
              filters={{
                classId: ledgerClassId,
                setClassId: setLedgerClassId,
                status: ledgerStatus,
                setStatus: setLedgerStatus,
                search: ledgerSearch,
                setSearch: setLedgerSearch,
                onApply: fetchLedger,
              }}
              onViewHistory={handleOpenLedgerHistory}
              onRecordPayment={handleOpenPayment}
              onOpenReceipt={handleOpenReceipt}
            />
          </TabsContent>
        )}

        {/* ===================== DEFAULTERS (NEW) ===================== */}
        {isAccountantView && (
          <TabsContent value="defaulters">
            <DefaultersTab
              defaulters={defaulters}
              summary={defaultersSummary}
              loading={loadingDefaulters}
              classes={classes}
              filters={{
                classId: defaultersClassId,
                setClassId: setDefaultersClassId,
                severity: defaultersSeverity,
                setSeverity: setDefaultersSeverity,
                onApply: fetchDefaulters,
              }}
              onRemind={handleRemindDefaulter}
              onRecordPayment={(d) => {
                const sf: StudentFeeRow = {
                  id: d.id,
                  studentId: d.student.id,
                  feeStructureId: d.feeStructure.id,
                  totalAmount: d.totalAmount,
                  paidAmount: d.paidAmount,
                  dueAmount: d.dueAmount,
                  dueDate: d.dueDate,
                  status: d.status,
                  createdAt: "",
                  student: {
                    id: d.student.id,
                    firstName: d.student.firstName,
                    lastName: d.student.lastName,
                    admissionNumber: d.student.admissionNumber,
                    class: d.student.class,
                  },
                  feeStructure: d.feeStructure,
                  payments: [],
                };
                handleOpenPayment(sf);
              }}
            />
          </TabsContent>
        )}

        {/* ===================== REPORTS (NEW) ===================== */}
        {isAccountantView && (
          <TabsContent value="reports">
            <CollectionReportTab
              report={report}
              loading={loadingReport}
              filters={{
                preset: reportPreset,
                setPreset: setReportPreset,
                from: reportFrom,
                setFrom: setReportFrom,
                to: reportTo,
                setTo: setReportTo,
                onApply: fetchReport,
              }}
              onOpenReceipt={handleOpenReceipt}
            />
          </TabsContent>
        )}

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
          if (activeTab === "ledger") fetchLedger();
          if (activeTab === "defaulters") fetchDefaulters();
          if (activeTab === "reports") fetchReport();
          refreshCurrent();
        }}
      />

      <StudentFeeDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        target={detailsTarget}
        onOpenReceipt={handleOpenReceipt}
      />

      <LedgerHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        target={historyTarget}
        onOpenReceipt={handleOpenReceipt}
      />

      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        data={receiptData}
        school={receiptSchool}
        loading={receiptLoading}
        onPrint={handlePrintReceipt}
        onDownload={handleDownloadReceipt}
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

// ===================== Ledger Tab (NEW) =====================
function LedgerTab({
  ledger,
  loading,
  classes,
  filters,
  onViewHistory,
  onRecordPayment,
  onOpenReceipt,
}: {
  ledger: LedgerEntry[];
  loading: boolean;
  classes: ClassOption[];
  filters: {
    classId: string;
    setClassId: (v: string) => void;
    status: string;
    setStatus: (v: string) => void;
    search: string;
    setSearch: (v: string) => void;
    onApply: () => void;
  };
  onViewHistory: (entry: LedgerEntry) => void;
  onRecordPayment: (entry: StudentFeeRow) => void;
  onOpenReceipt: (paymentId: string) => void;
}) {
  const totals = useMemo(() => {
    return {
      expected: ledger.reduce((s, l) => s + l.totalAmount, 0),
      paid: ledger.reduce((s, l) => s + l.paidAmount, 0),
      due: ledger.reduce((s, l) => s + l.dueAmount, 0),
    };
  }, [ledger]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card p-4">
          <div className="text-xs text-muted-foreground">Total Expected</div>
          <div className="text-xl font-bold">{formatCurrency(totals.expected)}</div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-xs text-muted-foreground">Total Collected</div>
          <div className="text-xl font-bold text-emerald-600">{formatCurrency(totals.paid)}</div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-xs text-muted-foreground">Total Due</div>
          <div className="text-xl font-bold text-red-500">{formatCurrency(totals.due)}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <Label className="mb-1.5">Search Student</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name or admission no…"
                value={filters.search}
                onChange={(e) => filters.setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && filters.onApply()}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <Label className="mb-1.5">Class</Label>
            <Select value={filters.classId} onValueChange={filters.setClassId}>
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
            <Select value={filters.status} onValueChange={filters.setStatus}>
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
          <Button onClick={filters.onApply} variant="outline">
            <Search className="w-4 h-4 mr-2" /> Apply
          </Button>
        </div>
      </Card>

      {/* Ledger table */}
      {loading ? (
        <StudentFeesSkeleton />
      ) : ledger.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No ledger entries"
          description="Adjust filters above to view the complete student fee ledger."
        />
      ) : (
        <Card className="glass-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Fee Structure</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((entry) => {
                const fullName = `${entry.student.firstName} ${entry.student.lastName}`;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">{fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.student.admissionNumber} · {entry.student.class?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{entry.feeStructure.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.feeStructure.term} · Due {formatDate(entry.dueDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(entry.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right text-red-500">
                      {formatCurrency(entry.dueAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[entry.status] || ""} variant="outline">
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.lastPayment ? (
                        <div>
                          <div className="text-xs font-mono">{entry.lastPayment.receiptNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(entry.lastPayment.paymentDate)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewHistory(entry)}
                        >
                          <History className="w-3.5 h-3.5 mr-1" /> History
                        </Button>
                        {entry.status !== "paid" && entry.dueAmount > 0 && (
                          <Button
                            size="sm"
                            onClick={() =>
                              onRecordPayment({
                                id: entry.id,
                                studentId: entry.studentId,
                                feeStructureId: entry.feeStructure.id,
                                totalAmount: entry.totalAmount,
                                paidAmount: entry.paidAmount,
                                dueAmount: entry.dueAmount,
                                dueDate: entry.dueDate,
                                status: entry.status,
                                createdAt: "",
                                student: {
                                  id: entry.student.id,
                                  firstName: entry.student.firstName,
                                  lastName: entry.student.lastName,
                                  admissionNumber: entry.student.admissionNumber,
                                  class: entry.student.class,
                                },
                                feeStructure: entry.feeStructure,
                                payments: entry.payments,
                              })
                            }
                            className="gradient-primary text-white"
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </motion.div>
  );
}

// ===================== Ledger History Dialog (NEW) =====================
function LedgerHistoryDialog({
  open,
  onOpenChange,
  target,
  onOpenReceipt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: LedgerEntry | null;
  onOpenReceipt: (paymentId: string) => void;
}) {
  if (!target) return null;
  const fullName = `${target.student.firstName} ${target.student.lastName}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment History</DialogTitle>
          <DialogDescription>
            {fullName} · {target.student.class?.name} · {target.feeStructure.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
            <div className="text-sm font-semibold mb-2">
              All Payments ({target.payments.length})
            </div>
            {target.payments.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border rounded-lg">
                No payments recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Collected By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {target.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                      <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{p.collectedBy || "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenReceipt(p.id)}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

// ===================== Defaulters Tab (NEW) =====================
function DefaultersTab({
  defaulters,
  summary,
  loading,
  classes,
  filters,
  onRemind,
  onRecordPayment,
}: {
  defaulters: DefaulterEntry[];
  summary: {
    totalDue: number;
    avgDaysOverdue: number;
    critical: number;
    overdue: number;
    pending: number;
  } | null;
  loading: boolean;
  classes: ClassOption[];
  filters: {
    classId: string;
    setClassId: (v: string) => void;
    severity: string;
    setSeverity: (v: string) => void;
    onApply: () => void;
  };
  onRemind: (d: DefaulterEntry) => void;
  onRecordPayment: (d: StudentFeeRow) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Defaulters"
          value={defaulters.length}
          icon={Users}
          color="text-red-500"
          delay={0}
        />
        <StatsCard
          title="Total Due Amount"
          value={formatCurrency(summary?.totalDue ?? 0)}
          icon={IndianRupee}
          color="text-amber-500"
          delay={0.1}
        />
        <StatsCard
          title="Avg Days Overdue"
          value={summary?.avgDaysOverdue ?? 0}
          icon={Clock4}
          color="text-orange-500"
          delay={0.2}
        />
        <StatsCard
          title="Critical (>30 days)"
          value={summary?.critical ?? 0}
          icon={AlertTriangle}
          color="text-red-600"
          delay={0.3}
        />
      </div>

      {/* Filters */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="w-full md:w-64">
            <Label className="mb-1.5">Class</Label>
            <Select value={filters.classId} onValueChange={filters.setClassId}>
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
          <div className="w-full md:w-56">
            <Label className="mb-1.5">Severity</Label>
            <Select value={filters.severity} onValueChange={filters.setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="overdue">Overdue (any)</SelectItem>
                <SelectItem value="critical">Critical (&gt;30 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={filters.onApply} variant="outline">
            <Search className="w-4 h-4 mr-2" /> Apply
          </Button>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <StudentFeesSkeleton />
      ) : defaulters.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="All fees paid! 🎉"
          description="No defaulters found. Every student has either fully paid or has no overdue fees."
        />
      ) : (
        <Card className="glass-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Parent Contact</TableHead>
                <TableHead className="text-right">Due Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaulters.map((d) => {
                const fullName = `${d.student.firstName} ${d.student.lastName}`;
                const severityColor =
                  d.severityBucket === "critical"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                    : d.severityBucket === "overdue"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
                return (
                  <TableRow key={d.id} className={d.severityBucket === "critical" ? "bg-red-500/5" : ""}>
                    <TableCell>
                      <div className="font-medium">{fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.student.admissionNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.student.class?.name || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        {d.student.parentPhone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {d.student.parentPhone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No phone</span>
                        )}
                      </div>
                      <div className="text-xs">
                        {d.student.parentEmail ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {d.student.parentEmail}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-500">
                      {formatCurrency(d.dueAmount)}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(d.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={severityColor}>
                        {d.daysOverdue > 0 ? `${d.daysOverdue} days` : "Not overdue"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[d.status] || ""} variant="outline">
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => onRemind(d)}
                          title="Log reminder"
                        >
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            onRecordPayment({
                              id: d.id,
                              studentId: d.student.id,
                              feeStructureId: d.feeStructure.id,
                              totalAmount: d.totalAmount,
                              paidAmount: d.paidAmount,
                              dueAmount: d.dueAmount,
                              dueDate: d.dueDate,
                              status: d.status,
                              createdAt: "",
                              student: {
                                id: d.student.id,
                                firstName: d.student.firstName,
                                lastName: d.student.lastName,
                                admissionNumber: d.student.admissionNumber,
                                class: d.student.class,
                              },
                              feeStructure: d.feeStructure,
                              payments: [],
                            })
                          }
                          className="gradient-primary text-white"
                        >
                          <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </motion.div>
  );
}

// ===================== Collection Report Tab (NEW) =====================
function CollectionReportTab({
  report,
  loading,
  filters,
  onOpenReceipt,
}: {
  report: CollectionReport | null;
  loading: boolean;
  filters: {
    preset: string;
    setPreset: (v: string) => void;
    from: string;
    setFrom: (v: string) => void;
    to: string;
    setTo: (v: string) => void;
    onApply: () => void;
  };
  onOpenReceipt: (paymentId: string) => void;
}) {
  const handleExportCSV = () => {
    if (!report) return;
    const headers = ["Receipt No", "Student", "Admission No", "Class", "Amount", "Method", "Date", "Collected By", "Transaction ID"];
    const rows = report.payments.map((p) => [
      p.receiptNumber,
      p.student?.name || "",
      p.student?.admissionNumber || "",
      p.student?.className || "",
      String(p.amount),
      PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod,
      p.paymentDate,
      p.collectedBy || "",
      p.transactionId || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collection-report-${report.period.from}-to-${report.period.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const pieData = report
    ? [
        { name: "Cash", value: report.breakdown.cash.amount, key: "cash" },
        { name: "Online", value: report.breakdown.online.amount, key: "online" },
        { name: "Cheque", value: report.breakdown.cheque.amount, key: "cheque" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Period selector */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="w-full md:w-48">
            <Label className="mb-1.5">Period</Label>
            <Select value={filters.preset} onValueChange={filters.setPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filters.preset === "custom" && (
            <>
              <div className="w-full md:w-44">
                <Label className="mb-1.5">From</Label>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => filters.setFrom(e.target.value)}
                />
              </div>
              <div className="w-full md:w-44">
                <Label className="mb-1.5">To</Label>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) => filters.setTo(e.target.value)}
                />
              </div>
            </>
          )}
          <Button onClick={filters.onApply} variant="outline">
            <Calendar className="w-4 h-4 mr-2" /> Generate
          </Button>
          {report && (
            <Button onClick={handleExportCSV} variant="outline" className="md:ml-auto">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          )}
        </div>
      </Card>

      {loading || !report ? (
        <OverviewSkeleton />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="Total Collected"
              value={formatCurrency(report.totalCollected)}
              icon={IndianRupee}
              color="text-emerald-600"
              delay={0}
            />
            <StatsCard
              title="Cash"
              value={formatCurrency(report.breakdown.cash.amount)}
              icon={Banknote}
              color="text-emerald-500"
              delay={0.1}
            />
            <StatsCard
              title="Online"
              value={formatCurrency(report.breakdown.online.amount)}
              icon={CreditCard}
              color="text-blue-500"
              delay={0.2}
            />
            <StatsCard
              title="Cheque"
              value={formatCurrency(report.breakdown.cheque.amount)}
              icon={FileText}
              color="text-amber-500"
              delay={0.3}
            />
            <StatsCard
              title="Transactions"
              value={report.transactions}
              icon={ReceiptIcon}
              color="text-primary"
              delay={0.4}
            />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="glass-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Daily Collection</h3>
                  <p className="text-xs text-muted-foreground">
                    {report.period.from} → {report.period.to}
                  </p>
                </div>
              </div>
              {report.dailyChart.every((d) => d.amount === 0) ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  No collection in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={report.dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.008 255)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="oklch(0.52 0.02 260)" />
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
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="oklch(0.55 0.20 150)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "oklch(0.55 0.20 150)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="glass-card p-5">
              <h3 className="font-semibold mb-1">By Payment Method</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribution of collection</p>
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
                          <Cell key={d.key} fill={PAYMENT_METHOD_COLORS[d.key]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid oklch(0.91 0.008 255)",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [formatCurrency(v), "Collected"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {pieData.map((d) => (
                      <div key={d.key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: PAYMENT_METHOD_COLORS[d.key] }}
                          />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Payments table */}
          <Card className="glass-card p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">All Transactions</h3>
                <p className="text-xs text-muted-foreground">
                  {report.payments.length} payment(s) in selected period
                </p>
              </div>
            </div>
            {report.payments.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No payments in this period.
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
                    <TableHead>Collected By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.payments.map((p) => (
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
                      <TableCell className="text-sm">{p.collectedBy || "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => onOpenReceipt(p.id)}
                          title="View receipt"
                        >
                          <ReceiptIcon className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </motion.div>
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

// ===================== Receipt Dialog (Professional Design) =====================
function ReceiptDialog({
  open,
  onOpenChange,
  data,
  school,
  loading,
  onPrint,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReceiptPayment | null;
  school: SchoolInfo | null;
  loading: boolean;
  onPrint: () => void;
  onDownload: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle>Payment Receipt</DialogTitle>
          <DialogDescription>
            Professional fee receipt — print or save as PDF below.
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
            Loading receipt…
          </div>
        ) : (
          <ReceiptPrintArea data={data} school={school} />
        )}

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" /> Close
          </Button>
          <Button onClick={onPrint} disabled={loading} variant="outline">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button
            onClick={onDownload}
            disabled={loading}
            className="gradient-primary text-white"
          >
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptPrintArea({
  data,
  school,
}: {
  data: ReceiptPayment;
  school: SchoolInfo | null;
}) {
  const sf = data.studentFee;
  const student = sf.student;
  const fs = sf.feeStructure;
  const fullName = `${student.firstName} ${student.lastName}`;
  const balanceAfter = Math.max(0, sf.totalAmount - sf.paidAmount);
  const previousBalance = Math.max(0, sf.paidAmount - data.amount);
  const schoolName = school?.name || "Greenwood International School";
  const schoolAddress =
    school?.address || "123 Education Lane, Knowledge Park, New Delhi - 110001";
  const schoolPhone = school?.phone || "+91 98765 43210";
  const schoolEmail = school?.email || "info@greenwood.edu";

  return (
    <div className="receipt-print-area">
      <div className="receipt-paper relative bg-white text-black rounded-lg border-2 border-gray-800 p-6 md:p-8 font-sans overflow-hidden max-w-[800px] mx-auto">
        {/* Watermark */}
        <div className="receipt-watermark">{schoolName}</div>

        {/* Letterhead */}
        <div className="relative text-center border-b-2 border-gray-800 pb-4 mb-5">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-lg shrink-0">
              {schoolName.charAt(0)}
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-wide leading-tight">
                {schoolName}
              </h1>
              <p className="text-[11px] text-gray-700 mt-0.5">
                {schoolAddress}
              </p>
              <p className="text-[11px] text-gray-700">
                Phone: {schoolPhone} · {schoolEmail}
              </p>
            </div>
          </div>
        </div>

        {/* Receipt title + number */}
        <div className="relative flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold uppercase tracking-widest text-gray-900">
            Fee Payment Receipt
          </h2>
          <div className="text-right">
            <div className="text-[10px] text-gray-600 uppercase">Receipt No</div>
            <div className="font-bold font-mono text-sm">{data.receiptNumber}</div>
          </div>
        </div>

        {/* Meta row */}
        <div className="relative grid grid-cols-3 gap-3 mb-4">
          <div className="border border-gray-300 rounded p-2 text-center bg-gray-50">
            <div className="text-[10px] text-gray-600 uppercase">Receipt No</div>
            <div className="font-semibold font-mono text-xs">{data.receiptNumber}</div>
          </div>
          <div className="border border-gray-300 rounded p-2 text-center bg-gray-50">
            <div className="text-[10px] text-gray-600 uppercase">Date</div>
            <div className="font-semibold text-xs">{formatDate(data.paymentDate)}</div>
          </div>
          <div className="border border-gray-300 rounded p-2 text-center bg-gray-50">
            <div className="text-[10px] text-gray-600 uppercase">Payment Method</div>
            <div className="font-semibold text-xs capitalize">
              {PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod}
            </div>
          </div>
        </div>

        {/* Student details */}
        <div className="relative border border-gray-300 rounded p-3 mb-4">
          <div className="text-[10px] text-gray-600 uppercase font-semibold mb-2">
            Student Details
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <span className="text-gray-600">Name: </span>
              <span className="font-semibold">{fullName}</span>
            </div>
            <div>
              <span className="text-gray-600">Admission No: </span>
              <span className="font-semibold">{student.admissionNumber}</span>
            </div>
            <div>
              <span className="text-gray-600">Class: </span>
              <span className="font-semibold">{student.class?.name || "—"}</span>
              {student.section?.name ? (
                <span className="text-gray-600"> · Sec {student.section.name}</span>
              ) : null}
            </div>
            <div>
              <span className="text-gray-600">Father&apos;s Name: </span>
              <span className="font-semibold">{student.fatherName || "—"}</span>
            </div>
            <div>
              <span className="text-gray-600">Fee Structure: </span>
              <span className="font-semibold">{fs.name}</span>
            </div>
            <div>
              <span className="text-gray-600">Term: </span>
              <span className="font-semibold">{fs.term}</span>
            </div>
          </div>
        </div>

        {/* Fee breakdown table */}
        <div className="relative mb-4">
          <table className="w-full text-sm border border-gray-300 border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left py-2 px-3 font-semibold border-r border-gray-600 w-12">
                  S.No
                </th>
                <th className="text-left py-2 px-3 font-semibold border-r border-gray-600">
                  Fee Item
                </th>
                <th className="text-right py-2 px-3 font-semibold w-32">
                  Amount (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {fs.items.length > 0 ? (
                fs.items.map((it, idx) => (
                  <tr key={it.id} className="border-b border-gray-300">
                    <td className="py-1.5 px-3 border-r border-gray-300 text-center">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-3 border-r border-gray-300">{it.name}</td>
                    <td className="py-1.5 px-3 text-right">
                      {it.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-gray-300">
                  <td className="py-1.5 px-3 border-r border-gray-300 text-center">1</td>
                  <td className="py-1.5 px-3 border-r border-gray-300">{fs.name}</td>
                  <td className="py-1.5 px-3 text-right">
                    {sf.totalAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              )}
              <tr className="bg-gray-100 font-bold">
                <td className="py-2 px-3 border-r border-gray-300 text-center" colSpan={2}>
                  Total Fee
                </td>
                <td className="py-2 px-3 text-right">
                  {sf.totalAmount.toLocaleString("en-IN")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment summary boxes */}
        <div className="relative grid grid-cols-4 gap-2 mb-4 text-sm">
          <div className="border border-gray-400 rounded p-2 text-center bg-gray-50">
            <div className="text-[10px] text-gray-600 uppercase">Previous Balance</div>
            <div className="font-bold text-gray-700">
              {previousBalance.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="border-2 border-emerald-600 rounded p-2 text-center bg-emerald-50">
            <div className="text-[10px] text-emerald-700 uppercase">Amount Paid</div>
            <div className="font-bold text-emerald-700">
              {data.amount.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="border border-gray-400 rounded p-2 text-center bg-gray-50">
            <div className="text-[10px] text-gray-600 uppercase">Total Paid</div>
            <div className="font-bold">
              {sf.paidAmount.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="border-2 border-red-600 rounded p-2 text-center bg-red-50">
            <div className="text-[10px] text-red-700 uppercase">Balance Due</div>
            <div className="font-bold text-red-700">
              {balanceAfter.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="relative border border-gray-400 rounded bg-amber-50 p-2.5 mb-4 text-sm">
          <span className="text-gray-700 font-semibold">Rupees in words: </span>
          <span className="italic font-medium">{numberToWords(data.amount)}</span>
        </div>

        {/* Transaction details */}
        {(data.transactionId || data.remarks) && (
          <div className="relative mb-4 text-xs text-gray-700">
            {data.transactionId && (
              <div>
                <span className="font-semibold">Transaction ID: </span>
                <span className="font-mono">{data.transactionId}</span>
              </div>
            )}
            {data.remarks && (
              <div>
                <span className="font-semibold">Remarks: </span>
                <span>{data.remarks}</span>
              </div>
            )}
          </div>
        )}

        {/* Previous payments history */}
        {sf.payments.length > 1 && (
          <div className="relative mb-4">
            <div className="text-[10px] text-gray-600 uppercase font-semibold mb-1.5">
              Payment History
            </div>
            <table className="w-full text-[11px] border border-gray-300 border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-1 px-2 border-r border-gray-300">Receipt #</th>
                  <th className="text-left py-1 px-2 border-r border-gray-300">Date</th>
                  <th className="text-left py-1 px-2 border-r border-gray-300">Method</th>
                  <th className="text-right py-1 px-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sf.payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-1 px-2 border-r border-gray-300 font-mono">
                      {p.receiptNumber}
                    </td>
                    <td className="py-1 px-2 border-r border-gray-300">
                      {formatDate(p.paymentDate)}
                    </td>
                    <td className="py-1 px-2 border-r border-gray-300 capitalize">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                    </td>
                    <td className="py-1 px-2 text-right">
                      {p.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with signatures */}
        <div className="relative flex justify-between items-end mt-10 pt-6 border-t-2 border-gray-300">
          <div className="text-xs text-gray-600 space-y-0.5">
            <div>
              Collected By:{" "}
              <span className="font-semibold">{data.collectedBy || "—"}</span>
            </div>
            <div className="italic text-[10px] mt-1">
              This is a computer-generated receipt and does not require a physical
              signature.
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="border-t border-gray-800 w-24 mt-8 pt-1 text-[10px] text-gray-600">
                Accountant
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-800 w-24 mt-8 pt-1 text-[10px] text-gray-600">
                Principal
              </div>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 -mt-2 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                <Stamp className="w-6 h-6 text-gray-400" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1">School Stamp</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Print Receipt in Iframe (PDF Download) =====================
function printReceiptInIframe(payment: ReceiptPayment, school: SchoolInfo | null) {
  if (typeof window === "undefined") return;

  const sf = payment.studentFee;
  const student = sf.student;
  const fs = sf.feeStructure;
  const fullName = `${student.firstName} ${student.lastName}`;
  const balanceAfter = Math.max(0, sf.totalAmount - sf.paidAmount);
  const previousBalance = Math.max(0, sf.paidAmount - payment.amount);
  const schoolName = school?.name || "Greenwood International School";
  const schoolAddress =
    school?.address || "123 Education Lane, Knowledge Park, New Delhi - 110001";
  const schoolPhone = school?.phone || "+91 98765 43210";
  const schoolEmail = school?.email || "info@greenwood.edu";

  const feeItemsRows =
    fs.items.length > 0
      ? fs.items
          .map(
            (it, idx) => `
            <tr>
              <td class="sn">${idx + 1}</td>
              <td>${escapeHtml(it.name)}</td>
              <td class="amt">${it.amount.toLocaleString("en-IN")}</td>
            </tr>`
          )
          .join("")
      : `
        <tr>
          <td class="sn">1</td>
          <td>${escapeHtml(fs.name)}</td>
          <td class="amt">${sf.totalAmount.toLocaleString("en-IN")}</td>
        </tr>`;

  const paymentHistoryRows =
    sf.payments.length > 1
      ? sf.payments
          .map(
            (p) => `
            <tr>
              <td class="mono">${escapeHtml(p.receiptNumber)}</td>
              <td>${formatDateStatic(p.paymentDate)}</td>
              <td>${escapeHtml(PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod)}</td>
              <td class="amt">${p.amount.toLocaleString("en-IN")}</td>
            </tr>`
          )
          .join("")
      : "";

  const paymentHistoryBlock =
    sf.payments.length > 1
      ? `
      <div class="history-block">
        <div class="section-label">Payment History</div>
        <table class="history-table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date</th>
              <th>Method</th>
              <th class="amt">Amount</th>
            </tr>
          </thead>
          <tbody>${paymentHistoryRows}</tbody>
        </table>
      </div>`
      : "";

  const transactionBlock =
    payment.transactionId || payment.remarks
      ? `
      <div class="txn-block">
        ${payment.transactionId ? `<div><strong>Transaction ID:</strong> <span class="mono">${escapeHtml(payment.transactionId)}</span></div>` : ""}
        ${payment.remarks ? `<div><strong>Remarks:</strong> ${escapeHtml(payment.remarks)}</div>` : ""}
      </div>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt ${payment.receiptNumber}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 0;
    color: #111;
    background: #fff;
  }
  .receipt {
    max-width: 800px;
    margin: 0 auto;
    border: 2px solid #1f2937;
    border-radius: 8px;
    padding: 32px;
    position: relative;
    overflow: hidden;
  }
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 96px;
    font-weight: 800;
    color: #000;
    opacity: 0.05;
    white-space: nowrap;
    pointer-events: none;
    z-index: 0;
  }
  .relative { position: relative; z-index: 1; }
  .letterhead {
    text-align: center;
    border-bottom: 2px solid #1f2937;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .letterhead-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .logo-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #111827;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 20px;
    flex-shrink: 0;
  }
  .school-name { font-size: 24px; font-weight: 700; letter-spacing: 1px; margin: 0; line-height: 1.2; }
  .school-info { font-size: 11px; color: #374151; margin: 2px 0 0; }
  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .receipt-title {
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    margin: 0;
  }
  .receipt-no-label { font-size: 10px; color: #4b5563; text-transform: uppercase; }
  .receipt-no-value { font-family: monospace; font-weight: 700; font-size: 14px; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .meta-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; text-align: center; background: #f9fafb; }
  .meta-label { font-size: 10px; color: #4b5563; text-transform: uppercase; }
  .meta-value { font-weight: 600; font-size: 12px; }
  .section {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
  }
  .section-label {
    font-size: 10px; color: #4b5563; text-transform: uppercase;
    font-weight: 600; margin-bottom: 8px;
  }
  .student-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
  .student-grid .label { color: #4b5563; }
  .student-grid .value { font-weight: 600; }
  .fee-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  .fee-table thead th { background: #1f2937; color: #fff; padding: 8px 12px; font-weight: 600; text-align: left; }
  .fee-table thead th.amt { text-align: right; }
  .fee-table tbody td { padding: 6px 12px; border-bottom: 1px solid #d1d5db; }
  .fee-table tbody td.sn { text-align: center; width: 48px; }
  .fee-table tbody td.amt { text-align: right; }
  .fee-table tfoot td { padding: 8px 12px; background: #f3f4f6; font-weight: 700; }
  .summary-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .summary-box { border: 1px solid #9ca3af; border-radius: 4px; padding: 8px; text-align: center; background: #f9fafb; }
  .summary-box.paid { border: 2px solid #047857; background: #ecfdf5; }
  .summary-box.balance { border: 2px solid #b91c1c; background: #fef2f2; }
  .summary-label { font-size: 10px; color: #4b5563; text-transform: uppercase; }
  .summary-box.paid .summary-label { color: #b45309; }
  .summary-box.balance .summary-label { color: #b91c1c; }
  .summary-value { font-weight: 700; font-size: 14px; }
  .summary-box.paid .summary-value { color: #047857; }
  .summary-box.balance .summary-value { color: #b91c1c; }
  .words-box { border: 1px solid #9ca3af; border-radius: 4px; background: #fffbeb; padding: 10px; margin-bottom: 16px; font-size: 13px; }
  .words-box .label { color: #374151; font-weight: 600; }
  .words-box .value { font-style: italic; font-weight: 500; }
  .txn-block { font-size: 12px; color: #374151; margin-bottom: 16px; }
  .history-block { margin-bottom: 16px; }
  .history-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .history-table thead th { background: #f3f4f6; padding: 6px 8px; text-align: left; border: 1px solid #d1d5db; }
  .history-table tbody td { padding: 4px 8px; border: 1px solid #e5e7eb; }
  .history-table .amt { text-align: right; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 24px; border-top: 2px solid #d1d5db; }
  .footer-info { font-size: 11px; color: #4b5563; }
  .footer-info .disclaimer { font-style: italic; font-size: 10px; margin-top: 4px; }
  .signatures { display: flex; gap: 32px; }
  .sig { text-align: center; }
  .sig-line { border-top: 1px solid #1f2937; width: 96px; margin-top: 32px; padding-top: 4px; font-size: 10px; color: #4b5563; }
  .stamp-box {
    width: 64px; height: 64px; border: 2px dashed #9ca3af; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; margin-top: -8px;
  }
  .stamp-text { font-size: 9px; color: #6b7280; margin-top: 4px; }
  .mono { font-family: monospace; }
  @media print {
    body { background: #fff; }
    .receipt { border: none; max-width: none; padding: 0; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="watermark">${escapeHtml(schoolName)}</div>

    <div class="letterhead relative">
      <div class="letterhead-row">
        <div class="logo-circle">${escapeHtml(schoolName.charAt(0))}</div>
        <div style="text-align: left;">
          <h1 class="school-name">${escapeHtml(schoolName)}</h1>
          <p class="school-info">${escapeHtml(schoolAddress)}</p>
          <p class="school-info">Phone: ${escapeHtml(schoolPhone)} · ${escapeHtml(schoolEmail)}</p>
        </div>
      </div>
    </div>

    <div class="title-row relative">
      <h2 class="receipt-title">Fee Payment Receipt</h2>
      <div style="text-align: right;">
        <div class="receipt-no-label">Receipt No</div>
        <div class="receipt-no-value">${escapeHtml(payment.receiptNumber)}</div>
      </div>
    </div>

    <div class="meta-row relative">
      <div class="meta-box">
        <div class="meta-label">Receipt No</div>
        <div class="meta-value mono">${escapeHtml(payment.receiptNumber)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Date</div>
        <div class="meta-value">${formatDateStatic(payment.paymentDate)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Payment Method</div>
        <div class="meta-value" style="text-transform: capitalize;">${escapeHtml(PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod)}</div>
      </div>
    </div>

    <div class="section relative">
      <div class="section-label">Student Details</div>
      <div class="student-grid">
        <div><span class="label">Name: </span><span class="value">${escapeHtml(fullName)}</span></div>
        <div><span class="label">Admission No: </span><span class="value">${escapeHtml(student.admissionNumber)}</span></div>
        <div><span class="label">Class: </span><span class="value">${escapeHtml(student.class?.name || "—")}</span>${student.section?.name ? `<span class="label"> · Sec ${escapeHtml(student.section.name)}</span>` : ""}</div>
        <div><span class="label">Father's Name: </span><span class="value">${escapeHtml(student.fatherName || "—")}</span></div>
        <div><span class="label">Fee Structure: </span><span class="value">${escapeHtml(fs.name)}</span></div>
        <div><span class="label">Term: </span><span class="value">${escapeHtml(fs.term)}</span></div>
      </div>
    </div>

    <table class="fee-table relative">
      <thead>
        <tr>
          <th>S.No</th>
          <th>Fee Item</th>
          <th class="amt">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>${feeItemsRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total Fee</td>
          <td class="amt">${sf.totalAmount.toLocaleString("en-IN")}</td>
        </tr>
      </tfoot>
    </table>

    <div class="summary-row relative">
      <div class="summary-box">
        <div class="summary-label">Previous Balance</div>
        <div class="summary-value">${previousBalance.toLocaleString("en-IN")}</div>
      </div>
      <div class="summary-box paid">
        <div class="summary-label">Amount Paid</div>
        <div class="summary-value">${payment.amount.toLocaleString("en-IN")}</div>
      </div>
      <div class="summary-box">
        <div class="summary-label">Total Paid</div>
        <div class="summary-value">${sf.paidAmount.toLocaleString("en-IN")}</div>
      </div>
      <div class="summary-box balance">
        <div class="summary-label">Balance Due</div>
        <div class="summary-value">${balanceAfter.toLocaleString("en-IN")}</div>
      </div>
    </div>

    <div class="words-box relative">
      <span class="label">Rupees in words: </span>
      <span class="value">${escapeHtml(numberToWords(payment.amount))}</span>
    </div>

    ${transactionBlock ? `<div class="relative">${transactionBlock}</div>` : ""}
    ${paymentHistoryBlock ? `<div class="relative">${paymentHistoryBlock}</div>` : ""}

    <div class="footer relative">
      <div class="footer-info">
        <div>Collected By: <strong>${escapeHtml(payment.collectedBy || "—")}</strong></div>
        <div class="disclaimer">This is a computer-generated receipt and does not require a physical signature.</div>
      </div>
      <div class="signatures">
        <div class="sig">
          <div class="sig-line">Accountant</div>
        </div>
        <div class="sig">
          <div class="sig-line">Principal</div>
        </div>
        <div class="sig">
          <div class="stamp-box"><span style="font-size: 9px; color: #9ca3af;">STAMP</span></div>
          <div class="stamp-text">School Stamp</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  // Create a hidden iframe and trigger print
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print failed", e);
    }
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // already removed
      }
    }, 1500);
  };

  // Wait for the iframe to load before printing
  iframe.onload = () => setTimeout(triggerPrint, 250);
  // Fallback in case onload doesn't fire
  setTimeout(() => {
    if (iframe.parentNode) triggerPrint();
  }, 800);
}

// ===================== Helpers =====================
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateStatic(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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
