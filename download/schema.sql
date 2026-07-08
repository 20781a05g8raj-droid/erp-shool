-- ============================================================================
-- EduFlow ERP — Complete Supabase Schema
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Supabase Dashboard → SQL Editor → New Query
-- 2. Paste this ENTIRE file
-- 3. Click Run
-- 4. Wait for "Success" message (takes 10-20 seconds)
-- ============================================================================

-- ============================================================================
-- STEP 1: CLEANUP — Remove everything if it already exists
-- ============================================================================
-- This makes the script safe to re-run multiple times.
-- IF EXISTS = don't error if the object doesn't exist yet.

DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS school_events CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS payrolls CASCADE;
DROP TABLE IF EXISTS staff_leaves CASCADE;
DROP TABLE IF EXISTS student_transport CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS transport_routes CASCADE;
DROP TABLE IF EXISTS book_issues CASCADE;
DROP TABLE IF EXISTS library_books CASCADE;
DROP TABLE IF EXISTS fee_payments CASCADE;
DROP TABLE IF EXISTS student_fees CASCADE;
DROP TABLE IF EXISTS fee_items CASCADE;
DROP TABLE IF EXISTS fee_structures CASCADE;
DROP TABLE IF EXISTS homework CASCADE;
DROP TABLE IF EXISTS exam_results CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS timetable_slots CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;
DROP TABLE IF EXISTS student_attendance CASCADE;
DROP TABLE IF EXISTS class_subjects CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS student_status CASCADE;
DROP TYPE IF EXISTS staff_type CASCADE;
DROP TYPE IF EXISTS fee_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS leave_status CASCADE;
DROP TYPE IF EXISTS leave_type CASCADE;
DROP TYPE IF EXISTS exam_type CASCADE;
DROP TYPE IF EXISTS book_issue_status CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS certificate_type CASCADE;
DROP TYPE IF EXISTS notice_audience CASCADE;
DROP TYPE IF EXISTS payroll_status CASCADE;

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_current_school_id() CASCADE;
DROP FUNCTION IF EXISTS get_current_role() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS get_current_student_id() CASCADE;
DROP FUNCTION IF EXISTS get_current_staff_id() CASCADE;

-- Note: triggers on our tables are auto-dropped when we DROP TABLE CASCADE above.
-- Only auth.users trigger needs explicit drop:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Note: Storage buckets CANNOT be deleted via SQL in Supabase.
-- We use INSERT ... ON CONFLICT DO NOTHING later to create them if they don't exist.
-- If you need to delete buckets, use Supabase Dashboard → Storage.

-- ============================================================================
-- STEP 2: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- STEP 3: ENUMS (custom types for type safety)
-- ============================================================================
CREATE TYPE user_role AS ENUM (
  'super_admin', 'school_admin', 'teacher', 'student', 'parent',
  'accountant', 'librarian', 'transport_manager', 'hr'
);

CREATE TYPE student_status AS ENUM ('active', 'alumni', 'transferred', 'suspended');
CREATE TYPE staff_type AS ENUM ('teaching', 'non_teaching');
CREATE TYPE fee_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE payment_method AS ENUM ('cash', 'online', 'cheque');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'leave', 'halfday');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE leave_type AS ENUM ('casual', 'sick', 'earned', 'unpaid');
CREATE TYPE exam_type AS ENUM ('unit_test', 'mid_term', 'final');
CREATE TYPE book_issue_status AS ENUM ('issued', 'returned', 'overdue');
CREATE TYPE event_type AS ENUM ('holiday', 'ptm', 'exam', 'function', 'event');
CREATE TYPE certificate_type AS ENUM ('transfer', 'bonafide', 'character');
CREATE TYPE notice_audience AS ENUM ('all', 'class', 'role');
CREATE TYPE payroll_status AS ENUM ('pending', 'paid');

-- ============================================================================
-- STEP 4: TABLES
-- ============================================================================
-- Order matters: parent tables first, then child tables with foreign keys.

-- 4.1 SCHOOLS (top-level — no dependencies)
CREATE TABLE schools (
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

-- 4.2 PROFILES (linked 1:1 to Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  role user_role NOT NULL DEFAULT 'school_admin',
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  student_id UUID,  -- FK added later (circular dependency with students)
  staff_id UUID,    -- FK added later (circular dependency with staff)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.3 CLASSES
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.4 SECTIONS (class_teacher_id FK added later, after staff table exists)
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  class_teacher_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.5 SUBJECTS
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.6 CLASS_SUBJECTS (junction table)
CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE(class_id, subject_id)
);

-- 4.7 STAFF
CREATE TABLE staff (
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

-- Now add FK: sections.class_teacher_id → staff.id
ALTER TABLE sections
  ADD CONSTRAINT sections_class_teacher_fk
  FOREIGN KEY (class_teacher_id) REFERENCES staff(id) ON DELETE SET NULL;

-- 4.8 STUDENTS
CREATE TABLE students (
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

-- Now add FKs: profiles.student_id → students.id, profiles.staff_id → staff.id
ALTER TABLE profiles
  ADD CONSTRAINT profiles_student_fk
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_staff_fk
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- 4.9 STUDENT_ATTENDANCE
CREATE TABLE student_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status attendance_status DEFAULT 'present',
  marked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)
);

-- 4.10 STAFF_ATTENDANCE
CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'present',
  check_in TEXT,
  check_out TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, date)
);

