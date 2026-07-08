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
-- 9. SEED DATA — Super Admin School + Demo Users
-- ============================================================================
-- Create a default school
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

-- NOTE: To create the Super Admin user, run this AFTER creating the user
-- via Supabase Auth (Dashboard → Authentication → Add User):
--
--   UPDATE profiles
--   SET role = 'super_admin', name = 'Super Admin'
--   WHERE email = 'superadmin@eduflow.com';
--
-- Or create demo users via the app's User Management module after admin login.

-- ============================================================================
-- DONE! 
-- ============================================================================
-- After running this:
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
--    (e.g., superadmin@eduflow.com with password)
-- 2. Run: UPDATE profiles SET role='super_admin' WHERE email='superadmin@eduflow.com';
-- 3. Login via the app, go to User Management, add more users.
-- ============================================================================
