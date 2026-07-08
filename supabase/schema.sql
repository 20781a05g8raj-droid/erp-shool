-- ============================================================================
-- EduFlow ERP — Supabase Schema (Complete)
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- This creates ALL tables, RLS policies, storage buckets, triggers, and seed data.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'school_admin', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'transport_manager', 'hr');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE student_status AS ENUM ('active', 'alumni', 'transferred', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_type AS ENUM ('teaching', 'non_teaching');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fee_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'online', 'cheque');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'leave', 'halfday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM ('casual', 'sick', 'earned', 'unpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE exam_type AS ENUM ('unit_test', 'mid_term', 'final');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE book_issue_status AS ENUM ('issued', 'returned', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('holiday', 'ptm', 'exam', 'function', 'event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE certificate_type AS ENUM ('transfer', 'bonafide', 'character');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notice_audience AS ENUM ('all', 'class', 'role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- ---------- SCHOOLS ----------
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo TEXT,
  established_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- PROFILES (linked to auth.users 1:1) ----------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  role user_role NOT NULL DEFAULT 'school_admin',
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  student_id UUID,  -- FK added below (circular with students)
  staff_id UUID,    -- FK added below (circular with staff)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- CLASSES ----------
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- SECTIONS ----------
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  class_teacher_id UUID, -- FK to staff added below
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- SUBJECTS ----------
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- CLASS_SUBJECTS (junction) ----------
CREATE TABLE IF NOT EXISTS class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE(class_id, subject_id)
);

-- ---------- STAFF ----------
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dob TEXT,
  gender TEXT,
  designation TEXT,
  department TEXT,
  qualification TEXT,
  joining_date TEXT,
  type staff_type DEFAULT 'teaching',
  photo TEXT,
  salary DECIMAL(12,2) DEFAULT 0,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Now add FK from sections.class_teacher_id → staff.id
DO $$ BEGIN
  ALTER TABLE sections ADD CONSTRAINT sections_class_teacher_fk
    FOREIGN KEY (class_teacher_id) REFERENCES staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- STUDENTS ----------
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_number TEXT UNIQUE NOT NULL,
  roll_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dob TEXT,
  gender TEXT,
  blood_group TEXT,
  address TEXT,
  photo TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  status student_status DEFAULT 'active',
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  father_name TEXT,
  mother_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  admission_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Now add FKs from profiles → students/staff (circular)
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_student_fk
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_staff_fk
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- STUDENT_ATTENDANCE ----------
CREATE TABLE IF NOT EXISTS student_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  status attendance_status DEFAULT 'present',
  marked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)
);

-- ---------- STAFF_ATTENDANCE ----------
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'present',
  check_in TEXT,
  check_out TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, date)
);

-- ---------- TIMETABLE_SLOTS ----------
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  period INTEGER NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- EXAMS ----------
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type exam_type,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  start_date TEXT,
  end_date TEXT,
  max_marks INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- EXAM_RESULTS ----------
CREATE TABLE IF NOT EXISTS exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  marks_obtained DECIMAL(6,2) DEFAULT 0,
  max_marks INTEGER DEFAULT 100,
  grade TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id, subject_id)
);

-- ---------- HOMEWORK ----------
CREATE TABLE IF NOT EXISTS homework (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  attachment TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- FEE_STRUCTURES ----------
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  due_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- FEE_ITEMS ----------
CREATE TABLE IF NOT EXISTS fee_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0
);

-- ---------- STUDENT_FEES ----------
CREATE TABLE IF NOT EXISTS student_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  total_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  due_amount DECIMAL(12,2) DEFAULT 0,
  due_date TEXT,
  status fee_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- FEE_PAYMENTS ----------
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method payment_method DEFAULT 'cash',
  payment_date TEXT,
  receipt_number TEXT,
  transaction_id TEXT,
  collected_by TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- LIBRARY_BOOKS ----------
CREATE TABLE IF NOT EXISTS library_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  category TEXT,
  publisher TEXT,
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  cover_image TEXT,
  shelf_location TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- BOOK_ISSUES ----------
CREATE TABLE IF NOT EXISTS book_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  borrower_name TEXT,
  issue_date TEXT,
  due_date TEXT,
  return_date TEXT,
  fine DECIMAL(10,2) DEFAULT 0,
  status book_issue_status DEFAULT 'issued',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- TRANSPORT_ROUTES ----------
CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stops TEXT, -- CSV of stop names
  fare DECIMAL(10,2) DEFAULT 0,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- VEHICLES ----------
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  capacity INTEGER DEFAULT 30,
  route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- STUDENT_TRANSPORT ----------
CREATE TABLE IF NOT EXISTS student_transport (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  pickup_point TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- STAFF_LEAVES ----------
CREATE TABLE IF NOT EXISTS staff_leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT,
  type leave_type DEFAULT 'casual',
  status leave_status DEFAULT 'pending',
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- PAYROLLS ----------
CREATE TABLE IF NOT EXISTS payrolls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic_salary DECIMAL(12,2) DEFAULT 0,
  allowances DECIMAL(12,2) DEFAULT 0,
  deductions DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) DEFAULT 0,
  status payroll_status DEFAULT 'pending',
  paid_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, month, year)
);

-- ---------- NOTICES ----------
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  target_audience notice_audience DEFAULT 'all',
  target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  target_role user_role,
  posted_by TEXT,
  date TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- SCHOOL_EVENTS ----------
CREATE TABLE IF NOT EXISTS school_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  type event_type DEFAULT 'event',
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- CERTIFICATES ----------
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type certificate_type NOT NULL,
  issue_date TEXT,
  issued_by TEXT,
  content TEXT,
  serial_number TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_staff_school ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_sa_student_date ON student_attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id);
