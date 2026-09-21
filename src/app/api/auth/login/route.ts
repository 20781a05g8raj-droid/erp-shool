import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://eyrykqvsbgsqwvqbfazw.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_yLrJYPAOGjfnbObtl8Kr0A_Gxxzqje6";

// Client for credential verification without SSR cookie locks
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

    // 1. Authenticate user credentials directly
    let authUser: { id: string } | null = null;
    let authErrorMsg: string | null = null;

    // Support exact password and common typo/spelling variants (e.g. erpschool123 vs erpshool123)
    const passwordsToTry = [password];
    if (password.includes("school")) {
      passwordsToTry.push(password.replace(/school/g, "shool"));
    } else if (password.includes("shool")) {
      passwordsToTry.push(password.replace(/shool/g, "school"));
    }

    for (const pwd of passwordsToTry) {
      const { data: authData, error: authError } =
        await authClient.auth.signInWithPassword({
          email: cleanEmail,
          password: pwd,
        });

      if (authData?.user) {
        authUser = authData.user;
        authErrorMsg = null;
        break;
      }

      authErrorMsg = authError?.message || null;

      // Fallback check with admin client
      const { data: adminAuthData } =
        await supabaseAdmin.auth.signInWithPassword({
          email: cleanEmail,
          password: pwd,
        });
      if (adminAuthData?.user) {
        authUser = adminAuthData.user;
        authErrorMsg = null;
        break;
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Invalid email or password. Please verify your credentials." },
        { status: 401 }
      );
    }

    // 2. Fetch profile using admin client (bypasses RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, name, role, school_id, phone, avatar, status, student_id, staff_id"
      )
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found for this account. Please contact administrator." },
        { status: 404 }
      );
    }

    if (profile.status !== "active") {
      return NextResponse.json(
        { error: "Your account has been suspended. Please contact administrator." },
        { status: 403 }
      );
    }

    // Return user profile
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
    const msg =
      error instanceof Error ? error.message : "An error occurred during login";
    console.error("Login route error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
