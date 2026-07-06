"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Plus,
  Trash2,
  Printer,
  Search,
  FileText,
  ScrollText,
  UserCheck,
  Shield,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { apiFetch, formatDate } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// ===================== Types =====================
interface StudentLite {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  rollNumber?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  parentPhone?: string | null;
  admissionDate?: string | null;
  classId?: string | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

interface CertificateRow {
  id: string;
  studentId: string;
  type: string;
  issueDate: string;
  issuedBy?: string | null;
  content?: string | null;
  serialNumber?: string | null;
  createdAt: string;
  student: Pick<StudentLite, "id" | "firstName" | "lastName" | "admissionNumber" | "classId" | "class" | "section">;
}

interface CertificateDetail extends CertificateRow {
  student: StudentLite;
  school: {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
  };
}

// ===================== Constants =====================
const CERT_TYPES = [
  { value: "transfer", label: "Transfer Certificate (TC)", icon: ScrollText },
  { value: "bonafide", label: "Bonafide Certificate", icon: UserCheck },
  { value: "character", label: "Character Certificate", icon: Shield },
];

const CERT_TYPE_META: Record<string, { label: string; color: string; icon: typeof ScrollText }> = {
  transfer: {
    label: "Transfer Certificate",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    icon: ScrollText,
  },
  bonafide: {
    label: "Bonafide Certificate",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: UserCheck,
  },
  character: {
    label: "Character Certificate",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: Shield,
  },
};

// ===================== Main Component =====================
export function CertificatesModule() {
  const { user } = useAuthStore();
  const isStudentOrParent = user?.role === "student" || user?.role === "parent";

  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<CertificateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CertificateRow | null>(null);

  const fetchCertificates = useCallback(async (): Promise<CertificateRow[]> => {
    setLoading(true);
    try {
      const data = await apiFetch<{ certificates: CertificateRow[] }>(
        "/api/certificates"
      );
      const list = data.certificates || [];
      setCertificates(list);
      return list;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load certificates");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const data = await apiFetch<CertificateDetail>(`/api/certificates/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load certificate");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates().then((data) => {
      // Auto-select first if none selected
      if (data && data.length > 0) {
        setSelectedId((prev) => prev || data[0].id);
      }
    });
  }, [fetchCertificates]);

  useEffect(() => {
    fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  const handleGenerated = (newId: string) => {
    setGenerateOpen(false);
    fetchCertificates().then(() => {
      setSelectedId(newId);
      fetchDetail(newId);
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/certificates/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Certificate deleted");
      if (selectedId === deleteTarget.id) setSelectedId("");
      setDeleteTarget(null);
      fetchCertificates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .cert-print, .cert-print * { visibility: visible !important; }
          .cert-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important;
            width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border: none !important;
            transform: none !important;
            max-height: none !important; overflow: visible !important;
          }
          .cert-paper {
            box-shadow: none !important; border: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
        }
        `,
        }}
      />

      <PageHeader
        title="Certificates"
        description="Generate Transfer, Bonafide & Character certificates — printable."
        icon={Award}
        actionLabel={isStudentOrParent ? undefined : "Generate Certificate"}
        onAction={isStudentOrParent ? undefined : () => setGenerateOpen(true)}
      />

      {loading && certificates.length === 0 ? (
        <CertificatesSkeleton />
      ) : certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates issued yet"
          description={
            isStudentOrParent
              ? "You don't have any certificates issued yet."
              : "Generate your first Transfer, Bonafide, or Character certificate for any student."
          }
          actionLabel={isStudentOrParent ? undefined : "Generate Certificate"}
          onAction={isStudentOrParent ? undefined : () => setGenerateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: List */}
          <div className="lg:col-span-4 no-print">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Issued Certificates
                  <Badge variant="secondary" className="ml-auto">
                    {certificates.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[70vh] overflow-y-auto">
                  {certificates.map((c) => {
                    const meta = CERT_TYPE_META[c.type];
                    const Icon = meta?.icon || FileText;
                    const isActive = c.id === selectedId;
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 border-b cursor-pointer transition-colors ${
                          isActive
                            ? "bg-primary/10 border-l-4 border-l-primary"
                            : "hover:bg-muted/50 border-l-4 border-l-transparent"
                        }`}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta?.color || ""}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm truncate">
                                {c.student.firstName} {c.student.lastName}
                              </p>
                              {!isStudentOrParent && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(c);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {meta?.label || c.type}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-mono">{c.serialNumber || "—"}</span>
                              <span>·</span>
                              <span>{formatDate(c.issueDate)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-8">
            {!selectedId ? (
              <Card className="glass-card">
                <CardContent className="py-20">
                  <EmptyState
                    icon={FileText}
                    title="Select a certificate"
                    description="Pick a certificate from the list to preview its printable version here."
                  />
                </CardContent>
              </Card>
            ) : loadingDetail ? (
              <Card className="glass-card">
                <CardContent className="py-20">
                  <Skeleton className="h-8 w-1/2 mx-auto" />
                  <Skeleton className="h-4 w-1/3 mx-auto mt-4" />
                  <Skeleton className="h-32 w-full mt-8" />
                </CardContent>
              </Card>
            ) : !detail ? (
              <Card className="glass-card">
                <CardContent className="py-20">
                  <EmptyState
                    icon={FileText}
                    title="Certificate not found"
                    description="The selected certificate could not be loaded."
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between no-print">
                  <div>
                    <p className="text-sm font-medium">Preview</p>
                    <p className="text-xs text-muted-foreground">
                      Review the certificate below, then print or save as PDF.
                    </p>
                  </div>
                  <Button onClick={() => window.print()} className="gradient-primary text-white">
                    <Printer className="w-4 h-4 mr-2" /> Print / PDF
                  </Button>
                </div>
                <CertificatePreview detail={detail} />
                <p className="text-center text-xs text-muted-foreground no-print">
                  <Download className="w-3 h-3 inline-block mr-1" />
                  Tip: Click Print, then choose &quot;Save as PDF&quot; to download this certificate.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Dialog */}
      <GenerateCertificateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        defaultIssuedBy={user?.name || ""}
        onGenerated={handleGenerated}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteTarget && CERT_TYPE_META[deleteTarget.type]?.label}
              {" "}for {deleteTarget?.student.firstName} {deleteTarget?.student.lastName} (Serial: {deleteTarget?.serialNumber}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================== Generate Certificate Dialog =====================
function GenerateCertificateDialog({
  open,
  onOpenChange,
  defaultIssuedBy,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultIssuedBy: string;
  onGenerated: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentLite | null>(null);

  const [type, setType] = useState<"transfer" | "bonafide" | "character">("bonafide");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [issuedBy, setIssuedBy] = useState(defaultIssuedBy);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setStudents([]);
      setSelectedStudent(null);
      setType("bonafide");
      setIssueDate(new Date().toISOString().split("T")[0]);
      setIssuedBy(defaultIssuedBy);
      setContent("");
    }
  }, [open, defaultIssuedBy]);

  // Debounced student search
  useEffect(() => {
    if (!open) return;
    if (!search.trim()) {
      setStudents([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch<StudentLite[]>(
          `/api/students?search=${encodeURIComponent(search.trim())}&status=active`
        );
        setStudents(Array.isArray(data) ? data : []);
      } catch {
        setStudents([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, open]);

  const handleSubmit = async () => {
    if (!selectedStudent) {
      toast.error("Please select a student");
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<{ id: string }>("/api/certificates", {
        method: "POST",
        body: JSON.stringify({
          studentId: selectedStudent.id,
          type,
          issueDate,
          issuedBy,
          content: content.trim() || undefined,
        }),
      });
      toast.success("Certificate generated");
      onGenerated(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate certificate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Certificate</DialogTitle>
          <DialogDescription>
            Issue a Transfer, Bonafide, or Character certificate for any student.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student Search */}
          <div className="space-y-2">
            <Label>Search Student *</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Type name, admission no, or phone…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedStudent(null);
                }}
                className="pl-9"
              />
            </div>
            {searching && (
              <p className="text-xs text-muted-foreground">Searching…</p>
            )}
            {!searching && students.length > 0 && !selectedStudent && (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStudent(s);
                      setSearch(`${s.firstName} ${s.lastName}`);
                      setStudents([]);
                    }}
                    className="w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.admissionNumber}
                        {s.class?.name ? ` · ${s.class.name}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedStudent.admissionNumber}
                      {selectedStudent.class?.name ? ` · ${selectedStudent.class.name}` : ""}
                      {selectedStudent.fatherName ? ` · S/o ${selectedStudent.fatherName}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      setSelectedStudent(null);
                      setSearch("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Certificate Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {CERT_TYPES.map((t) => {
                const Icon = t.icon;
                const isActive = type === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value as typeof type)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-xs font-medium leading-tight">{t.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Issued By</Label>
              <Input
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="Principal / Authorized signatory"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Custom Content (Optional)</Label>
            <Textarea
              rows={3}
              placeholder="Add any additional remarks or override default content…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the standard template for this certificate type.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gradient-primary text-white">
            {saving ? "Generating…" : "Generate & Preview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Certificate Preview (Printable) =====================
function CertificatePreview({ detail }: { detail: CertificateDetail }) {
  const student = detail.student;
  const school = detail.school;
  const fullName = `${student.firstName} ${student.lastName}`;
  const fatherName = student.fatherName || "—";
  const motherName = student.motherName || "—";
  const className = student.class?.name || "—";
  const section = student.section?.name || "—";
  const dob = student.dob ? formatDate(student.dob) : "—";
  const dobWords = student.dob ? dateToWords(student.dob) : "—";
  const admissionNo = student.admissionNumber || "—";
  const admissionDate = student.admissionDate ? formatDate(student.admissionDate) : "—";
  const genderPronoun = student.gender === "female" ? "D/o" : "S/o";
  const pronoun = student.gender === "female" ? "her" : "his";
  const pronounCap = student.gender === "female" ? "Her" : "His";

  if (detail.type === "transfer") {
    return (
      <CertificatePaper detail={detail}>
        <CertificateHeader school={school} title="TRANSFER CERTIFICATE" serialNumber={detail.serialNumber} />

        <div className="p-8">
          <div className="flex justify-end mb-4">
            <div className="text-right">
              <span className="text-xs text-gray-600">Serial No.</span>
              <div className="font-mono font-bold text-sm">{detail.serialNumber || "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
            <TCField label="1. Admission No." value={admissionNo} />
            <TCField label="2. Name" value={fullName} />
            <TCField label="3. Father's Name" value={fatherName} />
            <TCField label="4. Mother's Name" value={motherName} />
            <TCField label="5. Date of Birth" value={dob} />
            <TCField label="6. Date of Birth (in words)" value={dobWords} />
            <TCField label="7. Class at the time of leaving" value={className} />
            <TCField label="8. Section" value={section} />
            <TCField label="9. Date of Admission" value={admissionDate} />
            <TCField label="10. Date of Issue" value={formatDate(detail.issueDate)} />
            <TCField label="11. Conduct" value="Good" />
            <TCField label="12. Fees Paid" value="Yes, up to date" />
          </div>

          {detail.content && (
            <div className="border-t border-b border-black/40 py-3 my-4 text-sm italic">
              <span className="font-semibold">Note: </span>
              {detail.content}
            </div>
          )}

          <p className="text-sm text-gray-700 mb-8">
            This is to certify that <strong>{fullName}</strong>, {genderPronoun}{" "}
            <strong>{fatherName}</strong>, was a bonafide student of this school and was studying in{" "}
            <strong>Class {className}</strong>. {pronounCap} character and conduct during {pronoun} stay
            in this school were <strong>good</strong>. {pronounCap} date of birth as recorded in the
            school register is <strong>{dob}</strong> ({dobWords}).
          </p>

          <div className="grid grid-cols-3 gap-8 mt-16 pt-6">
            <SignatureBox label="Class Teacher" />
            <SignatureBox label="Clerk" />
            <SignatureBox label="Principal" withSeal />
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            This Transfer Certificate is issued on {formatDate(detail.issueDate)}.
            {detail.issuedBy ? ` Issued by: ${detail.issuedBy}.` : ""}
          </p>
        </div>
      </CertificatePaper>
    );
  }

  if (detail.type === "bonafide") {
    return (
      <CertificatePaper detail={detail}>
        <CertificateHeader school={school} title="BONAFIDE CERTIFICATE" serialNumber={detail.serialNumber} />

        <div className="p-10">
          <div className="flex justify-end mb-6">
            <div className="text-right">
              <span className="text-xs text-gray-600">Serial No.</span>
              <div className="font-mono font-bold text-sm">{detail.serialNumber || "—"}</div>
            </div>
          </div>

          <p className="text-justify text-base leading-relaxed mb-6 mt-8">
            This is to certify that <strong className="underline">{fullName}</strong>,{" "}
            {genderPronoun} <strong>{fatherName}</strong>, is a bonafide student of this school,
            studying in <strong>Class {className}</strong>{section ? `, Section ${section}` : ""}.
            {pronounCap} date of birth as per the school records is{" "}
            <strong>{dob}</strong>{dobWords !== "—" ? ` (${dobWords})` : ""}.
            {student.admissionNumber ? ` ${pronounCap} admission number is ${admissionNo}.` : ""}
          </p>

          {detail.content && (
            <p className="text-sm italic text-gray-700 mb-6 border-l-4 border-gray-300 pl-4">
              {detail.content}
            </p>
          )}

          <p className="text-sm text-gray-700 mb-12">
            This certificate is issued on request for the academic year{" "}
            {new Date(detail.issueDate).getFullYear()}.
          </p>

          <div className="flex justify-end mt-16">
            <div className="text-center w-56">
              <div className="h-16" />
              <div className="border-t border-black pt-2">
                <p className="text-sm font-semibold">Principal</p>
                <p className="text-xs text-gray-600">{school.name}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end mt-8 text-xs text-gray-600">
            <div>
              <span className="font-semibold">Date:</span> {formatDate(detail.issueDate)}
            </div>
            {detail.issuedBy && (
              <div>
                <span className="font-semibold">Issued by:</span> {detail.issuedBy}
              </div>
            )}
          </div>
        </div>
      </CertificatePaper>
    );
  }

  // character
  return (
    <CertificatePaper detail={detail}>
      <CertificateHeader school={school} title="CHARACTER CERTIFICATE" serialNumber={detail.serialNumber} />

      <div className="p-10">
        <div className="flex justify-end mb-6">
          <div className="text-right">
            <span className="text-xs text-gray-600">Serial No.</span>
            <div className="font-mono font-bold text-sm">{detail.serialNumber || "—"}</div>
          </div>
        </div>

        <p className="text-justify text-base leading-relaxed mb-6 mt-8">
          This is to certify that <strong className="underline">{fullName}</strong>,{" "}
          {genderPronoun} <strong>{fatherName}</strong>, was a bonafide student of this school,
          studying in <strong>Class {className}</strong>{section ? `, Section ${section}` : ""},
          during the academic session. {pronounCap} date of birth as per school records is{" "}
          <strong>{dob}</strong>.
        </p>

        <p className="text-justify text-base leading-relaxed mb-6">
          To the best of my knowledge, {pronoun} bears a <strong>good moral character</strong>.
          {pronounCap} conduct and behaviour during {pronoun} stay in this school have been
          satisfactory. {pronounCap} has not been involved in any undesirable activity to my knowledge.
        </p>

        {detail.content && (
          <p className="text-sm italic text-gray-700 mb-6 border-l-4 border-gray-300 pl-4">
            {detail.content}
          </p>
        )}

        <p className="text-sm text-gray-700 mb-12">
          This certificate is issued on {pronoun} request for the academic year{" "}
          {new Date(detail.issueDate).getFullYear()}.
        </p>

        <div className="flex justify-end mt-16">
          <div className="text-center w-56">
            <div className="h-16" />
            <div className="border-t border-black pt-2">
              <p className="text-sm font-semibold">Principal</p>
              <p className="text-xs text-gray-600">{school.name}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end mt-8 text-xs text-gray-600">
          <div>
            <span className="font-semibold">Date:</span> {formatDate(detail.issueDate)}
          </div>
          {detail.issuedBy && (
            <div>
              <span className="font-semibold">Issued by:</span> {detail.issuedBy}
            </div>
          )}
        </div>
      </div>
    </CertificatePaper>
  );
}

// ===================== Certificate Layout Primitives =====================
function CertificatePaper({
  detail,
  children,
}: {
  detail: CertificateDetail;
  children: React.ReactNode;
}) {
  return (
    <div className="cert-print">
      <Card className="cert-paper bg-white text-black border-4 border-black shadow-2xl">
        {children}
      </Card>
    </div>
  );
}

function CertificateHeader({
  school,
  title,
  serialNumber,
}: {
  school: CertificateDetail["school"];
  title: string;
  serialNumber?: string | null;
}) {
  return (
    <div className="border-b-4 border-black p-6 bg-gradient-to-r from-gray-50 to-white">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {school.logo ? (
            <img
              src={school.logo}
              alt="logo"
              className="w-16 h-16 object-contain"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center text-2xl font-bold shrink-0">
              {school.name?.charAt(0) || "S"}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-tight">
              {school.name}
            </h1>
            {school.address && (
              <p className="text-sm text-gray-700">{school.address}</p>
            )}
            <p className="text-xs text-gray-600 mt-0.5">
              {school.phone ? `Phone: ${school.phone}` : ""}
              {school.email ? ` · Email: ${school.email}` : ""}
            </p>
          </div>
        </div>
        {serialNumber && (
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-600 uppercase tracking-wide">Serial No.</div>
            <div className="font-mono font-bold text-sm border border-black px-2 py-1 mt-1">
              {serialNumber}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 text-center">
        <div className="inline-block px-12 py-2 border-y-2 border-double border-black">
          <h2 className="text-2xl font-bold uppercase tracking-[0.3em]">{title}</h2>
        </div>
      </div>
    </div>
  );
}

function TCField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-black/20 pb-1.5">
      <span className="text-gray-700 font-medium flex-1">{label}</span>
      <span className="text-black font-semibold">: {value}</span>
    </div>
  );
}

function SignatureBox({ label, withSeal }: { label: string; withSeal?: boolean }) {
  return (
    <div className="text-center">
      <div className="h-14 relative">
        {withSeal && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-[10px] text-gray-400 uppercase">
              School Seal
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-black pt-2">
        <p className="text-sm font-semibold text-black">{label}</p>
      </div>
    </div>
  );
}

// ===================== Helpers =====================
function dateToWords(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const dayWords = numberToWords(day);
    const yearWords = numberToWords(year);
    return `${dayWords} ${month} ${yearWords}`;
  } catch {
    return "—";
  }
}

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numberToWords(-n);
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 1000000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  return numberToWords(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + numberToWords(n % 1000000) : "");
}

// ===================== Skeleton =====================
function CertificatesSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4">
        <Card className="glass-card">
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-8">
        <Card className="glass-card">
          <CardContent className="py-20">
            <Skeleton className="h-8 w-1/2 mx-auto" />
            <Skeleton className="h-4 w-1/3 mx-auto mt-4" />
            <Skeleton className="h-32 w-full mt-8" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
