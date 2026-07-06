"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bus,
  Route as RouteIcon,
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  User,
  UserPlus,
  Loader2,
  CircleDollarSign,
  Hash,
  Navigation,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/store/auth";
import { apiFetch, formatCurrency } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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

// ============ Types ============
interface TransportRouteRow {
  id: string;
  name: string;
  stops?: string | null;
  fare: number;
  createdAt: string;
  vehicles?: {
    id: string;
    busNumber: string;
    driverName: string;
    driverPhone: string;
    capacity: number;
  }[];
  _count?: { studentTransport: number; vehicles: number };
}

interface VehicleRow {
  id: string;
  busNumber: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  routeId?: string | null;
  createdAt: string;
  route?: { id: string; name: string; fare: number } | null;
  _count?: { studentTransport: number };
}

interface StudentLite {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

interface AssignmentRow {
  id: string;
  studentId: string;
  routeId: string;
  vehicleId?: string | null;
  pickupPoint?: string | null;
  createdAt: string;
  student: StudentLite;
  route: {
    id: string;
    name: string;
    stops?: string | null;
    fare: number;
  };
  vehicle?: {
    id: string;
    busNumber: string;
    driverName: string;
    driverPhone: string;
    capacity: number;
  } | null;
}

// ============ Constants ============
const EMPTY_ROUTE_FORM = {
  name: "",
  stops: "",
  fare: 0,
};

const EMPTY_VEHICLE_FORM = {
  busNumber: "",
  driverName: "",
  driverPhone: "",
  capacity: 30,
  routeId: "",
};

// ============ Helpers ============
function parseStops(stops?: string | null): string[] {
  if (!stops) return [];
  return stops
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// =================================================================
// TransportModule
// =================================================================
export function TransportModule() {
  const { user } = useAuthStore();
  const isParent = user?.role === "parent";

  const [activeTab, setActiveTab] = useState(
    isParent ? "assignments" : "routes"
  );

  // Routes state
  const [routes, setRoutes] = useState<TransportRouteRow[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState(EMPTY_ROUTE_FORM);
  const [submittingRoute, setSubmittingRoute] = useState(false);
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);

  // Vehicles state
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM);
  const [submittingVehicle, setSubmittingVehicle] = useState(false);
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [assignForm, setAssignForm] = useState({
    studentId: "",
    routeId: "",
    vehicleId: "",
    pickupPoint: "",
  });
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [deleteAssignId, setDeleteAssignId] = useState<string | null>(null);

  // Parent-only: their child's single assignment (already in assignments[0])
  const myAssignment = useMemo(
    () => (assignments.length > 0 ? assignments[0] : null),
    [assignments]
  );

  // ---------- Fetchers ----------
  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const data = await apiFetch<TransportRouteRow[]>(`/api/transport/routes`);
      setRoutes(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load routes");
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    try {
      const data = await apiFetch<VehicleRow[]>(`/api/transport/vehicles`);
      setVehicles(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load vehicles");
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      // For parent role, fetch only their child's assignment
      const url = isParent && user?.studentId
        ? `/api/transport/assignments?studentId=${user.studentId}`
        : `/api/transport/assignments`;
      const data = await apiFetch<AssignmentRow[]>(url);
      setAssignments(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load assignments"
      );
    } finally {
      setLoadingAssignments(false);
    }
  }, [isParent, user?.studentId]);

  const fetchStudents = useCallback(async () => {
    try {
      const data = await apiFetch<StudentLite[]>(
        `/api/students?search=${encodeURIComponent(studentSearch)}`
      );
      setStudents(data);
    } catch {
      /* silent */
    }
  }, [studentSearch]);

  // ---------- Effects ----------
  useEffect(() => {
    fetchRoutes();
    fetchVehicles();
    fetchAssignments();
  }, [fetchRoutes, fetchVehicles, fetchAssignments]);

  useEffect(() => {
    if (activeTab !== "assignments" || isParent) return;
    const t = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch, activeTab, isParent, fetchStudents]);

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const totalRoutes = routes.length;
    const totalVehicles = vehicles.length;
    const totalStudentsAssigned = assignments.length;
    const totalCapacity = vehicles.reduce((s, v) => s + v.capacity, 0);
    return {
      totalRoutes,
      totalVehicles,
      totalStudentsAssigned,
      totalCapacity,
    };
  }, [routes, vehicles, assignments]);

  // Vehicles filtered by chosen route (for assign dialog)
  const vehiclesForRoute = useMemo(() => {
    if (!assignForm.routeId) return [];
    return vehicles.filter(
      (v) => !v.routeId || v.routeId === assignForm.routeId
    );
  }, [vehicles, assignForm.routeId]);

  // Stops of the currently-selected route (for pickup point select)
  const selectedRouteStops = useMemo(() => {
    if (!assignForm.routeId) return [];
    const route = routes.find((r) => r.id === assignForm.routeId);
    return parseStops(route?.stops);
  }, [routes, assignForm.routeId]);

  // ---------- Handlers ----------
  const openAddRoute = () => {
    setEditingRouteId(null);
    setRouteForm(EMPTY_ROUTE_FORM);
    setRouteDialogOpen(true);
  };
  const openEditRoute = (route: TransportRouteRow) => {
    setEditingRouteId(route.id);
    setRouteForm({
      name: route.name,
      stops: route.stops || "",
      fare: route.fare,
    });
    setRouteDialogOpen(true);
  };
  const submitRoute = async () => {
    if (!routeForm.name.trim()) {
      toast.error("Route name is required");
      return;
    }
    setSubmittingRoute(true);
    try {
      if (editingRouteId) {
        await apiFetch(`/api/transport/routes/${editingRouteId}`, {
          method: "PUT",
          body: JSON.stringify(routeForm),
        });
        toast.success("Route updated");
      } else {
        await apiFetch(`/api/transport/routes`, {
          method: "POST",
          body: JSON.stringify(routeForm),
        });
        toast.success("Route added");
      }
      setRouteDialogOpen(false);
      await fetchRoutes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save route");
    } finally {
      setSubmittingRoute(false);
    }
  };
  const confirmDeleteRoute = async () => {
    if (!deleteRouteId) return;
    try {
      await apiFetch(`/api/transport/routes/${deleteRouteId}`, {
        method: "DELETE",
      });
      toast.success("Route deleted");
      setDeleteRouteId(null);
      await fetchRoutes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete route");
    }
  };

  const openAddVehicle = () => {
    setEditingVehicleId(null);
    setVehicleForm(EMPTY_VEHICLE_FORM);
    setVehicleDialogOpen(true);
  };
  const openEditVehicle = (v: VehicleRow) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      busNumber: v.busNumber,
      driverName: v.driverName,
      driverPhone: v.driverPhone,
      capacity: v.capacity,
      routeId: v.routeId || "",
    });
    setVehicleDialogOpen(true);
  };
  const submitVehicle = async () => {
    if (!vehicleForm.busNumber.trim()) {
      toast.error("Bus number is required");
      return;
    }
    if (!vehicleForm.driverName.trim()) {
      toast.error("Driver name is required");
      return;
    }
    setSubmittingVehicle(true);
    try {
      if (editingVehicleId) {
        await apiFetch(`/api/transport/vehicles/${editingVehicleId}`, {
          method: "PUT",
          body: JSON.stringify(vehicleForm),
        });
        toast.success("Vehicle updated");
      } else {
        await apiFetch(`/api/transport/vehicles`, {
          method: "POST",
          body: JSON.stringify(vehicleForm),
        });
        toast.success("Vehicle added");
      }
      setVehicleDialogOpen(false);
      await Promise.all([fetchVehicles(), fetchRoutes()]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save vehicle"
      );
    } finally {
      setSubmittingVehicle(false);
    }
  };
  const confirmDeleteVehicle = async () => {
    if (!deleteVehicleId) return;
    try {
      await apiFetch(`/api/transport/vehicles/${deleteVehicleId}`, {
        method: "DELETE",
      });
      toast.success("Vehicle deleted");
      setDeleteVehicleId(null);
      await fetchVehicles();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete vehicle"
      );
    }
  };

  const openAssignDialog = () => {
    setAssignForm({ studentId: "", routeId: "", vehicleId: "", pickupPoint: "" });
    setStudentSearch("");
    setAssignDialogOpen(true);
  };
  const submitAssign = async () => {
    if (!assignForm.studentId) {
      toast.error("Select a student");
      return;
    }
    if (!assignForm.routeId) {
      toast.error("Select a route");
      return;
    }
    setSubmittingAssign(true);
    try {
      await apiFetch(`/api/transport/assignments`, {
        method: "POST",
        body: JSON.stringify({
          studentId: assignForm.studentId,
          routeId: assignForm.routeId,
          vehicleId: assignForm.vehicleId || undefined,
          pickupPoint: assignForm.pickupPoint || undefined,
        }),
      });
      toast.success("Student assigned to transport");
      setAssignDialogOpen(false);
      await fetchAssignments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign transport"
      );
    } finally {
      setSubmittingAssign(false);
    }
  };
  const confirmDeleteAssign = async () => {
    if (!deleteAssignId) return;
    try {
      await apiFetch(`/api/transport/assignments/${deleteAssignId}`, {
        method: "DELETE",
      });
      toast.success("Assignment removed");
      setDeleteAssignId(null);
      await fetchAssignments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove assignment"
      );
    }
  };

  // ---------- Parent View ----------
  if (isParent) {
    return (
      <ParentTransportView
        loading={loadingAssignments}
        assignment={myAssignment}
      />
    );
  }

  // ---------- Admin / Staff View ----------
  return (
    <div>
      <PageHeader
        title="Transport Management"
        description="Manage bus routes, vehicles, and student assignments."
        icon={Bus}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="routes">
            <RouteIcon className="w-4 h-4 mr-1.5" />
            Routes
          </TabsTrigger>
          <TabsTrigger value="vehicles">
            <Bus className="w-4 h-4 mr-1.5" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <Users className="w-4 h-4 mr-1.5" />
            Student Assignments
          </TabsTrigger>
        </TabsList>

        {/* ============ Routes Tab ============ */}
        <TabsContent value="routes" className="mt-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total Routes"
              value={stats.totalRoutes}
              icon={RouteIcon}
              color="text-indigo-600"
              delay={0}
            />
            <StatsCard
              title="Total Vehicles"
              value={stats.totalVehicles}
              icon={Bus}
              color="text-blue-600"
              delay={0.05}
            />
            <StatsCard
              title="Students Assigned"
              value={stats.totalStudentsAssigned}
              icon={Users}
              color="text-emerald-600"
              delay={0.1}
            />
            <StatsCard
              title="Total Capacity"
              value={stats.totalCapacity}
              icon={Hash}
              color="text-amber-600"
              delay={0.15}
            />
          </div>

          <div className="flex justify-end mb-4">
            <Button
              onClick={openAddRoute}
              className="gradient-primary text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Route
            </Button>
          </div>

          {loadingRoutes ? (
            <CardsSkeleton count={3} />
          ) : routes.length === 0 ? (
            <EmptyState
              icon={RouteIcon}
              title="No routes yet"
              description="Add your first transport route to get started."
              actionLabel="Add Route"
              onAction={openAddRoute}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {routes.map((route, idx) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  index={idx}
                  onEdit={() => openEditRoute(route)}
                  onDelete={() => setDeleteRouteId(route.id)}
                />
              ))}
            </motion.div>
          )}
        </TabsContent>

        {/* ============ Vehicles Tab ============ */}
        <TabsContent value="vehicles" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button
              onClick={openAddVehicle}
              className="gradient-primary text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </div>

          {loadingVehicles ? (
            <TableSkeleton />
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={Bus}
              title="No vehicles yet"
              description="Add your first bus / vehicle to get started."
              actionLabel="Add Vehicle"
              onAction={openAddVehicle}
            />
          ) : (
            <Card className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bus No.</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        {v.busNumber}
                      </TableCell>
                      <TableCell>{v.driverName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.driverPhone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{v.capacity}</Badge>
                      </TableCell>
                      <TableCell>
                        {v.route ? (
                          <Badge variant="secondary">{v.route.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {v._count?.studentTransport ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditVehicle(v)}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteVehicleId(v.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============ Assignments Tab ============ */}
        <TabsContent value="assignments" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button
              onClick={openAssignDialog}
              className="gradient-primary text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Assign Student
            </Button>
          </div>

          {loadingAssignments ? (
            <TableSkeleton />
          ) : assignments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No assignments yet"
              description="Assign students to transport routes and vehicles."
              actionLabel="Assign Student"
              onAction={openAssignDialog}
            />
          ) : (
            <Card className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Pickup Point</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">
                          {a.student.firstName} {a.student.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.student.admissionNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.student.class?.name || "—"}
                        {a.student.section?.name
                          ? ` — ${a.student.section.name}`
                          : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.route.name}</Badge>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Fare: {formatCurrency(a.route.fare)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.vehicle ? (
                          <div>
                            <div className="font-medium">
                              {a.vehicle.busNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.vehicle.driverName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.pickupPoint ? (
                          <Badge variant="outline">{a.pickupPoint}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteAssignId(a.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ============ Route Dialog ============ */}
      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRouteId ? "Edit Route" : "Add Route"}
            </DialogTitle>
            <DialogDescription>
              {editingRouteId
                ? "Update route details below."
                : "Create a new transport route."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Route Name *</Label>
              <Input
                value={routeForm.name}
                onChange={(e) =>
                  setRouteForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Route A — North Zone"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">
                Stops (comma-separated)
              </Label>
              <Input
                value={routeForm.stops}
                onChange={(e) =>
                  setRouteForm((f) => ({ ...f, stops: e.target.value }))
                }
                placeholder="Main Gate, Sector 5, Bus Stand, Lake Road"
              />
              {parseStops(routeForm.stops).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parseStops(routeForm.stops).map((stop, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      <MapPin className="w-3 h-3 mr-1" />
                      {stop}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block">Fare (₹)</Label>
              <Input
                type="number"
                min={0}
                value={routeForm.fare}
                onChange={(e) =>
                  setRouteForm((f) => ({
                    ...f,
                    fare: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRouteDialogOpen(false)}
              disabled={submittingRoute}
            >
              Cancel
            </Button>
            <Button
              onClick={submitRoute}
              disabled={submittingRoute}
              className="gradient-primary text-white"
            >
              {submittingRoute && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingRouteId ? "Save Changes" : "Add Route"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Vehicle Dialog ============ */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}
            </DialogTitle>
            <DialogDescription>
              {editingVehicleId
                ? "Update vehicle details below."
                : "Register a new bus / vehicle."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div>
              <Label className="mb-1.5 block">Bus Number *</Label>
              <Input
                value={vehicleForm.busNumber}
                onChange={(e) =>
                  setVehicleForm((f) => ({ ...f, busNumber: e.target.value }))
                }
                placeholder="e.g. KA-01-AB-1234"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Capacity</Label>
              <Input
                type="number"
                min={1}
                value={vehicleForm.capacity}
                onChange={(e) =>
                  setVehicleForm((f) => ({
                    ...f,
                    capacity: Number(e.target.value) || 30,
                  }))
                }
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Driver Name *</Label>
              <Input
                value={vehicleForm.driverName}
                onChange={(e) =>
                  setVehicleForm((f) => ({ ...f, driverName: e.target.value }))
                }
                placeholder="Driver full name"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Driver Phone</Label>
              <Input
                value={vehicleForm.driverPhone}
                onChange={(e) =>
                  setVehicleForm((f) => ({ ...f, driverPhone: e.target.value }))
                }
                placeholder="+91-9876543210"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Route</Label>
              <Select
                value={vehicleForm.routeId}
                onValueChange={(v) =>
                  setVehicleForm((f) => ({ ...f, routeId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to a route (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No route —</SelectItem>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVehicleDialogOpen(false)}
              disabled={submittingVehicle}
            >
              Cancel
            </Button>
            <Button
              onClick={submitVehicle}
              disabled={submittingVehicle}
              className="gradient-primary text-white"
            >
              {submittingVehicle && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingVehicleId ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Assign Dialog ============ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Student to Transport</DialogTitle>
            <DialogDescription>
              Pick a student, route, vehicle, and pickup point.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Student *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search student by name / admission no."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={assignForm.studentId}
                  onValueChange={(v) =>
                    setAssignForm((f) => ({ ...f, studentId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No students found
                      </div>
                    ) : (
                      students.slice(0, 50).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.admissionNumber})
                          {s.class ? ` — ${s.class.name}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Route *</Label>
              <Select
                value={assignForm.routeId}
                onValueChange={(v) =>
                  setAssignForm((f) => ({
                    ...f,
                    routeId: v,
                    vehicleId: "",
                    pickupPoint: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No routes available
                    </div>
                  ) : (
                    routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} — {formatCurrency(r.fare)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Vehicle</Label>
              <Select
                value={assignForm.vehicleId}
                onValueChange={(v) =>
                  setAssignForm((f) => ({ ...f, vehicleId: v }))
                }
                disabled={!assignForm.routeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      assignForm.routeId
                        ? "Select a vehicle (optional)"
                        : "Select a route first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No specific vehicle —</SelectItem>
                  {vehiclesForRoute.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.busNumber} — {v.driverName} (cap {v.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Pickup Point</Label>
              {selectedRouteStops.length > 0 ? (
                <Select
                  value={assignForm.pickupPoint}
                  onValueChange={(v) =>
                    setAssignForm((f) => ({ ...f, pickupPoint: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a stop (or type custom below)" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedRouteStops.map((stop) => (
                      <SelectItem key={stop} value={stop}>
                        {stop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={assignForm.pickupPoint}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, pickupPoint: e.target.value }))
                  }
                  placeholder="Type pickup point"
                />
              )}
              {selectedRouteStops.length > 0 && (
                <Input
                  className="mt-2"
                  value={assignForm.pickupPoint}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, pickupPoint: e.target.value }))
                  }
                  placeholder="Or type a custom pickup point"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={submittingAssign}
            >
              Cancel
            </Button>
            <Button
              onClick={submitAssign}
              disabled={submittingAssign}
              className="gradient-primary text-white"
            >
              {submittingAssign && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete Confirmations ============ */}
      <AlertDialog
        open={!!deleteRouteId}
        onOpenChange={(o) => !o && setDeleteRouteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this route?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the route. Vehicles linked to it will be
              unassigned. Routes with active student assignments cannot be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRoute}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteVehicleId}
        onOpenChange={(o) => !o && setDeleteVehicleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              The vehicle will be permanently removed. Vehicles with active
              student assignments cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteVehicle}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteAssignId}
        onOpenChange={(o) => !o && setDeleteAssignId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              The student will no longer be assigned to this transport route.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAssign}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =================================================================
// Sub-components
// =================================================================
function RouteCard({
  route,
  index,
  onEdit,
  onDelete,
}: {
  route: TransportRouteRow;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stops = parseStops(route.stops);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className="glass-card p-4 h-full flex flex-col hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{route.name}</h3>
              <p className="text-xs text-muted-foreground">
                Fare:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(route.fare)}
                </span>
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex-1">
          {stops.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {stops.map((stop, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  <MapPin className="w-3 h-3 mr-1" />
                  {stop}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No stops defined
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Bus className="w-3.5 h-3.5" />
            {route._count?.vehicles ?? route.vehicles?.length ?? 0} vehicle(s)
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            {route._count?.studentTransport ?? 0} student(s)
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass-card p-4 h-44 animate-pulse">
          <div className="space-y-3">
            <div className="h-5 bg-muted/60 rounded w-2/3" />
            <div className="h-3 bg-muted/60 rounded w-1/3" />
            <div className="h-4 bg-muted/40 rounded w-full" />
            <div className="h-4 bg-muted/40 rounded w-3/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card className="glass-card p-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    </Card>
  );
}

// =================================================================
// Parent View (read-only — only their child's transport info)
// =================================================================
function ParentTransportView({
  loading,
  assignment,
}: {
  loading: boolean;
  assignment: AssignmentRow | null;
}) {
  return (
    <div>
      <PageHeader
        title="Transport"
        description="Your child's transport information."
        icon={Bus}
      />

      {loading ? (
        <CardsSkeleton count={1} />
      ) : !assignment ? (
        <EmptyState
          icon={Bus}
          title="No transport assigned"
          description="Your child is not currently assigned to any transport route. Please contact the school office."
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Route Card */}
          <Card className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Route</h3>
                <p className="text-sm text-muted-foreground">
                  {assignment.route.name}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Pickup Point
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-medium">
                    {assignment.pickupPoint || "—"}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Fare
                </div>
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign className="w-4 h-4 text-primary" />
                  <span className="font-medium">
                    {formatCurrency(assignment.route.fare)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs text-muted-foreground mb-2">
                Route Stops
              </div>
              {parseStops(assignment.route.stops).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parseStops(assignment.route.stops).map((stop, i) => (
                    <Badge
                      key={i}
                      variant={
                        stop === assignment.pickupPoint ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      {stop}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No stops defined.
                </p>
              )}
            </div>
          </Card>

          {/* Vehicle / Driver Card */}
          <Card className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Vehicle</h3>
                <p className="text-sm text-muted-foreground">
                  {assignment.vehicle?.busNumber || "Not assigned"}
                </p>
              </div>
            </div>

            {assignment.vehicle ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Driver Name
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      {assignment.vehicle.driverName}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Driver Phone
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-primary" />
                    <a
                      href={`tel:${assignment.vehicle.driverPhone}`}
                      className="font-medium hover:underline"
                    >
                      {assignment.vehicle.driverPhone || "—"}
                    </a>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Capacity
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      {assignment.vehicle.capacity} seats
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No vehicle assigned to this route yet.
              </p>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
