import type { Role } from "@/types";

// ==================== PERMISSION MATRIX ====================
// Defines what each role can DO (not just what they can SEE).
// Navigation visibility is in navigation.ts; this is for action-level permissions.

// Roles that can manage (create/edit/delete) students
export const CAN_MANAGE_STUDENTS: Role[] = ["school_admin", "super_admin", "accountant"];

// Roles that can manage (create/edit/delete) staff
export const CAN_MANAGE_STAFF: Role[] = ["school_admin", "super_admin", "hr"];

// Roles that can edit timetable (add/edit/delete slots)
export const CAN_EDIT_TIMETABLE: Role[] = ["school_admin", "super_admin", "hr"];

// Roles that can mark student attendance
export const CAN_MARK_STUDENT_ATTENDANCE: Role[] = ["school_admin", "super_admin", "teacher", "hr"];

// Roles that can mark staff attendance
export const CAN_MARK_STAFF_ATTENDANCE: Role[] = ["school_admin", "super_admin", "hr"];

// Roles that can manage fees (structures, record payments)
export const CAN_MANAGE_FEES: Role[] = ["school_admin", "super_admin", "accountant"];

// Roles that can manage library (books, issues)
export const CAN_MANAGE_LIBRARY: Role[] = ["school_admin", "super_admin", "librarian"];

// Roles that can manage transport
export const CAN_MANAGE_TRANSPORT: Role[] = ["school_admin", "super_admin", "transport_manager"];

// Roles that can manage HR (leaves, payroll)
export const CAN_MANAGE_HR: Role[] = ["school_admin", "super_admin", "hr"];

// Roles that can post homework
export const CAN_POST_HOMEWORK: Role[] = ["school_admin", "super_admin", "teacher"];

// Roles that can enter exam marks
export const CAN_ENTER_MARKS: Role[] = ["school_admin", "super_admin", "teacher"];

// Roles that can post notices
export const CAN_POST_NOTICES: Role[] = ["school_admin", "super_admin", "teacher"];

// Roles that can generate certificates
export const CAN_GENERATE_CERTIFICATES: Role[] = ["school_admin", "super_admin"];

// Roles that can manage classes/sections/subjects
export const CAN_MANAGE_CLASSES: Role[] = ["school_admin", "super_admin"];

// Roles that can manage schools (super admin only)
export const CAN_MANAGE_SCHOOLS: Role[] = ["super_admin"];

// ==================== HELPER FUNCTIONS ====================

export function canManageStudents(role: Role): boolean {
  return CAN_MANAGE_STUDENTS.includes(role);
}

export function canManageStaff(role: Role): boolean {
  return CAN_MANAGE_STAFF.includes(role);
}

export function canEditTimetable(role: Role): boolean {
  return CAN_EDIT_TIMETABLE.includes(role);
}

export function canMarkStudentAttendance(role: Role): boolean {
  return CAN_MARK_STUDENT_ATTENDANCE.includes(role);
}

export function canMarkStaffAttendance(role: Role): boolean {
  return CAN_MARK_STAFF_ATTENDANCE.includes(role);
}

export function canManageFees(role: Role): boolean {
  return CAN_MANAGE_FEES.includes(role);
}

export function canManageLibrary(role: Role): boolean {
  return CAN_MANAGE_LIBRARY.includes(role);
}

export function canManageTransport(role: Role): boolean {
  return CAN_MANAGE_TRANSPORT.includes(role);
}

export function canManageHR(role: Role): boolean {
  return CAN_MANAGE_HR.includes(role);
}

export function canPostHomework(role: Role): boolean {
  return CAN_POST_HOMEWORK.includes(role);
}

export function canEnterMarks(role: Role): boolean {
  return CAN_ENTER_MARKS.includes(role);
}

export function canPostNotices(role: Role): boolean {
  return CAN_POST_NOTICES.includes(role);
}

export function canGenerateCertificates(role: Role): boolean {
  return CAN_GENERATE_CERTIFICATES.includes(role);
}

export function canManageClasses(role: Role): boolean {
  return CAN_MANAGE_CLASSES.includes(role);
}

// Server-side: check if user role is allowed for a write operation
export function requireRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
