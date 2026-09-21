import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const cleanEmail = email.toLowerCase().trim();
    let authUser: { id: string } | null = null;
    let authError: string | null = null;

    // 1. Try server client with cookies
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (data?.user) {
        authUser = data.user;
      } else if (error) {
        authError = error.message;
      }
    } catch (err) {
      console.warn("Server client sign in warning:", err);
    }

    // 2. Fallback to admin client
    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (data?.user) {
        authUser = data.user;
        authError = null;
      } else if (error) {
        authError = error.message;
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: authError || "Invalid email or password" },
        { status: 401 }
      );
    }

    // 3. Fetch profile using admin client (bypasses RLS)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, role, school_id, phone, avatar, status, student_id, staff_id")
      .eq("id", authUser.id)
      .single();

    if (!profile || profile.status !== "active") {
      return NextResponse.json(
        { error: "Your account has been suspended or profile not found." },
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "An error occurred during login";
    console.error("Login error:", error);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
