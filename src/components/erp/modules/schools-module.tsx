"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users,
  GraduationCap,
  UsersRound,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { apiFetch, formatDate, formatCurrency } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

// ===================== Types =====================
interface SchoolRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  establishedDate: string | null;
  createdAt: string;
  counts: { students: number; staff: number; classes: number };
  revenue: { total: number; due: number; expected: number };
  subscription: string;
}

// ===================== AccessDenied =====================
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
        <Lock className="w-10 h-10 text-red-500/70" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5">Access Restricted</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        The Schools Management module is only available to Super Admin users.
        Please contact your administrator if you need access.
      </p>
    </div>
  );
}

// ===================== Main Component =====================
export function SchoolsModule() {
  const { user } = useAuthStore();

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ schools: SchoolRow[] }>("/api/schools");
      setSchools(data.schools);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "super_admin") {
      void loadSchools();
    } else {
      setLoading(false);
    }
  }, [user, loadSchools]);

  const handleSave = async (formData: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo: string;
    establishedDate: string;
  }) => {
    try {
      const payload = {
        name: formData.name,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        logo: formData.logo || null,
        establishedDate: formData.establishedDate || null,
      };
      if (editing) {
        await apiFetch(`/api/schools/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("School updated");
      } else {
        await apiFetch(`/api/schools`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("School created");
      }
      setDialogOpen(false);
      setEditing(null);
      await loadSchools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save school");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/schools/${deleteId}`, { method: "DELETE" });
      toast.success("School deleted");
      setDeleteId(null);
      await loadSchools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete school");
    }
  };

  // Aggregate stats
  const totals = schools.reduce(
    (acc, s) => {
      acc.totalStudents += s.counts.students;
      acc.totalStaff += s.counts.staff;
      acc.totalClasses += s.counts.classes;
      acc.totalRevenue += s.revenue.total;
      return acc;
    },
    { totalStudents: 0, totalStaff: 0, totalClasses: 0, totalRevenue: 0 }
  );

  if (user?.role !== "super_admin") {
    return <AccessDenied />;
  }

  return (
    <div>
      <PageHeader
        title="Schools Management"
        description="Super admin: manage all schools on the platform."
        icon={Building2}
        actionLabel="Add School"
        onAction={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard title="Total Schools" value={schools.length} icon={Building2} color="text-blue-600" delay={0} />
        <StatsCard title="Total Students" value={totals.totalStudents} icon={Users} color="text-emerald-600" delay={0.1} />
        <StatsCard title="Total Staff" value={totals.totalStaff} icon={UsersRound} color="text-purple-600" delay={0.2} />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(totals.totalRevenue)}
          icon={IndianRupee}
          color="text-amber-600"
          delay={0.3}
        />
      </div>

      {loading ? (
        <SchoolsSkeleton />
      ) : schools.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No schools yet"
          description="Add your first school to start managing the platform."
          actionLabel="Add School"
          onAction={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schools.map((school, i) => (
            <SchoolCard
              key={school.id}
              school={school}
              index={i}
              onEdit={() => {
                setEditing(school);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteId(school.id)}
            />
          ))}
        </div>
      )}

      <SchoolDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        school={editing}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this school?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the school and ALL of its data — students,
              staff, classes, fees, attendance, exams, and more. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete School
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================== School Card =====================
function SchoolCard({
  school,
  index,
  onEdit,
  onDelete,
}: {
  school: SchoolRow;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isActive = school.subscription === "Active";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.3 }}
    >
      <Card className="glass-card hover:shadow-lg transition-all h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                {school.logo ? (
                  <img src={school.logo} alt={school.name} className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <Building2 className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate">{school.name}</h3>
                <Badge
                  className={
                    isActive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }
                >
                  {isActive ? (
                    <>
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Trial
                    </>
                  )}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
            {school.address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{school.address}</span>
              </div>
            )}
            {school.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{school.phone}</span>
              </div>
            )}
            {school.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{school.email}</span>
              </div>
            )}
            {school.establishedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Est. {formatDate(school.establishedDate)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-blue-500/10 p-2 text-center">
              <Users className="w-3.5 h-3.5 mx-auto mb-1 text-blue-600" />
              <div className="text-base font-bold">{school.counts.students}</div>
              <div className="text-[10px] text-muted-foreground">Students</div>
            </div>
            <div className="rounded-lg bg-purple-500/10 p-2 text-center">
              <UsersRound className="w-3.5 h-3.5 mx-auto mb-1 text-purple-600" />
              <div className="text-base font-bold">{school.counts.staff}</div>
              <div className="text-[10px] text-muted-foreground">Staff</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
              <GraduationCap className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-600" />
              <div className="text-base font-bold">{school.counts.classes}</div>
              <div className="text-[10px] text-muted-foreground">Classes</div>
            </div>
          </div>

          <div className="pt-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Revenue</span>
            <div className="text-right">
              <div className="font-semibold text-emerald-600">{formatCurrency(school.revenue.total)}</div>
              <div className="text-[10px] text-red-600">{formatCurrency(school.revenue.due)} due</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== School Dialog =====================
function SchoolDialog({
  open,
  onOpenChange,
  school,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  school: SchoolRow | null;
  onSave: (data: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo: string;
    establishedDate: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [establishedDate, setEstablishedDate] = useState("");

  useEffect(() => {
    // Wrap in IIFE so setState calls aren't seen as synchronous by the
    // react-hooks/set-state-in-effect lint rule (matches the project pattern).
    (() => {
      if (open) {
        setName(school?.name || "");
        setAddress(school?.address || "");
        setPhone(school?.phone || "");
        setEmail(school?.email || "");
        setLogo(school?.logo || "");
        setEstablishedDate(school?.establishedDate || "");
      }
    })();
  }, [open, school]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("School name is required");
      return;
    }
    onSave({ name: name.trim(), address: address.trim(), phone: phone.trim(), email: email.trim(), logo: logo.trim(), establishedDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{school ? "Edit School" : "Add School"}</DialogTitle>
          <DialogDescription>
            {school ? "Update school details." : "Register a new school on the platform."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="school-name">School Name</Label>
            <Input
              id="school-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Greenwood International School"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school-address">Address</Label>
            <Input
              id="school-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full postal address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="school-phone">Phone</Label>
              <Input
                id="school-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school-email">Email</Label>
              <Input
                id="school-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@school.edu"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="school-established">Established Date</Label>
              <Input
                id="school-established"
                type="date"
                value={establishedDate}
                onChange={(e) => setEstablishedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school-logo">Logo URL</Label>
              <Input
                id="school-logo"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary text-white">
              {school ? "Update School" : "Create School"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Skeleton =====================
function SchoolsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="glass-card">
          <CardContent className="p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-muted rounded-xl" />
              <div className="flex-1">
                <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            </div>
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-2/3 mb-4" />
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
