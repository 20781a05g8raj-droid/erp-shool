import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Clock, FileText,
  BookOpen, Wallet, Library, Bus, UserCog, Megaphone, Award, BarChart3,
  Building2, School, type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const ALL_MODULES: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "students", label: "Students", icon: Users },
  { id: "staff", label: "Staff", icon: GraduationCap },
  { id: "classes", label: "Classes & Sections", icon: School },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "timetable", label: "Timetable", icon: Clock },
  { id: "exams", label: "Exams & Grades", icon: FileText },
  { id: "homework", label: "Homework", icon: BookOpen },
  { id: "fees", label: "Fee Management", icon: Wallet },
  { id: "library", label: "Library", icon: Library },
  { id: "transport", label: "Transport", icon: Bus },
  { id: "hr", label: "HR & Payroll", icon: UserCog },
  { id: "notices", label: "Notices & Events", icon: Megaphone },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "schools", label: "Schools", icon: Building2 },
];

export const ROLE_MODULES: Record<Role, string[]> = {
  super_admin: [
    "dashboard", "schools", "students", "staff", "classes", "attendance",
    "timetable", "exams", "homework", "fees", "library", "transport",
    "hr", "notices", "certificates", "reports",
  ],
  school_admin: [
    "dashboard", "students", "staff", "classes", "attendance", "timetable",
    "exams", "homework", "fees", "library", "transport", "hr", "notices",
    "certificates", "reports",
  ],
  teacher: [
    "dashboard", "attendance", "timetable", "exams", "homework", "students", "notices",
  ],
  student: [
    "dashboard", "attendance", "timetable", "exams", "homework", "fees", "notices",
  ],
  parent: [
    "dashboard", "attendance", "fees", "homework", "notices", "transport",
  ],
  accountant: ["dashboard", "fees", "students", "reports"],
  librarian: ["dashboard", "library"],
  transport_manager: ["dashboard", "transport", "students"],
  hr: ["dashboard", "staff", "hr", "timetable", "attendance", "students"],
};

export function getNavItems(role: Role): NavItem[] {
  const ids = ROLE_MODULES[role] || [];
  return ALL_MODULES.filter((m) => ids.includes(m.id));
}