-- 4.11 TIMETABLE_SLOTS
CREATE TABLE timetable_slots (
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

-- 4.12 EXAMS
CREATE TABLE exams (
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

-- 4.13 EXAM_RESULTS
CREATE TABLE exam_results (
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

-- 4.14 HOMEWORK
CREATE TABLE homework (
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

-- 4.15 FEE_STRUCTURES
CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  due_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.16 FEE_ITEMS
CREATE TABLE fee_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0
);

-- 4.17 STUDENT_FEES
CREATE TABLE student_fees (
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

-- 4.18 FEE_PAYMENTS
CREATE TABLE fee_payments (
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

-- 4.19 LIBRARY_BOOKS
CREATE TABLE library_books (
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

-- 4.20 BOOK_ISSUES
CREATE TABLE book_issues (
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

-- 4.21 TRANSPORT_ROUTES
CREATE TABLE transport_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stops TEXT,
  fare DECIMAL(10,2) DEFAULT 0,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.22 VEHICLES
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  capacity INTEGER DEFAULT 30,
  route_id UUID REFERENCES transport_routes(id) ON DELETE SET NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.23 STUDENT_TRANSPORT
CREATE TABLE student_transport (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  pickup_point TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.24 STAFF_LEAVES
CREATE TABLE staff_leaves (
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

-- 4.25 PAYROLLS
CREATE TABLE payrolls (
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

-- 4.26 NOTICES
CREATE TABLE notices (
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

-- 4.27 SCHOOL_EVENTS
CREATE TABLE school_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  type event_type DEFAULT 'event',
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.28 CERTIFICATES
CREATE TABLE certificates (
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
-- STEP 5: INDEXES (for query performance)
-- ============================================================================
CREATE INDEX idx_profiles_school ON profiles(school_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_staff_school ON staff(school_id);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_subjects_school ON subjects(school_id);
CREATE INDEX idx_sa_student_date ON student_attendance(student_id, date);
CREATE INDEX idx_student_fees_student ON student_fees(student_id);
CREATE INDEX idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX idx_exam_results_student ON exam_results(student_id);
CREATE INDEX idx_homework_class ON homework(class_id);
CREATE INDEX idx_notices_school ON notices(school_id);
CREATE INDEX idx_timetable_class_section ON timetable_slots(class_id, section_id);

-- ============================================================================
-- STEP 6: TRIGGERS
-- ============================================================================

-- Function: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: auto-create profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 7: ROW LEVEL SECURITY (RLS) — Enable on all tables
-- ============================================================================
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

-- ============================================================================
-- STEP 8: HELPER FUNCTIONS (used in RLS policies)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('super_admin', 'school_admin') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_student_id()
RETURNS UUID AS $$
  SELECT student_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_staff_id()
RETURNS UUID AS $$
  SELECT staff_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 9: RLS POLICIES (role-based access control)
-- ============================================================================
-- Each table gets SELECT/INSERT/UPDATE/DELETE policies based on user role.

-- SCHOOLS
CREATE POLICY schools_select ON schools FOR SELECT
  USING (get_current_role() = 'super_admin' OR id = get_current_school_id());
CREATE POLICY schools_insert ON schools FOR INSERT
  WITH CHECK (get_current_role() = 'super_admin');
CREATE POLICY schools_update ON schools FOR UPDATE
  USING (get_current_role() = 'super_admin');
CREATE POLICY schools_delete ON schools FOR DELETE
  USING (get_current_role() = 'super_admin');

-- PROFILES
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR (is_admin() AND school_id = get_current_school_id()));
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (is_admin() OR id = auth.uid());
CREATE POLICY profiles_delete ON profiles FOR DELETE
  USING (is_admin());

-- CLASSES
CREATE POLICY classes_select ON classes FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY classes_insert ON classes FOR INSERT
  WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY classes_update ON classes FOR UPDATE
  USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY classes_delete ON classes FOR DELETE
  USING (is_admin() AND school_id = get_current_school_id());

-- SECTIONS
CREATE POLICY sections_select ON sections FOR SELECT
  USING (class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id()));
CREATE POLICY sections_insert ON sections FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY sections_update ON sections FOR UPDATE
  USING (is_admin());
CREATE POLICY sections_delete ON sections FOR DELETE
  USING (is_admin());

-- SUBJECTS
CREATE POLICY subjects_select ON subjects FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY subjects_insert ON subjects FOR INSERT
  WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY subjects_update ON subjects FOR UPDATE
  USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY subjects_delete ON subjects FOR DELETE
  USING (is_admin() AND school_id = get_current_school_id());

-- CLASS_SUBJECTS
CREATE POLICY cs_select ON class_subjects FOR SELECT
  USING (class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id()));
CREATE POLICY cs_insert ON class_subjects FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY cs_delete ON class_subjects FOR DELETE
  USING (is_admin());

-- STAFF
CREATE POLICY staff_select ON staff FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY staff_insert ON staff FOR INSERT
  WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY staff_update ON staff FOR UPDATE
  USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY staff_delete ON staff FOR DELETE
  USING (is_admin() AND school_id = get_current_school_id());

-- STUDENTS
CREATE POLICY students_select ON students FOR SELECT
  USING (school_id = get_current_school_id() OR id = get_current_student_id());
CREATE POLICY students_insert ON students FOR INSERT
  WITH CHECK ((is_admin() OR get_current_role() = 'accountant') AND school_id = get_current_school_id());
CREATE POLICY students_update ON students FOR UPDATE
  USING ((is_admin() OR get_current_role() = 'accountant') AND school_id = get_current_school_id());
CREATE POLICY students_delete ON students FOR DELETE
  USING (is_admin() AND school_id = get_current_school_id());

-- STUDENT_ATTENDANCE
CREATE POLICY sa_select ON student_attendance FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id()) OR student_id = get_current_student_id());
CREATE POLICY sa_insert ON student_attendance FOR INSERT
  WITH CHECK (get_current_role() IN ('teacher', 'school_admin', 'super_admin', 'hr') AND student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id()));
CREATE POLICY sa_update ON student_attendance FOR UPDATE
  USING (get_current_role() IN ('teacher', 'school_admin', 'super_admin', 'hr'));

-- STAFF_ATTENDANCE
CREATE POLICY sta_select ON staff_attendance FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE school_id = get_current_school_id()));
CREATE POLICY sta_insert ON staff_attendance FOR INSERT
  WITH CHECK (get_current_role() IN ('school_admin', 'super_admin', 'hr'));
CREATE POLICY sta_update ON staff_attendance FOR UPDATE
  USING (get_current_role() IN ('school_admin', 'super_admin', 'hr'));

-- TIMETABLE_SLOTS
CREATE POLICY ts_select ON timetable_slots FOR SELECT
  USING (class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id()));
CREATE POLICY ts_insert ON timetable_slots FOR INSERT
  WITH CHECK (get_current_role() IN ('school_admin', 'super_admin', 'hr') AND class_id IN (SELECT id FROM classes WHERE school_id = get_current_school_id()));
CREATE POLICY ts_update ON timetable_slots FOR UPDATE
  USING (get_current_role() IN ('school_admin', 'super_admin', 'hr'));
CREATE POLICY ts_delete ON timetable_slots FOR DELETE
  USING (get_current_role() IN ('school_admin', 'super_admin', 'hr'));

-- EXAMS
CREATE POLICY exams_select ON exams FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY exams_insert ON exams FOR INSERT
  WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY exams_update ON exams FOR UPDATE
  USING (is_admin() AND school_id = get_current_school_id());
CREATE POLICY exams_delete ON exams FOR DELETE
  USING (is_admin() AND school_id = get_current_school_id());

-- EXAM_RESULTS
CREATE POLICY er_select ON exam_results FOR SELECT
  USING (exam_id IN (SELECT id FROM exams WHERE school_id = get_current_school_id()) OR student_id = get_current_student_id());
CREATE POLICY er_insert ON exam_results FOR INSERT
  WITH CHECK (get_current_role() IN ('teacher', 'school_admin', 'super_admin'));
CREATE POLICY er_update ON exam_results FOR UPDATE
  USING (get_current_role() IN ('teacher', 'school_admin', 'super_admin'));
CREATE POLICY er_delete ON exam_results FOR DELETE
  USING (is_admin());

-- HOMEWORK
CREATE POLICY hw_select ON homework FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY hw_insert ON homework FOR INSERT
  WITH CHECK (get_current_role() IN ('teacher', 'school_admin', 'super_admin') AND school_id = get_current_school_id());
CREATE POLICY hw_update ON homework FOR UPDATE
  USING (get_current_role() IN ('teacher', 'school_admin', 'super_admin'));
CREATE POLICY hw_delete ON homework FOR DELETE
  USING (is_admin());

-- FEE_STRUCTURES
CREATE POLICY fs_select ON fee_structures FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY fs_insert ON fee_structures FOR INSERT
  WITH CHECK ((is_admin() OR get_current_role() = 'accountant') AND school_id = get_current_school_id());
CREATE POLICY fs_update ON fee_structures FOR UPDATE
  USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fs_delete ON fee_structures FOR DELETE
  USING (is_admin());

-- FEE_ITEMS
CREATE POLICY fi_select ON fee_items FOR SELECT
  USING (fee_structure_id IN (SELECT id FROM fee_structures WHERE school_id = get_current_school_id()));
CREATE POLICY fi_insert ON fee_items FOR INSERT
  WITH CHECK (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fi_update ON fee_items FOR UPDATE
  USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fi_delete ON fee_items FOR DELETE
  USING (is_admin());

-- STUDENT_FEES
CREATE POLICY sf_select ON student_fees FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id()) OR student_id = get_current_student_id());
CREATE POLICY sf_insert ON student_fees FOR INSERT
  WITH CHECK (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY sf_update ON student_fees FOR UPDATE
  USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY sf_delete ON student_fees FOR DELETE
  USING (is_admin());

-- FEE_PAYMENTS
CREATE POLICY fp_select ON fee_payments FOR SELECT
  USING (student_fee_id IN (SELECT sf.id FROM student_fees sf JOIN students s ON sf.student_id = s.id WHERE s.school_id = get_current_school_id()));
CREATE POLICY fp_insert ON fee_payments FOR INSERT
  WITH CHECK (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fp_update ON fee_payments FOR UPDATE
  USING (is_admin() OR get_current_role() = 'accountant');
CREATE POLICY fp_delete ON fee_payments FOR DELETE
  USING (is_admin());

-- LIBRARY_BOOKS
CREATE POLICY lb_select ON library_books FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY lb_insert ON library_books FOR INSERT
  WITH CHECK ((is_admin() OR get_current_role() = 'librarian') AND school_id = get_current_school_id());
CREATE POLICY lb_update ON library_books FOR UPDATE
  USING (is_admin() OR get_current_role() = 'librarian');
CREATE POLICY lb_delete ON library_books FOR DELETE
  USING (is_admin());

-- BOOK_ISSUES
CREATE POLICY bi_select ON book_issues FOR SELECT
  USING (book_id IN (SELECT id FROM library_books WHERE school_id = get_current_school_id()));
CREATE POLICY bi_insert ON book_issues FOR INSERT
  WITH CHECK (is_admin() OR get_current_role() = 'librarian');
CREATE POLICY bi_update ON book_issues FOR UPDATE
  USING (is_admin() OR get_current_role() = 'librarian');
CREATE POLICY bi_delete ON book_issues FOR DELETE
  USING (is_admin());

-- TRANSPORT_ROUTES
CREATE POLICY tr_select ON transport_routes FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY tr_insert ON transport_routes FOR INSERT
  WITH CHECK ((is_admin() OR get_current_role() = 'transport_manager') AND school_id = get_current_school_id());
CREATE POLICY tr_update ON transport_routes FOR UPDATE
  USING (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY tr_delete ON transport_routes FOR DELETE
  USING (is_admin());

-- VEHICLES
CREATE POLICY veh_select ON vehicles FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY veh_insert ON vehicles FOR INSERT
  WITH CHECK ((is_admin() OR get_current_role() = 'transport_manager') AND school_id = get_current_school_id());
CREATE POLICY veh_update ON vehicles FOR UPDATE
  USING (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY veh_delete ON vehicles FOR DELETE
  USING (is_admin());

-- STUDENT_TRANSPORT
CREATE POLICY st_select ON student_transport FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE school_id = get_current_school_id()) OR student_id = get_current_student_id());
CREATE POLICY st_insert ON student_transport FOR INSERT
  WITH CHECK (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY st_update ON student_transport FOR UPDATE
  USING (is_admin() OR get_current_role() = 'transport_manager');
CREATE POLICY st_delete ON student_transport FOR DELETE
  USING (is_admin());

-- STAFF_LEAVES
CREATE POLICY sl_select ON staff_leaves FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE school_id = get_current_school_id()) OR staff_id = get_current_staff_id());
CREATE POLICY sl_insert ON staff_leaves FOR INSERT
  WITH CHECK (get_current_role() IN ('school_admin', 'super_admin', 'teacher', 'hr'));
CREATE POLICY sl_update ON staff_leaves FOR UPDATE
  USING (get_current_role() IN ('school_admin', 'super_admin', 'hr'));
CREATE POLICY sl_delete ON staff_leaves FOR DELETE
  USING (is_admin());

-- PAYROLLS
CREATE POLICY pay_select ON payrolls FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE school_id = get_current_school_id()) OR staff_id = get_current_staff_id());
CREATE POLICY pay_insert ON payrolls FOR INSERT
  WITH CHECK (get_current_role() IN ('school_admin', 'super_admin', 'hr'));
CREATE POLICY pay_update ON payrolls FOR UPDATE
  USING (get_current_role() IN ('school_admin', 'super_admin', 'hr'));
CREATE POLICY pay_delete ON payrolls FOR DELETE
  USING (is_admin());

-- NOTICES
CREATE POLICY notices_select ON notices FOR SELECT
  USING (
    school_id = get_current_school_id()
    AND (
      target_audience = 'all'
      OR (target_audience = 'class' AND target_class_id IN (SELECT class_id FROM students WHERE id = get_current_student_id()))
      OR (target_audience = 'role' AND target_role = get_current_role())
      OR is_admin()
    )
  );
CREATE POLICY notices_insert ON notices FOR INSERT
  WITH CHECK (get_current_role() IN ('school_admin', 'super_admin', 'teacher') AND school_id = get_current_school_id());
CREATE POLICY notices_update ON notices FOR UPDATE
  USING (get_current_role() IN ('school_admin', 'super_admin', 'teacher'));
CREATE POLICY notices_delete ON notices FOR DELETE
  USING (is_admin());

-- SCHOOL_EVENTS
CREATE POLICY events_select ON school_events FOR SELECT
  USING (school_id = get_current_school_id());
CREATE POLICY events_insert ON school_events FOR INSERT
  WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY events_update ON school_events FOR UPDATE
  USING (is_admin());
CREATE POLICY events_delete ON school_events FOR DELETE
  USING (is_admin());

-- CERTIFICATES
CREATE POLICY cert_select ON certificates FOR SELECT
  USING (school_id = get_current_school_id() OR student_id = get_current_student_id());
CREATE POLICY cert_insert ON certificates FOR INSERT
  WITH CHECK (is_admin() AND school_id = get_current_school_id());
CREATE POLICY cert_delete ON certificates FOR DELETE
  USING (is_admin());

-- ============================================================================
-- STEP 10: STORAGE BUCKETS (for file uploads)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('student-photos', 'student-photos', true),
  ('staff-photos', 'staff-photos', true),
  ('book-covers', 'book-covers', true),
  ('homework-attachments', 'homework-attachments', true),
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read student-photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');
CREATE POLICY "Admin write student-photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'student-photos' AND is_admin());

CREATE POLICY "Public read staff-photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'staff-photos');
CREATE POLICY "Admin write staff-photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'staff-photos' AND is_admin());

CREATE POLICY "Public read book-covers" ON storage.objects FOR SELECT
  USING (bucket_id = 'book-covers');
CREATE POLICY "Admin write book-covers" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'book-covers' AND is_admin());

CREATE POLICY "Auth read homework-attachments" ON storage.objects FOR SELECT
  USING (bucket_id = 'homework-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Teacher write homework-attachments" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'homework-attachments' AND get_current_role() IN ('teacher', 'school_admin', 'super_admin'));

CREATE POLICY "Auth read documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admin write documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND is_admin());

-- ============================================================================
-- STEP 11: SEED DATA
-- ============================================================================

-- 11.1 SCHOOL
INSERT INTO schools (id, name, address, phone, email, established_date) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Greenwood International School', '123 Education Lane, Knowledge Park, New Delhi - 110001', '+91 98765 43210', 'info@greenwood.edu', '1998-06-15');

-- 11.2 CLASSES (15 classes)
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
  ('a0000000-0000-0000-0000-00000000000f', 'Class 12', 15, '00000000-0000-0000-0000-000000000001');

-- 11.3 SECTIONS (A, B for each class) — using DO block
DO $$
DECLARE
  cls RECORD;
  sec_char CHAR(1);
  sec_order INT;
BEGIN
  FOR cls IN SELECT id FROM classes WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    FOR sec_order IN 1..2 LOOP
      sec_char := CHR(64 + sec_order);  -- 'A' or 'B'
      INSERT INTO sections (class_id, name) VALUES (cls.id, sec_char);
    END LOOP;
  END LOOP;
END $$;

-- 11.4 SUBJECTS (12 subjects)
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
  ('b0000000-0000-0000-0000-00000000000c', 'Music', 'MUS', '00000000-0000-0000-0000-000000000001');

-- 11.5 CLASS_SUBJECTS (assign first 6 subjects to each class)
DO $$
DECLARE
  cls RECORD;
  subj RECORD;
BEGIN
  FOR cls IN SELECT id FROM classes WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    FOR subj IN SELECT id FROM subjects WHERE school_id = '00000000-0000-0000-0000-000000000001' ORDER BY code LIMIT 6 LOOP
      INSERT INTO class_subjects (class_id, subject_id) VALUES (cls.id, subj.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 11.6 STAFF (12 staff members)
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
  ('c0000000-0000-0000-0000-00000000000c', 'EMP0012', 'Sunita', 'Joshi', 'sunita.joshi@greenwood.edu', '+91 9800000122', 'HR Manager', 'Human Resources', 'non_teaching', 46000, '00000000-0000-0000-0000-000000000001', 'active', 'MBA HR', '2021-06-01');

-- 11.7 STUDENTS (10 students)
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
  ('d0000000-0000-0000-0000-00000000000a', 'GRW1010', '10', 'Ira', 'Mehta', 'ira.mehta@student.greenwood.edu', '+91 9900000010', '2012-10-08', 'female', 'AB+', '110, Sector 22, New Delhi', 'a0000000-0000-0000-0000-00000000000d', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000d' AND name='A' LIMIT 1), 'active', '00000000-0000-0000-0000-000000000001', 'Mr. Mehta', 'Mrs. Mehta', '+91 9900000100', 'parent.ira@gmail.com', '2021-08-15');

-- 11.8 ATTENDANCE (last 7 days for all students)
DO $$
DECLARE
  d_offset INT;
  d_date TEXT;
  stu RECORD;
  statuses TEXT[] := ARRAY['present', 'present', 'present', 'present', 'absent', 'late', 'leave'];
  rand_idx INT;
BEGIN
  FOR d_offset IN 0..6 LOOP
    d_date := to_char(current_date - d_offset, 'YYYY-MM-DD');
    FOR stu IN SELECT id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
      rand_idx := (random() * 6 + 1)::INT;
      INSERT INTO student_attendance (student_id, date, status, marked_by)
      VALUES (stu.id, d_date, statuses[rand_idx]::attendance_status, 'system')
      ON CONFLICT (student_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 11.9 FEE STRUCTURES (one per class)
DO $$
DECLARE
  cls RECORD;
  total_amt DECIMAL;
  class_num INT;
BEGIN
  FOR cls IN SELECT id, name FROM classes WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    -- Extract class number from name like "Class 10"
    class_num := 0;
    IF cls.name LIKE 'Class %' AND cls.name ~ '[0-9]+' THEN
      class_num := substring(cls.name FROM '[0-9]+')::INT;
    END IF;
    -- Base fee 45000 + 1000 per class number
    total_amt := 45000 + (class_num * 1000);
    INSERT INTO fee_structures (name, class_id, school_id, term, total_amount, due_date)
    VALUES (cls.name || ' - Annual Fee 2024-25', cls.id, '00000000-0000-0000-0000-000000000001', 'Annual', total_amt, '2024-12-31')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 11.10 STUDENT FEES (assign fee structure to each student)
DO $$
DECLARE
  stu RECORD;
  fs RECORD;
  paid_amt DECIMAL;
  due_amt DECIMAL;
  fee_st fee_status;
BEGIN
  FOR stu IN SELECT id, class_id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    SELECT * INTO fs FROM fee_structures WHERE class_id = stu.class_id LIMIT 1;
    IF FOUND THEN
      -- Random: 50% fully paid, 50% half paid
      IF random() > 0.5 THEN
        paid_amt := fs.total_amount;
      ELSE
        paid_amt := fs.total_amount * 0.5;
      END IF;
      due_amt := fs.total_amount - paid_amt;
      
      IF due_amt = 0 THEN
        fee_st := 'paid'::fee_status;
      ELSIF paid_amt > 0 THEN
        fee_st := 'partial'::fee_status;
      ELSE
        fee_st := 'pending'::fee_status;
      END IF;
      
      INSERT INTO student_fees (student_id, fee_structure_id, total_amount, paid_amount, due_amount, due_date, status)
      VALUES (stu.id, fs.id, fs.total_amount, paid_amt, due_amt, fs.due_date, fee_st)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 11.11 LIBRARY BOOKS (10 books)
INSERT INTO library_books (title, author, isbn, category, publisher, total_copies, available_copies, shelf_location, school_id) VALUES
  ('The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Fiction', 'Scribner', 5, 3, 'A-12', '00000000-0000-0000-0000-000000000001'),
  ('To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Fiction', 'HarperCollins', 4, 2, 'A-15', '00000000-0000-0000-0000-000000000001'),
  ('A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Science', 'Bantam', 3, 3, 'B-08', '00000000-0000-0000-0000-000000000001'),
  ('Wings of Fire', 'A.P.J. Abdul Kalam', '9788173711466', 'Biography', 'Universities Press', 6, 5, 'C-03', '00000000-0000-0000-0000-000000000001'),
  ('The Alchemist', 'Paulo Coelho', '9780061122415', 'Fiction', 'HarperOne', 4, 3, 'A-20', '00000000-0000-0000-0000-000000000001'),
  ('Mathematics for Class 10', 'R.D. Sharma', '9789388700001', 'Textbook', 'Dhanpat Rai', 10, 8, 'D-05', '00000000-0000-0000-0000-000000000001'),
  ('Physics Principles', 'H.C. Verma', '9788177091874', 'Textbook', 'Bharati Bhawan', 8, 6, 'D-10', '00000000-0000-0000-0000-000000000001'),
  ('Indian History', 'Bipin Chandra', '9788125036842', 'History', 'Orient Blackswan', 3, 2, 'E-02', '00000000-0000-0000-0000-000000000001'),
  ('Programming in Python', 'Mark Lutz', '9781449355739', 'Technology', 'O''Reilly', 4, 4, 'F-01', '00000000-0000-0000-0000-000000000001'),
  ('Organic Chemistry', 'Morrison Boyd', '9788131705099', 'Science', 'Pearson', 3, 2, 'B-15', '00000000-0000-0000-0000-000000000001');

-- 11.12 TRANSPORT ROUTES (5 routes)
INSERT INTO transport_routes (name, stops, fare, school_id) VALUES
  ('Route 1 - North Delhi', 'Rohini,Pitampura,Model Town', 1500, '00000000-0000-0000-0000-000000000001'),
  ('Route 2 - South Delhi', 'Saket,Malviya Nagar,Pushp Vihar', 1800, '00000000-0000-0000-0000-000000000001'),
  ('Route 3 - East Delhi', 'Preet Vihar,Vikas Marg,Mayur Vihar', 1600, '00000000-0000-0000-0000-000000000001'),
  ('Route 4 - West Delhi', 'Janakpuri,Rajouri Garden,Punjabi Bagh', 1700, '00000000-0000-0000-0000-000000000001'),
  ('Route 5 - Noida', 'Sector 18,Sector 62,Atta Market', 2000, '00000000-0000-0000-0000-000000000001');

-- 11.13 VEHICLES (5 buses)
INSERT INTO vehicles (bus_number, driver_name, driver_phone, capacity, route_id, school_id) VALUES
  ('DL01B1001', 'Driver Ramesh', '+91 9911111111', 40, (SELECT id FROM transport_routes WHERE name LIKE 'Route 1%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1002', 'Driver Suresh', '+91 9922222222', 40, (SELECT id FROM transport_routes WHERE name LIKE 'Route 2%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1003', 'Driver Mahesh', '+91 9933333333', 35, (SELECT id FROM transport_routes WHERE name LIKE 'Route 3%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1004', 'Driver Ganesh', '+91 9944444444', 40, (SELECT id FROM transport_routes WHERE name LIKE 'Route 4%' LIMIT 1), '00000000-0000-0000-0000-000000000001'),
  ('DL01B1005', 'Driver Dinesh', '+91 9955555555', 45, (SELECT id FROM transport_routes WHERE name LIKE 'Route 5%' LIMIT 1), '00000000-0000-0000-0000-000000000001');

-- 11.14 NOTICES (5 notices)
INSERT INTO notices (title, content, target_audience, posted_by, date, school_id) VALUES
  ('Annual Day Celebration', 'The school''s Annual Day will be celebrated on 25th December. All students must participate.', 'all'::notice_audience, 'Rajesh Kumar', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Parent-Teacher Meeting', 'PTM scheduled for this Saturday from 9 AM to 12 PM.', 'all'::notice_audience, 'Rajesh Kumar', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Fee Payment Reminder', 'Parents are reminded that the last date for fee payment is 31st December.', 'all'::notice_audience, 'Deepak Mehta', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Diwali Holiday', 'School will remain closed for Diwali. Classes resume after break.', 'all'::notice_audience, 'Rajesh Kumar', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('Science Exhibition', 'Annual Science Exhibition on 20th November. Submit project ideas by 10th.', 'all'::notice_audience, 'Suresh Patel', to_char(current_date, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001');

-- 11.15 EVENTS (5 events)
INSERT INTO school_events (title, description, date, end_date, type, school_id) VALUES
  ('Annual Day', 'Annual cultural function and prize distribution', '2024-12-25', NULL, 'function'::event_type, '00000000-0000-0000-0000-000000000001'),
  ('Diwali Break', 'Diwali holidays', '2024-11-10', '2024-11-15', 'holiday'::event_type, '00000000-0000-0000-0000-000000000001'),
  ('Mid-Term Exam', 'Mid-term examinations for all classes', '2024-09-15', '2024-09-25', 'exam'::event_type, '00000000-0000-0000-0000-000000000001'),
  ('PTM', 'Parent-Teacher Meeting for Class 10', '2024-11-30', NULL, 'ptm'::event_type, '00000000-0000-0000-0000-000000000001'),
  ('Sports Day', 'Annual sports day with various athletic events', '2024-11-05', NULL, 'function'::event_type, '00000000-0000-0000-0000-000000000001');

-- 11.16 EXAM (Mid-Term for Class 10)
INSERT INTO exams (name, type, school_id, class_id, start_date, end_date, max_marks)
VALUES ('Mid-Term Examination 2024', 'mid_term'::exam_type, '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000d', '2024-09-15', '2024-09-25', 100);

-- 11.17 EXAM RESULTS (for Class 10 students, 5 subjects each)
DO $$
DECLARE
  stu RECORD;
  subj RECORD;
  marks INT;
  grade_val TEXT;
BEGIN
  FOR stu IN SELECT id FROM students WHERE class_id = 'a0000000-0000-0000-0000-00000000000d' LOOP
    FOR subj IN SELECT id FROM subjects WHERE school_id = '00000000-0000-0000-0000-000000000001' ORDER BY code LIMIT 5 LOOP
      marks := 55 + (random() * 45)::INT;
      grade_val := CASE
        WHEN marks >= 90 THEN 'A+'
        WHEN marks >= 80 THEN 'A'
        WHEN marks >= 70 THEN 'B+'
        WHEN marks >= 60 THEN 'B'
        WHEN marks >= 50 THEN 'C'
        ELSE 'D'
      END;
      INSERT INTO exam_results (exam_id, student_id, subject_id, marks_obtained, max_marks, grade)
      VALUES ((SELECT id FROM exams WHERE name = 'Mid-Term Examination 2024' LIMIT 1), stu.id, subj.id, marks, 100, grade_val)
      ON CONFLICT (exam_id, student_id, subject_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 11.18 HOMEWORK (5 assignments)
INSERT INTO homework (class_id, section_id, subject_id, staff_id, title, description, due_date, school_id) VALUES
  ('a0000000-0000-0000-0000-00000000000d', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000d' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'Algebra - Quadratic Equations', 'Solve exercises 4.1 to 4.5 from textbook.', to_char(current_date + 7, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000c', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000c' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Essay - My Favorite Book', 'Write a 500-word essay on your favorite book.', to_char(current_date + 5, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000b', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000b' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'Science Project - Photosynthesis', 'Create a diagram showing the process of photosynthesis.', to_char(current_date + 10, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000d', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000d' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006', 'History - Independence Movement', 'Research 3 key events in India''s independence movement.', to_char(current_date + 7, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000a', (SELECT id FROM sections WHERE class_id='a0000000-0000-0000-0000-00000000000a' AND name='A' LIMIT 1), 'b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000007', 'Hindi - Kabir ke Dohe', 'Memorize 5 dohe by Kabir and write their meaning.', to_char(current_date + 4, 'YYYY-MM-DD'), '00000000-0000-0000-0000-000000000001');

-- 11.19 STAFF LEAVES (5 leave requests)
INSERT INTO staff_leaves (staff_id, from_date, to_date, reason, type, status, approved_by) VALUES
  ('c0000000-0000-0000-0000-000000000003', '2024-11-01', '2024-11-03', 'Medical leave', 'sick'::leave_type, 'approved'::leave_status, 'Rajesh Kumar'),
  ('c0000000-0000-0000-0000-000000000004', '2024-11-10', '2024-11-12', 'Personal work', 'casual'::leave_type, 'approved'::leave_status, 'Rajesh Kumar'),
  ('c0000000-0000-0000-0000-000000000005', '2024-11-15', '2024-11-16', 'Family function', 'casual'::leave_type, 'pending'::leave_status, NULL),
  ('c0000000-0000-0000-0000-000000000006', '2024-11-20', '2024-11-22', 'Not well', 'sick'::leave_type, 'pending'::leave_status, NULL),
  ('c0000000-0000-0000-0000-000000000007', '2024-11-25', '2024-11-26', 'Personal', 'casual'::leave_type, 'rejected'::leave_status, 'Rajesh Kumar');

-- 11.20 PAYROLLS (current month for all staff)
DO $$
DECLARE
  stf RECORD;
  basic DECIMAL;
  allow DECIMAL;
  deduct DECIMAL;
  net DECIMAL;
BEGIN
  FOR stf IN SELECT id, salary FROM staff WHERE school_id = '00000000-0000-0000-0000-000000000001' LOOP
    basic := stf.salary;
    allow := basic * 0.20;
    deduct := basic * 0.12;
    net := basic + allow - deduct;
    INSERT INTO payrolls (staff_id, month, year, basic_salary, allowances, deductions, net_salary, status)
    VALUES (stf.id, EXTRACT(MONTH FROM current_date)::INT, EXTRACT(YEAR FROM current_date)::INT, basic, allow, deduct, net, 'pending'::payroll_status)
    ON CONFLICT (staff_id, month, year) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- DONE! 🎉
-- ============================================================================
-- ✅ 28 tables created
-- ✅ 14 enums (custom types)
-- ✅ 119 RLS policies (role-based access control)
-- ✅ 5 triggers (auto-update timestamps + auto-create profile on signup)
-- ✅ 14 indexes (query performance)
-- ✅ 5 storage buckets (student-photos, staff-photos, book-covers, homework-attachments, documents)
-- ✅ Seed data: 1 school, 15 classes, 30 sections, 12 subjects, 12 staff, 10 students,
--    7 days attendance, 15 fee structures + student fees, 10 library books, 5 transport routes,
--    5 vehicles, 5 notices, 5 events, 1 exam + results, 5 homework, 5 staff leaves, 12 payrolls
--
-- NEXT STEPS:
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
--    Email: superadmin@eduflow.com (or any email you want)
--    Password: (set a strong password)
-- 2. Run this in SQL Editor to make the user a super admin:
--    UPDATE profiles SET role = 'super_admin', name = 'Super Admin' WHERE email = 'superadmin@eduflow.com';
-- 3. Login to the app with that email + password
-- 4. Go to User Management module to add more users!
-- ============================================================================