CREATE INDEX IF NOT EXISTS idx_notices_school ON notices(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class_section ON timetable_slots(class_id, section_id);

-- ============================================================================
-- 5. TRIGGERS — auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_schools_updated ON schools;
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_staff_updated ON staff;
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_students_updated ON students;
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 6. TRIGGER — auto-create profile when user signs up via Supabase Auth
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's school_id
CREATE OR REPLACE FUNCTION get_current_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('super_admin', 'school_admin') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: current user's student_id
CREATE OR REPLACE FUNCTION get_current_student_id()
RETURNS UUID AS $$
  SELECT student_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: current user's staff_id
CREATE OR REPLACE FUNCTION get_current_staff_id()
RETURNS UUID AS $$
  SELECT staff_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- SCHOOLS ----
-- Super admin sees all; others see their own school
CREATE POLICY schools_select ON schools FOR SELECT USING (
  get_current_role() = 'super_admin' OR id = get_current_school_id()
);
CREATE POLICY schools_insert ON schools FOR INSERT WITH CHECK (get_current_role() = 'super_admin');
CREATE POLICY schools_update ON schools FOR UPDATE USING (get_current_role() = 'super_admin');
CREATE POLICY schools_delete ON schools FOR DELETE USING (get_current_role() = 'super_admin');

-- ---- PROFILES ----
-- Users can see their own profile; admins see all in their school
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid() OR is_admin() AND school_id = get_current_school_id()
);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (is_admin() OR id = auth.uid());
CREATE POLICY profiles_delete ON profiles FOR DELETE USING (is_admin());

-- ---- GENERIC POLICY TEMPLATE for school-scoped tables ----
-- (applied to all tables that have school_id column)

-- CLASSES
CREATE POLICY classes_select ON classes FOR SELECT USING (school_id = get_current_school_id() OR is_admin());
CREATE POLICY classes_insert ON classes FOR INSERT WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY classes_update ON classes FOR UPDATE USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY classes_delete ON classes FOR DELETE USING (is_admin() AND school_id = get_current_school_id());

-- SUBJECTS
CREATE POLICY subjects_select ON subjects FOR SELECT USING (school_id = get_current_school_id() OR is_admin());
CREATE POLICY subjects_insert ON subjects FOR INSERT WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY subjects_update ON subjects FOR UPDATE USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY subjects_delete ON subjects FOR DELETE USING (is_admin() AND school_id = get_current_school_id());

-- STAFF
CREATE POLICY staff_select ON staff FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY staff_insert ON staff FOR INSERT WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY staff_update ON staff FOR UPDATE USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY staff_delete ON staff FOR DELETE USING (is_admin() AND school_id = get_current_school_id());

-- STUDENTS
CREATE POLICY students_select ON students FOR SELECT USING (
  school_id = get_current_school_id()
  OR id = get_current_student_id()  -- student sees own record
);
CREATE POLICY students_insert ON students FOR INSERT WITH CHECK (
  (is_admin() OR get_current_role() = 'accountant') AND school_id = get_current_school_id()
);
CREATE POLICY students_update ON students FOR UPDATE USING (
  (is_admin() OR get_current_role() = 'accountant') AND school_id = get_current_school_id()
);
CREATE POLICY students_delete ON students FOR DELETE USING (is_admin() AND school_id = get_current_school_id());

-- STUDENT_ATTENDANCE
CREATE POLICY sa_select ON student_attendance FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id())
  OR student_id = get_current_student_id()
);
CREATE POLICY sa_insert ON student_attendance FOR INSERT WITH CHECK (
  get_current_role() IN ('teacher', 'school_admin', 'super_admin', 'hr')
  AND student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id())
);
CREATE POLICY sa_update ON student_attendance FOR UPDATE USING (
  get_current_role() IN ('teacher', 'school_admin', 'super_admin', 'hr')
);

-- STAFF_ATTENDANCE
CREATE POLICY sta_select ON staff_attendance FOR SELECT USING (
  staff_id IN (SELECT id FROM staff WHERE school_id = get_current_school_id())
);
CREATE POLICY sta_insert ON staff_attendance FOR INSERT WITH CHECK (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);
CREATE POLICY sta_update ON staff_attendance FOR UPDATE USING (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);

-- TIMETABLE_SLOTS (via class → school)
CREATE POLICY ts_select ON timetable_slots FOR SELECT USING (
  class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id())
);
CREATE POLICY ts_insert ON timetable_slots FOR INSERT WITH CHECK (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
  AND class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id())
);
CREATE POLICY ts_update ON timetable_slots FOR UPDATE USING (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);
CREATE POLICY ts_delete ON timetable_slots FOR DELETE USING (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);

-- EXAMS
CREATE POLICY exams_select ON exams FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY exams_insert ON exams FOR INSERT WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY exams_update ON exams FOR UPDATE USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY exams_delete ON exams FOR DELETE USING (is_admin() AND school_id = get_current_school_id());

-- EXAM_RESULTS
CREATE POLICY er_select ON exam_results FOR SELECT USING (
  exam_id IN (SELECT id FROM exams WHERE school_id = get_current_school_id())
  OR student_id = get_current_student_id()
);
CREATE POLICY er_insert ON exam_results FOR INSERT WITH CHECK (
  get_current_role() IN ('teacher', 'school_admin', 'super_admin')
);
CREATE POLICY er_update ON exam_results FOR UPDATE USING (
  get_current_role() IN ('teacher', 'school_admin', 'super_admin')
);
CREATE POLICY er_delete ON exam_results FOR DELETE USING (is_admin());

