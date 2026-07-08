"use client";

import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/auth";
import { Loader2 } from "lucide-react";

const loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

// Lazy-load all modules
const DashboardModule = dynamic(() => import("@/components/erp/modules/dashboard-module").then((m) => m.DashboardModule), { loadingComponent: loading });
const StudentsModule = dynamic(() => import("@/components/erp/modules/students-module").then((m) => m.StudentsModule), { loadingComponent: loading });
const StaffModule = dynamic(() => import("@/components/erp/modules/staff-module").then((m) => m.StaffModule), { loadingComponent: loading });
const ClassesModule = dynamic(() => import("@/components/erp/modules/classes-module").then((m) => m.ClassesModule), { loadingComponent: loading });
const AttendanceModule = dynamic(() => import("@/components/erp/modules/attendance-module").then((m) => m.AttendanceModule), { loadingComponent: loading });
const TimetableModule = dynamic(() => import("@/components/erp/modules/timetable-module").then((m) => m.TimetableModule), { loadingComponent: loading });
const ExamsModule = dynamic(() => import("@/components/erp/modules/exams-module").then((m) => m.ExamsModule), { loadingComponent: loading });
const HomeworkModule = dynamic(() => import("@/components/erp/modules/homework-module").then((m) => m.HomeworkModule), { loadingComponent: loading });
const FeesModule = dynamic(() => import("@/components/erp/modules/fees-module").then((m) => m.FeesModule), { loadingComponent: loading });
const LibraryModule = dynamic(() => import("@/components/erp/modules/library-module").then((m) => m.LibraryModule), { loadingComponent: loading });
const TransportModule = dynamic(() => import("@/components/erp/modules/transport-module").then((m) => m.TransportModule), { loadingComponent: loading });
const HrModule = dynamic(() => import("@/components/erp/modules/hr-module").then((m) => m.HrModule), { loadingComponent: loading });
const NoticesModule = dynamic(() => import("@/components/erp/modules/notices-module").then((m) => m.NoticesModule), { loadingComponent: loading });
const CertificatesModule = dynamic(() => import("@/components/erp/modules/certificates-module").then((m) => m.CertificatesModule), { loadingComponent: loading });
const ReportsModule = dynamic(() => import("@/components/erp/modules/reports-module").then((m) => m.ReportsModule), { loadingComponent: loading });
const SchoolsModule = dynamic(() => import("@/components/erp/modules/schools-module").then((m) => m.SchoolsModule), { loadingComponent: loading });
const UsersModule = dynamic(() => import("@/components/erp/modules/users-module").then((m) => m.UsersModule), { loadingComponent: loading });

export function ModuleRouter() {
  const { currentModule } = useAuthStore();

  switch (currentModule) {
    case "dashboard":
      return <DashboardModule />;
    case "users":
      return <UsersModule />;
    case "students":
      return <StudentsModule />;
    case "staff":
      return <StaffModule />;
    case "classes":
      return <ClassesModule />;
    case "attendance":
      return <AttendanceModule />;
    case "timetable":
      return <TimetableModule />;
    case "exams":
      return <ExamsModule />;
    case "homework":
      return <HomeworkModule />;
    case "fees":
      return <FeesModule />;
    case "library":
      return <LibraryModule />;
    case "transport":
      return <TransportModule />;
    case "hr":
      return <HrModule />;
    case "notices":
      return <NoticesModule />;
    case "certificates":
      return <CertificatesModule />;
    case "reports":
      return <ReportsModule />;
    case "schools":
      return <SchoolsModule />;
    default:
      return <DashboardModule />;
  }
}
