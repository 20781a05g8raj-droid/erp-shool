import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /api/auth/login — login using Supabase Auth
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Fetch profile using admin client (bypasses RLS)
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, role, school_id, phone, avatar, status, student_id, staff_id")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.status !== "active") {
      return NextResponse.json(
        { error: "Your account has been suspended. Please contact the administrator." },
        { status: 403 }
      );
    }

    // Return camelCase response
    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        schoolId: profile.school_id || null,
        phone: profile.phone || null,
        avatar: profile.avatar || null,
        status: profile.status,
        studentId: profile.student_id || null,
        staffId: profile.staff_id || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
