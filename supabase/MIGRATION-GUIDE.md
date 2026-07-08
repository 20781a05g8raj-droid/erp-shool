# EduFlow ERP → Supabase Migration Guide

## Aapko kya-kya chahiye Supabase se

Jab aap Supabase project banayenge, aapko yeh 3 cheezein milengi:

| Credential | Kahan se milega | Kahan use hoga |
|-----------|-----------------|----------------|
| **Project URL** | Dashboard → Project Settings → API → "Project URL" | `.env.local` mein `NEXT_PUBLIC_SUPABASE_URL` |
| **Anon Key** | Dashboard → Project Settings → API → "Project API Keys" → "anon public" | `.env.local` mein `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Service Role Key** | Dashboard → Project Settings → API → "Project API Keys" → "service_role" (⚠️ SECRET!) | `.env.local` mein `SUPABASE_SERVICE_ROLE_KEY` (server-side only) |

---

## Steps to Connect

### Step 1: Supabase Project Banao

1. https://supabase.com par jao → "New Project"
2. Project name: `eduflow-erp`
3. Database password set karo (strong password, save kar lo)
4. Region choose karo (apne closest — Mumbai/Singapore for India)
5. "Create new project" click karo
6. 2-3 minute wait karo project setup ke liye

### Step 2: SQL Schema Run Karo

1. Supabase Dashboard → **SQL Editor** → **New Query**
2. `supabase/schema.sql` file ka pura content copy-paste karo
3. **Run** click karo
4. Yeh sab create kar dega:
   - 28 tables (schools, profiles, students, staff, classes, sections, subjects, attendance, timetable, exams, fees, library, transport, HR, notices, events, certificates, etc.)
   - Row Level Security (RLS) policies har table par (role-based access)
   - Storage buckets (student-photos, staff-photos, book-covers, homework-attachments, documents)
   - Triggers (auto-create profile on signup, auto-update updated_at)
   - Indexes (performance)
   - Seed data (Greenwood school record)

### Step 3: Super Admin User Banao

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Email: `superadmin@eduflow.com`
3. Password: (strong password set karo)
4. "Create user" click karo
5. Ab SQL Editor mein yeh run karo:
   ```sql
   UPDATE profiles
   SET role = 'super_admin', name = 'Super Admin'
   WHERE email = 'superadmin@eduflow.com';
   ```

### Step 4: Environment Variables Set Karo

Project root mein `.env.local` file banao:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...your-service-role-key...
```

### Step 5: Supabase Package Install Karo

```bash
bun add @supabase/supabase-js @supabase/ssr
```

### Step 6: App Chalao

```bash
bun run dev
```

Login karo:
- Email: `superadmin@eduflow.com`
- Password: (jo Step 3 mein set kiya)

Ab Super Admin login karke **User Management** module se baaki sab users add kar sakta hai (teachers, students, parents, accountants, librarians, transport managers, HR).

---

## Schema Overview

### Tables (28 total)

| Category | Tables |
|----------|--------|
| **Auth & Core** | schools, profiles |
| **Academics** | classes, sections, subjects, class_subjects |
| **People** | students, staff |
| **Attendance** | student_attendance, staff_attendance |
| **Timetable** | timetable_slots |
| **Exams** | exams, exam_results |
| **Homework** | homework |
| **Fees** | fee_structures, fee_items, student_fees, fee_payments |
| **Library** | library_books, book_issues |
| **Transport** | transport_routes, vehicles, student_transport |
| **HR** | staff_leaves, payrolls |
| **Communication** | notices, school_events |
| **Certificates** | certificates |

### RLS Policy Summary

- **Super Admin**: sab kuch dekh/edit kar sakta hai (all schools)
- **School Admin**: apne school ka sab data
- **Teacher**: apne classes ka attendance, homework, exam marks; staff attendance nahi
- **Student**: sirf apna data (attendance, fees, homework, results)
- **Parent**: apne bachche ka data
- **Accountant**: fees + students CRUD
- **Librarian**: library books + issues
- **Transport Manager**: routes + vehicles + assignments
- **HR**: staff + payroll + staff attendance + timetable

### Storage Buckets

| Bucket | Public? | Use |
|--------|---------|-----|
| student-photos | ✅ | Student profile photos |
| staff-photos | ✅ | Staff profile photos |
| book-covers | ✅ | Library book cover images |
| homework-attachments | ❌ | Homework file attachments |
| documents | ❌ | Student/staff documents (private) |

---

## Important Notes

1. **Service Role Key** kabhi bhi browser/client code mein use mat karo — yeh RLS bypass karta hai. Sirf server-side API routes mein use karo.

2. **Anon Key** safe hai browser mein — RLS policies usse protect karti hain.

3. Jab user Supabase Auth se signup karta hai (email/password), ek trigger automatically `profiles` table mein entry create karta hai. Phir admin usse role assign kar sakta hai.

4. Agar aap Prisma se completely Supabase par move karna chahte ho, toh `src/lib/db.ts` (Prisma client) ko replace karna hoga Supabase queries se. Main dono support rakh sakta hoon — batao agar migration chahiye.

5. **Database URL**: Supabase use karne par `DATABASE_URL` ki zarurat nahi (Supabase khud DB handle karta hai). Prisma sirf local dev ke liye rakha gaya hai.
