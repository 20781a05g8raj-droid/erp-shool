// Shared TypeScript types matching the database schema

export type Role =
  | "super_admin"
  | "school_admin"
  | "teacher"
  | "student"
  | "parent"
  | "accountant"
  | "librarian"
  | "transport_manager"
  | "hr";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  schoolId: string | null;
  phone?: string | null;
  avatar?: string | null;
  status: string;
  studentId?: string | null;
  staffId?: string | null;
}

export interface School {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
}

export interface Student {
  id: string;
  admissionNumber: string;
  rollNumber?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  photo?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  status: string;
  schoolId: string;
  fatherName?: string | null;
  motherName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  admissionDate?: string | null;
  class?: Class | null;
  section?: Section | null;
}

export interface Staff {
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
  schoolId: string;
  status: string;
}

export interface Class {
  id: string;
  name: string;
  order: number;
  schoolId: string;
  sections?: Section[];
}

export interface Section {
  id: string;
  name: string;
  classId: string;
  classTeacherId?: string | null;
}

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  schoolId: string;
}

export interface StudentAttendance {
  id: string;
  studentId: string;
  date: string;
  status: string;
  markedBy?: string | null;
}

export interface FeeStructure {
  id: string;
  name: string;
  classId?: string | null;
  schoolId: string;
  term: string;
  totalAmount: number;
  dueDate?: string | null;
  items?: FeeItem[];
  class?: Class | null;
}

export interface FeeItem {
  id: string;
  feeStructureId: string;
  name: string;
  amount: number;
}

export interface StudentFee {
  id: string;
  studentId: string;
  feeStructureId: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate?: string | null;
  status: string;
  student?: Student | null;
  feeStructure?: FeeStructure | null;
  payments?: FeePayment[];
}

export interface FeePayment {
  id: string;
  studentFeeId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  receiptNumber: string;
  transactionId?: string | null;
  collectedBy?: string | null;
  remarks?: string | null;
}

export interface LibraryBook {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  publisher?: string | null;
  totalCopies: number;
  availableCopies: number;
  coverImage?: string | null;
  shelfLocation?: string | null;
  schoolId: string;
}

export interface BookIssue {
  id: string;
  bookId: string;
  studentId?: string | null;
  staffId?: string | null;
  borrowerName?: string | null;
  issueDate: string;
  dueDate: string;
  returnDate?: string | null;
  fine: number;
  status: string;
  book?: LibraryBook | null;
  student?: Student | null;
}

export interface TransportRoute {
  id: string;
  name: string;
  stops?: string | null;
  fare: number;
  schoolId: string;
  vehicles?: Vehicle[];
}

export interface Vehicle {
  id: string;
  busNumber: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  routeId?: string | null;
  schoolId: string;
  route?: TransportRoute | null;
}

export interface Exam {
  id: string;
  name: string;
  type: string;
  schoolId: string;
  classId: string;
  startDate: string;
  endDate: string;
  maxMarks: number;
  class?: Class | null;
  results?: ExamResult[];
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  subjectId: string;
  marksObtained: number;
  maxMarks: number;
  grade?: string | null;
  remarks?: string | null;
  subject?: Subject | null;
}

export interface Homework {
  id: string;
  classId: string;
  sectionId?: string | null;
  subjectId?: string | null;
  staffId?: string | null;
  title: string;
  description?: string | null;
  dueDate: string;
  attachment?: string | null;
  schoolId: string;
  class?: Class | null;
  subject?: Subject | null;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  sectionId: string;
  day: string;
  period: number;
  subjectId?: string | null;
  staffId?: string | null;
  startTime: string;
  endTime: string;
  subject?: Subject | null;
  staff?: Staff | null;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  targetClassId?: string | null;
  targetRole?: string | null;
  postedBy?: string | null;
  date: string;
  schoolId: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  endDate?: string | null;
  type: string;
  schoolId: string;
}

export interface StaffLeave {
  id: string;
  staffId: string;
  fromDate: string;
  toDate: string;
  reason?: string | null;
  type: string;
  status: string;
  approvedBy?: string | null;
  staff?: Staff | null;
}

export interface Payroll {
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
  staff?: Staff | null;
}

export interface Certificate {
  id: string;
  studentId: string;
  type: string;
  issueDate: string;
  issuedBy?: string | null;
  content?: string | null;
  serialNumber?: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  accountant: "Accountant",
  librarian: "Librarian",
  transport_manager: "Transport Manager",
  hr: "HR Manager",
};
