-- ============================================================================
-- EduFlow ERP — Migration Script (Run AFTER schema.sql)
-- ============================================================================
-- This adds the password column to profiles and creates demo user accounts.
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- ============================================================================

-- Step 1: Add password column to profiles (for our custom auth)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- Step 2: Drop the FK constraint from profiles.id to auth.users.id
-- (so we can create profiles without needing auth.users entries)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 3: Make profiles.id auto-generate UUID (instead of requiring auth.users.id)
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- ============================================================================
-- Step 4: Create demo user accounts
-- ============================================================================
-- These match the demo logins shown on the login page.

-- School Admin (Rajesh Kumar - Principal)
INSERT INTO profiles (email, password, name, role, school_id, staff_id, status)
VALUES ('admin@greenwood.edu', 'demo:admin123', 'Rajesh Kumar', 'school_admin', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'active')
ON CONFLICT (email) DO NOTHING;

-- Teacher (Anita Verma)
INSERT INTO profiles (email, password, name, role, school_id, staff_id, status)
VALUES ('anita.verma@greenwood.edu', 'demo:teacher123', 'Anita Verma', 'teacher', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'active')
ON CONFLICT (email) DO NOTHING;

-- Student (Diya Das)
INSERT INTO profiles (email, password, name, role, school_id, student_id, status)
VALUES ('diya.das@student.greenwood.edu', 'demo:student123', 'Diya Das', 'student', '00000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT (email) DO NOTHING;

-- Parent (of Diya Das)
INSERT INTO profiles (email, password, name, role, school_id, student_id, status)
VALUES ('parent.diya@gmail.com', 'demo:parent123', 'Parent of Diya', 'parent', '00000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT (email) DO NOTHING;

-- Accountant (Deepak Mehta)
INSERT INTO profiles (email, password, name, role, school_id, staff_id, status)
VALUES ('deepak.mehta@greenwood.edu', 'demo:account123', 'Deepak Mehta', 'accountant', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'active')
ON CONFLICT (email) DO NOTHING;

-- Librarian (Lakshmi Iyer)
INSERT INTO profiles (email, password, name, role, school_id, staff_id, status)
VALUES ('lakshmi.iyer@greenwood.edu', 'demo:library123', 'Lakshmi Iyer', 'librarian', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000a', 'active')
ON CONFLICT (email) DO NOTHING;

-- Transport Manager (Ramesh Yadav)
INSERT INTO profiles (email, password, name, role, school_id, staff_id, status)
VALUES ('ramesh.yadav@greenwood.edu', 'demo:transport123', 'Ramesh Yadav', 'transport_manager', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b', 'active')
ON CONFLICT (email) DO NOTHING;

-- HR Manager (Sunita Joshi)
INSERT INTO profiles (email, password, name, role, school_id, staff_id, status)
VALUES ('sunita.joshi@greenwood.edu', 'demo:hr123', 'Sunita Joshi', 'hr', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'active')
ON CONFLICT (email) DO NOTHING;

-- Super Admin
INSERT INTO profiles (email, password, name, role, status)
VALUES ('superadmin@eduflow.com', 'demo:admin123', 'Super Admin', 'super_admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- DONE! Demo accounts created:
-- ============================================================================
-- admin@greenwood.edu / admin123 (School Admin)
-- anita.verma@greenwood.edu / teacher123 (Teacher)
-- diya.das@student.greenwood.edu / student123 (Student)
-- parent.diya@gmail.com / parent123 (Parent)
-- deepak.mehta@greenwood.edu / account123 (Accountant)
-- lakshmi.iyer@greenwood.edu / library123 (Librarian)
-- ramesh.yadav@greenwood.edu / transport123 (Transport Manager)
-- sunita.joshi@greenwood.edu / hr123 (HR Manager)
-- superadmin@eduflow.com / admin123 (Super Admin)
-- ============================================================================