-- HOMEWORK
CREATE POLICY hw_select ON homework FOR SELECT USING (
  school_id = get_current_school_id()
);
CREATE POLICY hw_insert ON homework FOR INSERT WITH CHECK (
  get_current_role() IN ('teacher', 'school_admin', 'super_admin')
  AND school_id = get_current_school_id()
);
CREATE POLICY hw_update ON homework FOR UPDATE USING (
  get_current_role() IN ('teacher', 'school_admin', 'super_admin')
);
CREATE POLICY hw_delete ON homework FOR DELETE USING (is_admin());

-- FEE_STRUCTURES
CREATE POLICY fs_select ON fee_structures FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY fs_insert ON fee_structures FOR INSERT WITH CHECK (
  (is_admin() OR get_current_role() = 'accountant') AND school_id = get_current_school_id()
);
CREATE POLICY fs_update ON fee_structures FOR UPDATE USING (
  is_admin() OR get_current_role() = 'accountant'
);
CREATE POLICY fs_delete ON fee_structures FOR DELETE USING (is_admin());

-- FEE_ITEMS (via fee_structure → school)
CREATE POLICY fi_select ON fee_items FOR SELECT USING (
  fee_structure_id IN (SELECT id FROM fee_structures WHERE school_id = get_current_school_id())
);
CREATE POLICY fi_insert ON fee_items FOR INSERT WITH CHECK (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fi_update ON fee_items FOR UPDATE USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fi_delete ON fee_items FOR DELETE USING (is_admin());

-- STUDENT_FEES
CREATE POLICY sf_select ON student_fees FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id())
  OR student_id = get_current_student_id()
);
CREATE POLICY sf_insert ON student_fees FOR INSERT WITH CHECK (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY sf_update ON student_fees FOR UPDATE USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY sf_delete ON student_fees FOR DELETE USING (is_admin());

-- FEE_PAYMENTS (via student_fee → student → school)
CREATE POLICY fp_select ON fee_payments FOR SELECT USING (
  student_fee_id IN (
    SELECT sf.id FROM student_fees sf
    JOIN students s ON sf.student_id = s.id
    WHERE s.school_id = get_current_school_id()
  )
);
CREATE POLICY fp_insert ON fee_payments FOR INSERT WITH CHECK (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fp_update ON fee_payments FOR UPDATE USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fp_delete ON fee_payments FOR DELETE USING (is_admin());

-- LIBRARY_BOOKS
CREATE POLICY lb_select ON library_books FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY lb_insert ON library_books FOR INSERT WITH CHECK (
  (is_admin() OR get_current_role() = 'librarian') AND school_id = get_current_school_id()
);
CREATE POLICY lb_update ON library_books FOR UPDATE USING (is_admin() OR get_current_role() = 'librarian');
CREATE POLICY lb_delete ON library_books FOR DELETE USING (is_admin());

-- BOOK_ISSUES
CREATE POLICY bi_select ON book_issues FOR SELECT USING (
  book_id IN (SELECT id FROM library_books WHERE school_id = get_current_school_id())
);
CREATE POLICY bi_insert ON book_issues FOR INSERT WITH CHECK (is_admin() OR get_current_role() = 'librarian');
CREATE POLICY bi_update ON book_issues FOR UPDATE USING (is_admin() OR get_current_role() = 'librarian');
CREATE POLICY bi_delete ON book_issues FOR DELETE USING (is_admin());

-- TRANSPORT_ROUTES
CREATE POLICY tr_select ON transport_routes FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY tr_insert ON transport_routes FOR INSERT WITH CHECK (
  (is_admin() OR get_current_role() = 'transport_manager') AND school_id = get_current_school_id()
);
CREATE POLICY tr_update ON transport_routes FOR UPDATE USING (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY tr_delete ON transport_routes FOR DELETE USING (is_admin());

-- VEHICLES
CREATE POLICY veh_select ON vehicles FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY veh_insert ON vehicles FOR INSERT WITH CHECK (
  (is_admin() OR get_current_role() = 'transport_manager') AND school_id = get_current_school_id()
);
CREATE POLICY veh_update ON vehicles FOR UPDATE USING (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY veh_delete ON vehicles FOR DELETE USING (is_admin());

-- STUDENT_TRANSPORT
CREATE POLICY st_select ON student_transport FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id())
  OR student_id = get_current_student_id()
);
CREATE POLICY st_insert ON student_transport FOR INSERT WITH CHECK (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY st_update ON student_transport FOR UPDATE USING (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY st_delete ON student_transport FOR DELETE USING (is_admin());

-- STAFF_LEAVES
CREATE POLICY sl_select ON staff_leaves FOR SELECT USING (
  staff_id IN (SELECT id FROM staff WHERE school_id = get_current_school_id())
  OR staff_id = get_current_staff_id()
);
CREATE POLICY sl_insert ON staff_leaves FOR INSERT WITH CHECK (
  get_current_role() IN ('school_admin', 'super_admin', 'teacher', 'hr')
);
CREATE POLICY sl_update ON staff_leaves FOR UPDATE USING (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);
CREATE POLICY sl_delete ON staff_leaves FOR DELETE USING (is_admin());

-- PAYROLLS
CREATE POLICY pay_select ON payrolls FOR SELECT USING (
  staff_id IN (SELECT id FROM staff WHERE school_id = get_current_school_id())
  OR staff_id = get_current_staff_id()
);
CREATE POLICY pay_insert ON payrolls FOR INSERT WITH CHECK (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);
CREATE POLICY pay_update ON payrolls FOR UPDATE USING (
  get_current_role() IN ('school_admin', 'super_admin', 'hr')
);
CREATE POLICY pay_delete ON payrolls FOR DELETE USING (is_admin());

-- NOTICES
CREATE POLICY notices_select ON notices FOR SELECT USING (
  school_id = get_current_school_id()
  AND (
    target_audience = 'all'
    OR (target_audience = 'class' AND target_class_id IN (
      SELECT class_id FROM students WHERE id = get_current_student_id()
    ))
    OR (target_audience = 'role' AND target_role = get_current_role())
    OR is_admin()
  )
);
CREATE POLICY notices_insert ON notices FOR INSERT WITH CHECK (
  get_current_role() IN ('school_admin', 'super_admin', 'teacher')
  AND school_id = get_current_school_id()
);
CREATE POLICY notices_update ON notices FOR UPDATE USING (
  get_current_role() IN ('school_admin', 'super_admin', 'teacher')
);
CREATE POLICY notices_delete ON notices FOR DELETE USING (is_admin());

-- SCHOOL_EVENTS
CREATE POLICY events_select ON school_events FOR SELECT USING (school_id = get_current_school_id());
CREATE POLICY events_insert ON school_events FOR INSERT WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY events_update ON school_events FOR UPDATE USING (is_admin());
CREATE POLICY events_delete ON school_events FOR DELETE USING (is_admin());

-- CERTIFICATES
CREATE POLICY cert_select ON certificates FOR SELECT USING (
  school_id = get_current_school_id()
  OR student_id = get_current_student_id()
);
CREATE POLICY cert_insert ON certificates FOR INSERT WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY cert_delete ON certificates FOR DELETE USING (is_admin());

-- SECTIONS (via class → school)
CREATE POLICY sections_select ON sections FOR SELECT USING (
  class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id())
);
CREATE POLICY sections_insert ON sections FOR INSERT WITH CHECK (is_admin());
CREATE POLICY sections_update ON sections FOR UPDATE USING (is_admin());
CREATE POLICY sections_delete ON sections FOR DELETE USING (is_admin());

-- CLASS_SUBJECTS (via class/subject → school)
CREATE POLICY cs_select ON class_subjects FOR SELECT USING (
  class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id())
);
CREATE POLICY cs_insert ON class_subjects FOR INSERT WITH CHECK (is_admin());
CREATE POLICY cs_delete ON class_subjects FOR DELETE USING (is_admin());

-- ============================================================================
-- 8. STORAGE BUCKETS
-- ============================================================================
-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES
  ('student-photos', 'student-photos', true),
  ('staff-photos', 'staff-photos', true),
  ('book-covers', 'book-covers', true),
  ('homework-attachments', 'homework-attachments', true),
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can read public buckets, admins can write
CREATE POLICY "Public read student-photos" ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
CREATE POLICY "Admin write student-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos' AND is_admin());
CREATE POLICY "Admin update student-photos" ON storage.objects FOR UPDATE USING (bucket_id = 'student-photos' AND is_admin());

CREATE POLICY "Public read staff-photos" ON storage.objects FOR SELECT USING (bucket_id = 'staff-photos');
CREATE POLICY "Admin write staff-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'staff-photos' AND is_admin());

CREATE POLICY "Public read book-covers" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');
CREATE POLICY "Admin write book-covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'book-covers' AND is_admin());

CREATE POLICY "Auth read homework-attachments" ON storage.objects FOR SELECT USING (bucket_id = 'homework-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Teacher write homework-attachments" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'homework-attachments' AND get_current_role() IN ('teacher', 'school_admin', 'super_admin')
);

CREATE POLICY "Auth read documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admin write documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND is_admin());

-- ============================================================================
-- 9. SEED DATA — School + Classes + Subjects + Staff + Students + Demo Data
-- ============================================================================

-- ---------- SCHOOL ----------
INSERT INTO schools (id, name, address, phone, email, established_date)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Greenwood International School',
  '123 Education Lane, Knowledge Park, New Delhi - 110001',
  '+91 98765 43210',
  'info@greenwood.edu',
  '1998-06-15'
)
ON CONFLICT (id) DO NOTHING;

-- ---------- CLASSES ----------
INSERT INTO classes (id, name, "order", school_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Nursery', 1, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'LKG', 2, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'UKG', 3, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'Class 1', 4, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'Class 2', 5, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000006', 'Class 3', 6, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000007', 'Class 4', 7, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000008', 'Class 5', 8, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000009', 'Class 6', 9, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000a', 'Class 7', 10, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000b', 'Class 8', 11, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000c', 'Class 9', 12, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000d', 'Class 10', 13, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000e', 'Class 11', 14, '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000f', 'Class 12', 15, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- SECTIONS (A, B for each class) ----------
-- Using a DO block to generate sections for all classes
DO $$
DECLARE
  cls RECORD;
  sec_char CHAR(1);
  sec_order INT;
BEGIN
  FOR cls IN SELECT id FROM classes WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    FOR sec_order IN 1..2 LOOP
      sec_char := CHR(64 + sec_order); -- 'A' or 'B'
      INSERT INTO sections (class_id, name)
      VALUES (cls.id, sec_char)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------- SUBJECTS ----------
INSERT INTO subjects (id, name, code, school_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'English', 'ENG', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Mathematics', 'MATH', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'Science', 'SCI', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000004', 'Social Studies', 'SST', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000005', 'Hindi', 'HIN', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000006', 'Computer Science', 'CS', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000007', 'Physics', 'PHY', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000008', 'Chemistry', 'CHEM', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000009', 'Biology', 'BIO', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000a', 'Physical Education', 'PE', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000b', 'Art', 'ART', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000c', 'Music', 'MUS', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- STAFF ----------
INSERT INTO staff (id, employee_id, first_name, last_name, email, phone, designation, department, type, salary, school_id, status, qualification, joining_date) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'EMP0001', 'Rajesh', 'Kumar', 'rajesh.kumar@greenwood.edu', '+91 9800000011', 'Principal', 'Administration', 'non_teaching', 120000, '00000000-0000-0000-0000-000000000001', 'active', 'M.Ed, B.Ed', '2010-06-15'),
  ('c0000000-0000-0000-0000-000000000002', 'EMP0002', 'Priya', 'Sharma', 'priya.sharma@greenwood.edu', '+91 9800000022', 'Vice Principal', 'Administration', 'non_teaching', 90000, '00000000-0000-0000-0000-000000000001', 'active', 'M.Ed', '2011-07-01'),
  ('c0000000-0000-0000-0000-000000000003', 'EMP0003', 'Anita', 'Verma', 'anita.verma@greenwood.edu', '+91 9800000033', 'Senior Teacher', 'Mathematics', 'teaching', 55000, '00000000-0000-0000-0000-000000000001', 'active', 'M.Sc, B.Ed', '2012-03-15'),
  ('c0000000-0000-0000-0000-000000000004', 'EMP0004', 'Suresh', 'Patel', 'suresh.patel@greenwood.edu', '+91 9800000044', 'Teacher', 'Science', 'teaching', 48000, '00000000-0000-0000-0000-000000000001', 'active', 'M.Sc, B.Ed', '2013-06-20'),
  ('c0000000-0000-0000-0000-000000000005', 'EMP0005', 'Meena', 'Reddy', 'meena.reddy@greenwood.edu', '+91 9800000055', 'Teacher', 'English', 'teaching', 50000, '00000000-0000-0000-0000-000000000001', 'active', 'M.A, B.Ed', '2014-07-10'),
  ('c0000000-0000-0000-0000-000000000006', 'EMP0006', 'Vikram', 'Singh', 'vikram.singh@greenwood.edu', '+91 9800000066', 'Teacher', 'Social Studies', 'teaching', 47000, '00000000-0000-0000-0000-000000000001', 'active', 'M.A, B.Ed', '2015-06-01'),
  ('c0000000-0000-0000-0000-000000000007', 'EMP0007', 'Kavita', 'Nair', 'kavita.nair@greenwood.edu', '+91 9800000077', 'Teacher', 'Hindi', 'teaching', 45000, '00000000-0000-0000-0000-000000000001', 'active', 'M.A, B.Ed', '2016-07-15'),
  ('c0000000-0000-0000-0000-000000000008', 'EMP0008', 'Arun', 'Gupta', 'arun.gupta@greenwood.edu', '+91 9800000088', 'Teacher', 'Computer Science', 'teaching', 52000, '00000000-0000-0000-0000-000000000001', 'active', 'MCA, B.Ed', '2017-06-10'),
  ('c0000000-0000-0000-0000-000000000009', 'EMP0009', 'Deepak', 'Mehta', 'deepak.mehta@greenwood.edu', '+91 9800000099', 'Accountant', 'Finance', 'non_teaching', 40000, '00000000-0000-0000-0000-000000000001', 'active', 'B.Com', '2018-04-01'),
  ('c0000000-0000-0000-0000-00000000000a', 'EMP0010', 'Lakshmi', 'Iyer', 'lakshmi.iyer@greenwood.edu', '+91 9800000100', 'Librarian', 'Library', 'non_teaching', 38000, '00000000-0000-0000-0000-000000000001', 'active', 'MLIS', '2019-06-15'),
  ('c0000000-0000-0000-0000-00000000000b', 'EMP0011', 'Ramesh', 'Yadav', 'ramesh.yadav@greenwood.edu', '+91 9800000111', 'Transport Manager', 'Transport', 'non_teaching', 42000, '00000000-0000-0000-0000-000000000001', 'active', 'BBA', '2020-03-01'),
  ('c0000000-0000-0000-0000-00000000000c', 'EMP0012', 'Sunita', 'Joshi', 'sunita.joshi@greenwood.edu', '+91 9800000122', 'HR Manager', 'Human Resources', 'non_teaching', 46000, '00000000-0000-0000-0000-000000000001', 'active', 'MBA HR', '2021-06-01')
ON CONFLICT (id) DO NOTHING;

-- ---------- CLASS SUBJECTS (assign first 6 subjects to each class) ----------
DO $$
DECLARE
  cls RECORD;
  subj RECORD;
  subj_order INT;
BEGIN
  FOR cls IN SELECT id FROM classes WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    subj_order := 0;
    FOR subj IN SELECT id FROM subjects WHERE school_id = '00000000-0000-0000-0000-000000000001' ORDER BY code LIMIT 6 LOOP
      subj_order := subj_order + 1;
      INSERT INTO class_subjects (class_id, subject_id) VALUES (cls.id, subj.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------- STUDENTS (10 demo students) ----------
INSERT INTO students (id, admission_number, roll_number, first_name, last_name, email, phone, dob, gender, blood_group, address, class_id, section_id, status, school_id, father_name, mother_name, parent_phone, parent_email, admission_date) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'GRW1001', '1', 'Aarav', 'Sharma', 'aarav.sharma@student.greenwood.edu', '+91 9900000001', '2015-05-10', 'male', 'A+', '101, Sector 5, New Delhi', 'a0000000-0000-0000-0000-000000000004', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000004' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Sharma', 'Mrs. Sharma', '+91 9900000011', 'parent.aarav@gmail.com', '2021-06-15'),
  ('d0000000-0000-0000-0000-000000000002', 'GRW1002', '2', 'Diya', 'Das', 'diya.das@student.greenwood.edu', '+91 9900000002', '2015-08-22', 'female', 'B+', '202, Sector 8, New Delhi', 'a0000000-0000-0000-0000-000000000004', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000004' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Das', 'Mrs. Das', '+91 9900000022', 'parent.diya@gmail.com', '2021-06-15'),
  ('d0000000-0000-0000-0000-000000000003', 'GRW1003', '3', 'Vivaan', 'Kumar', 'vivaan.kumar@student.greenwood.edu', '+91 9900000003', '2015-03-15', 'male', 'O+', '303, Sector 12, New Delhi', 'a0000000-0000-0000-0000-000000000004', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000004' AND name='B' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Kumar', 'Mrs. Kumar', '+91 9900000033', 'parent.vivaan@gmail.com', '2021-07-01'),
  ('d0000000-0000-0000-0000-000000000004', 'GRW1004', '4', 'Ananya', 'Gupta', 'ananya.gupta@student.greenwood.edu', '+91 9900000004', '2015-11-30', 'female', 'AB+', '404, Sector 3, New Delhi', 'a0000000-0000-0000-0000-000000000005', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000005' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Gupta', 'Mrs. Gupta', '+91 9900000044', 'parent.ananya@gmail.com', '2021-07-01'),
  ('d0000000-0000-0000-0000-000000000005', 'GRW1005', '5', 'Aditya', 'Singh', 'aditya.singh@student.greenwood.edu', '+91 9900000005', '2014-09-18', 'male', 'A-', '505, Sector 7, New Delhi', 'a0000000-0000-0000-0000-000000000006', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000006' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Singh', 'Mrs. Singh', '+91 9900000055', 'parent.aditya@gmail.com', '2021-07-15'),
  ('d0000000-0000-0000-0000-000000000006', 'GRW1006', '6', 'Saanvi', 'Patel', 'saanvi.patel@student.greenwood.edu', '+91 9900000006', '2014-02-25', 'female', 'B-', '606, Sector 9, New Delhi', 'a0000000-0000-0000-0000-000000000007', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000007' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Patel', 'Mrs. Patel', '+91 9900000066', 'parent.saanvi@gmail.com', '2021-07-15'),
  ('d0000000-0000-0000-0000-000000000007', 'GRW1007', '7', 'Arjun', 'Reddy', 'arjun.reddy@student.greenwood.edu', '+91 9900000007', '2013-07-12', 'male', 'O-', '707, Sector 11, New Delhi', 'a0000000-0000-0000-0000-000000000008', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000008' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Reddy', 'Mrs. Reddy', '+91 9900000077', 'parent.arjun@gmail.com', '2021-08-01'),
  ('d0000000-0000-0000-0000-000000000008', 'GRW1008', '8', 'Myra', 'Nair', 'myra.nair@student.greenwood.edu', '+91 9900000008', '2013-12-05', 'female', 'A+', '808, Sector 15, New Delhi', 'a0000000-0000-0000-0000-000000000009', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-000000000009' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Nair', 'Mrs. Nair', '+91 9900000088', 'parent.myra@gmail.com', '2021-08-01'),
  ('d0000000-0000-0000-0000-000000000009', 'GRW1009', '9', 'Krishna', 'Joshi', 'krishna.joshi@student.greenwood.edu', '+91 9900000009', '2012-04-20', 'male', 'B+', '909, Sector 18, New Delhi', 'a0000000-0000-0000-0000-00000000000c', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000c' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Joshi', 'Mrs. Joshi', '+91 9900000099', 'parent.krishna@gmail.com', '2021-08-15'),
  ('d0000000-0000-0000-0000-00000000000a', 'GRW1010', '10', 'Ira', 'Mehta', 'ira.mehta@student.greenwood.edu', '+91 9900000010', '2012-10-08', 'female', 'AB+', '110, Sector 22, New Delhi', 'a0000000-0000-0000-0000-00000000000d', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000d' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Mehta', 'Mrs. Mehta', '+91 9900000100', 'parent.ira@gmail.com', '2021-08-15')
ON CONFLICT (id) DO NOTHING;

-- ---------- ATTENDANCE (last 7 days for first 5 students) ----------
DO $$
DECLARE
  d_offset INT;
  d_date TEXT;
  stu RECORD;
  statuses TEXT[] := ARRAY['present','present','present','present','absent','late','leave'];
  rand_idx INT;
BEGIN
  FOR d_offset IN 0..6 LOOP
    d_date := to_char(current_date - d_offset, 'YYYY-MM-DD');
    FOR stu IN SELECT id FROM students WHERE school_id='00000000-0000-0000-0000-000000000001' LOOP
      rand_idx := (random() * 6 + 1)::INT;
      INSERT INTO student_attendance (student_id, date, status, marked_by)
      VALUES (stu.id, d_date, statuses[rand_idx]::attendance_status, 'system')
      ON CONFLICT (student_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------- FEE STRUCTURES (one per class) ----------
DO $$
DECLARE
  cls RECORD;
  total_amt DECIMAL;
BEGIN
  FOR cls IN SELECT id, name FROM classes WHERE school_id='00000000-0000-0000-0000-000000000001' LOOP
    total_amt := 45000 + (cls.name LIKE 'Class%' AND cls.name ~ '[0-9]+' AND substring(cls.name FROM '[0-9]+')::INT * 1000);
    IF total_amt = 45000 THEN total_amt := 45000; END IF;
    INSERT INTO fee_structures (name, class_id, school_id, term, total_amount, due_date)
    VALUES (cls.name || ' - Annual Fee 2024-25', cls.id, '00000000-0000-0000-0000-000000000001', 'Annual', total_amt, '2024-12-31')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ---------- STUDENT FEES (assign to all students) ----------
DO $$
DECLARE
  stu RECORD;
  fs RECORD;
  paid_amt DECIMAL;
  due_amt DECIMAL;
  fee_status_val fee_status;
BEGIN
  FOR stu IN SELECT id, class_id FROM students WHERE school_id='00000000-0000-0000-0000-000000000001' LOOP
    SELECT * INTO fs FROM fee_structures WHERE class_id = stu.class_id LIMIT 1;
    IF FOUND THEN
      paid_amt := CASE WHEN random() > 0.5 THEN fs.total_amount ELSE fs.total_amount * 0.5 END;
      due_amt := fs.total_amount - paid_amt;
      fee_status_val := CASE WHEN due_amt = 0 THEN 'paid'::fee_status WHEN paid_amt > 0 THEN 'partial'::fee_status ELSE 'pending'::fee_status END;
      INSERT INTO student_fees (student_id, fee_structure_id, total_amount, paid_amount, due_amount, due_date, status)
      VALUES (stu.id, fs.id, fs.total_amount, paid_amt, due_amt, fs.due_date, fee_status_val)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ---------- LIBRARY BOOKS ----------
INSERT INTO library_books (title, author, isbn, category, publisher, total_copies, available_copies, shelf_location, school_id) VALUES
  ('The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Fiction', 'Scribner', 5, 3, 'A-12', '00000000-0000-0000-0000-000000000001'),
  ('To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Fiction', 'HarperCollins', 4, 2, 'A-15', '00000000-0000-0000-0000-000000000001'),
  ('A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Science', 'Bantam', 3, 3, 'B-08', '00000000-0000-0000-0000-000000000001'),
  ('Wings of Fire', 'A.P.J. Abdul Kalam', '9788173711466', 'Biography', 'Universities Press', 6, 5, 'C-03', '00000000-0000-0000-0000-000000000001'),
  ('The Alchemist', 'Paulo Coelho', '9780061122415', 'Fiction', 'HarperOne', 4, 3, 'A-20', '00000000-0000-0000-0000-000000000001'),
  ('Mathematics for Class 10', 'R.D. Sharma', '9789388700001', 'Textbook', 'Dhanpat Rai', 10, 8, 'D-05', '00000000-0000-0000-0000-000000000001'),
  ('Physics Principles', 'H.C. Verma', '9788177091874', 'Textbook', 'Bharati Bhawan', 8, 6, 'D-10', '00000000-0000-0000-0000-000000000001'),
  ('Indian History', 'Bipin Chandra', '9788125036842', 'History', 'Orient Blackswan', 3, 2, 'E-02', '00000000-0000-0000-0000-000000000001'),
  ('Programming in Python', 'Mark Lutz', '9781449355739', 'Technology', "O'Reilly", 4, 4, 'F-01', '00000000-0000-0000-0000-000000000001'),
  ('Organic Chemistry', 'Morrison Boyd', '9788131705099', 'Science', 'Pearson', 3, 2, 'B-15', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- TRANSPORT ROUTES ----------
INSERT INTO transport_routes (name, stops, fare, school_id) VALUES
  ('Route 1 - North Delhi', 'Rohini,Pitampura,Model Town', 1500, '00000000-0000-0000-0000-000000000001'),
  ('Route 2 - South Delhi', 'Saket,Malviya Nagar,Pushp Vihar', 1800, '00000000-0000-0000-0000-000000000001'),
  ('Route 3 - East Delhi', 'Preet Vihar,Vikas Marg,Mayur Vihar', 1600, '00000000-0000-0000-0000-000000000001'),
  ('Route 4 - West Delhi', 'Janakpuri,Rajouri Garden,Punjabi Bagh', 1700, '00000000-0000-0000-0000-000000000001'),
  ('Route 5 - Noida', 'Sector 18,Sector 62,Atta Market', 2000, '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ---------- VEHICLES ----------
INSERT INTO vehicles (bus_number, driver_name, driver_phone, capacity, route_id, school_id) VALUES
  ('DL01B1001', 'Driver Ramesh', '+91 9911111111', 40, (SELECT id FROM transport_routes WHERE name LIKE 'Route 1%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1002', 'Driver Suresh', '+91 9922222222', 40, (SELECT id FROM transport_routes WHERE name LIKE 'Route 2%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1003', 'Driver Mahesh', '+91 9933333333', 35, (SELECT id FROM transport_routes WHERE name LIKE 'Route 3%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1004', 'Driver Ganesh', '+91 9944444444', 40, (SELECT id FROM transport_routes WHERE name LIKE 'Route 4%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1005', 'Driver Dinesh', '+91 9955555555', 45, (SELECT id FROM transport_routes WHERE name LIKE 'Route 5%' LIMIT 1), '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ---------- NOTICES ----------
INSERT INTO notices (title, content, target_audience, posted_by, date, school_id) VALUES
  ('Annual Day Celebration', 'The school''s Annual Day will be celebrated on 25th December. All students must participate.', 'all', 'Rajesh Kumar', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Parent-Teacher Meeting', 'PTM scheduled for this Saturday from 9 AM to 12 PM.', 'all', 'Rajesh Kumar', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Fee Payment Reminder', 'Parents are reminded that the last date for fee payment is 31st December.', 'all', 'Deepak Mehta', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Diwali Holiday', 'School will remain closed for Diwali. Classes resume after break.', 'all', 'Rajesh Kumar', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Science Exhibition', 'Annual Science Exhibition on 20th November. Submit project ideas by 10th.', 'all', 'Suresh Patel', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ---------- EVENTS ----------
INSERT INTO school_events (title, description, date, end_date, type, school_id) VALUES
  ('Annual Day', 'Annual cultural function and prize distribution', '2024-12-25', NULL, 'function', '00000000-0000-0000-0000-000000000001'),
  ('Diwali Break', 'Diwali holidays', '2024-11-10', '2024-11-15', 'holiday', '00000000-0000-0000-0000-000000000001'),
  ('Mid-Term Exam', 'Mid-term examinations for all classes', '2024-09-15', '2024-09-25', 'exam', '00000000-0000-0000-0000-000000000001'),
  ('PTM', 'Parent-Teacher Meeting for Class 10', '2024-11-30', NULL, 'ptm', '00000000-0000-0000-0000-000000000001'),
  ('Sports Day', 'Annual sports day with various athletic events', '2024-11-05', NULL, 'function', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ---------- EXAM ----------
INSERT INTO exams (name, type, school_id, class_id, start_date, end_date, max_marks)
VALUES ('Mid-Term Examination 2024', 'mid_term', '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000d', '2024-09-15', '2024-09-25', 100)
ON CONFLICT DO NOTHING;

-- ---------- EXAM RESULTS (for Class 10 students, 5 subjects) ----------
DO $$
DECLARE
  stu RECORD;
  subj RECORD;
  marks INT;
  grade_val TEXT;
BEGIN
  FOR stu IN SELECT id FROM students WHERE class_id = 'a0000000-0000-0000-0000-00000000000d' LOOP
    FOR subj IN SELECT id FROM subjects WHERE school_id='00000000-0000-0000-0000-000000000001' ORDER BY code LIMIT 5 LOOP
      marks := 55 + (random() * 45)::INT;
      grade_val := CASE WHEN marks >= 90 THEN 'A+' WHEN marks >= 80 THEN 'A' WHEN marks >= 70 THEN 'B+' WHEN marks >= 60 THEN 'B' WHEN marks >= 50 THEN 'C' ELSE 'D' END;
      INSERT INTO exam_results (exam_id, student_id, subject_id, marks_obtained, max_marks, grade)
      VALUES ((SELECT id FROM exams WHERE name='Mid-Term Examination 2024' LIMIT 1), stu.id, subj.id, marks, 100, grade_val)
      ON CONFLICT (exam_id, student_id, subject_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------- HOMEWORK ----------
INSERT INTO homework (class_id, section_id, subject_id, staff_id, title, description, due_date, school_id) VALUES
  ('a0000000-0000-0000-0000-00000000000d', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000d' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'Algebra - Quadratic Equations', 'Solve exercises 4.1 to 4.5 from textbook.', to_char(current_date + 7, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000c', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000c' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Essay - My Favorite Book', 'Write a 500-word essay on your favorite book.', to_char(current_date + 5, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000b', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000b' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'Science Project - Photosynthesis', 'Create a diagram showing the process of photosynthesis.', to_char(current_date + 10, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000d', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000d' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006', 'History - Independence Movement', 'Research 3 key events in India''s independence movement.', to_char(current_date + 7, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000a', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000a' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000007', 'Hindi - Kabir ke Dohe', 'Memorize 5 dohe by Kabir and write their meaning.', to_char(current_date + 4, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ---------- STAFF LEAVES ----------
INSERT INTO staff_leaves (staff_id, from_date, to_date, reason, type, status, approved_by) VALUES
  ('c0000000-0000-0000-0000-000000000003', '2024-11-01', '2024-11-03', 'Medical leave', 'sick', 'approved', 'Rajesh Kumar'),
  ('c0000000-0000-0000-0000-000000000004', '2024-11-10', '2024-11-12', 'Personal work', 'casual', 'approved', 'Rajesh Kumar'),
  ('c0000000-0000-0000-0000-000000000005', '2024-11-15', '2024-11-16', 'Family function', 'casual', 'pending', NULL),
  ('c0000000-0000-0000-0000-000000000006', '2024-11-20', '2024-11-22', 'Not well', 'sick', 'pending', NULL),
  ('c0000000-0000-0000-0000-000000000007', '2024-11-25', '2024-11-26', 'Personal', 'casual', 'rejected', 'Rajesh Kumar')
ON CONFLICT DO NOTHING;

-- ---------- PAYROLLS (current month for all staff) ----------
DO $$
DECLARE
  stf RECORD;
  basic DECIMAL;
  allow DECIMAL;
  deduct DECIMAL;
  net DECIMAL;
BEGIN
  FOR stf IN SELECT id, salary FROM staff WHERE school_id='00000000-0000-0000-0000-000000000001' LOOP
    basic := stf.salary;
    allow := basic * 0.20;
    deduct := basic * 0.12;
    net := basic + allow - deduct;
    INSERT INTO payrolls (staff_id, month, year, basic_salary, allowances, deductions, net_salary, status)
    VALUES (stf.id, EXTRACT(MONTH FROM current_date)::INT, EXTRACT(YEAR FROM current_date)::INT, basic, allow, deduct, net, 'pending')
    ON CONFLICT (staff_id, month, year) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 10. FINAL NOTES
-- ============================================================================
-- ✅ All tables created with proper relationships
-- ✅ RLS policies enforce role-based access
-- ✅ Storage buckets ready for file uploads
-- ✅ Triggers auto-create profile on signup
-- ✅ Demo data seeded: 1 school, 15 classes, 30 sections, 12 subjects,
--    12 staff, 10 students, attendance, fees, books, routes, notices, events,
--    exams with results, homework, leaves, payrolls
--
-- NEXT STEPS:
-- 1. Create super admin user in Supabase Auth (Dashboard → Authentication → Users → Add User)
-- 2. Run: UPDATE profiles SET role='super_admin', name='Super Admin' WHERE email='your-email@example.com';
-- 3. Login to the app and manage everything from User Management module!
-- ============================================================================

-- ============================================================================
-- DONE! 
-- ============================================================================
-- After running this:
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
--    (e.g., superadmin@eduflow.com with password)
-- 2. Run: UPDATE profiles SET role='super_admin' WHERE email='superadmin@eduflow.com';
-- 3. Login via the app, go to User Management, add more users.
-- ============================================================================
