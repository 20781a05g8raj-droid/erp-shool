import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/types";

// POST /api/auth/signup
// User enters email + password + name. System checks if email exists in
// students or staff tables, determines role, creates auth user + profile.
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    // Check if auth user already exists
    const { data: existingAuth } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    }).catch(() => ({ data: { user: null, session: null }, error: null }));

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login instead." },
        { status: 400 }
      );
    }

    // Determine role by checking students table first, then staff table
    let role: Role | null = null;
    let schoolId: string | null = null;
    let studentId: string | null = null;
    let staffId: string | null = null;
    let displayName = name?.trim() || "";

    // 1. Check students table (student's own email OR parent's email)
    const { data: student } = await supabase
      .from("students")
      .select("id, first_name, last_name, email, parent_email, school_id")
      .or(`email.eq.${normalizedEmail},parent_email.eq.${normalizedEmail}`)
      .eq("status", "active")
      .single();

    if (student) {
      if (student.email === normalizedEmail) {
        role = "student";
      } else if (student.parent_email === normalizedEmail) {
        role = "parent";
      }
      schoolId = student.school_id;
      studentId = student.id;
      if (!displayName) {
        displayName = role === "parent"
          ? `Parent of ${student.first_name}`
          : `${student.first_name} ${student.last_name}`;
      }
    }

    // 2. If not found in students, check staff table
    if (!role) {
      const { data: staff } = await supabase
        .from("staff")
        .select("id, first_name, last_name, email, designation, type, school_id")
        .eq("email", normalizedEmail)
        .eq("status", "active")
        .single();

      if (staff) {
        schoolId = staff.school_id;
        staffId = staff.id;
        if (!displayName) {
          displayName = `${staff.first_name} ${staff.last_name}`;
        }
        // Determine role based on staff type + designation
        if (staff.type === "teaching") {
          role = "teacher";
        } else {
          const desig = (staff.designation || "").toLowerCase();
          if (desig.includes("accountant") || desig.includes("finance")) {
            role = "accountant";
          } else if (desig.includes("librarian") || desig.includes("library")) {
            role = "librarian";
          } else if (desig.includes("transport")) {
            role = "transport_manager";
          } else if (desig.includes("hr") || desig.includes("human resource")) {
            role = "hr";
          } else if (desig.includes("principal") || desig.includes("admin") || desig.includes("director")) {
            role = "school_admin";
          } else {
            role = "hr";
          }
        }
      }
    }

    // 3. If email not found in either table
    if (!role || !schoolId) {
      return NextResponse.json(
        {
          error:
            "Your email is not registered in our system. Please contact your school administrator to add you first, then come back to sign up.",
        },
        { status: 403 }
      );
    }

    // Create auth user via admin client
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // auto-confirm email
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create account" },
        { status: 400 }
      );
    }

    // Update the profile (trigger auto-creates it, we update with role + links)
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({
        name: displayName,
        role,
        school_id: schoolId,
        student_id: studentId,
        staff_id: staffId,
        status: "active",
      })
      .eq("id", authData.user.id)
      .select("id, email, name, role, school_id, phone, avatar, status, student_id, staff_id")
      .single();

    if (profileError || !profile) {
      // If profile update fails, insert manually
      const { data: newProfile } = await admin
        .from("profiles")
        .insert({
          id: authData.user.id,
          email: normalizedEmail,
          name: displayName,
          role,
          school_id: schoolId,
          student_id: studentId,
          staff_id: staffId,
          status: "active",
        })
        .select("id, email, name, role, school_id, phone, avatar, status, student_id, staff_id")
        .single();

      if (!newProfile) {
        return NextResponse.json(
          { error: "Account created but profile setup failed. Please contact admin." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        user: newProfile,
        message: `Account created successfully! You are registered as ${role.replace("_", " ")}.`,
      });
    }

    return NextResponse.json({
      user: profile,
      message: `Account created successfully! You are registered as ${role.replace("_", " ")}.`,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An error occurred during signup. Please try again." },
      { status: 500 }
    );
  }
}
