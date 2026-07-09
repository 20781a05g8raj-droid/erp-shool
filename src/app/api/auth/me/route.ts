import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/auth/me — get current user
export async function GET() {
  try {
    let userId: string | null = null;
    // 1. Try x-user-id header first
    try {
      const { headers } = await import("next/headers");
      const headerStore = await headers();
      userId = headerStore.get("x-user-id");
    } catch {
      // ignore
    }

    // 2. Fallback to Supabase session client
    if (!userId) {
      try {
        const { createSupabaseServerClient } = await import("@/lib/supabase/server");
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          userId = session.user.id;
        }
      } catch {
        // ignore
      }
    }

    if (!userId) return NextResponse.json({ user: null });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, role, school_id, phone, avatar, status, student_id, staff_id")
      .eq("id", userId)
      .single();

    if (!profile) return NextResponse.json({ user: null });

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
  } catch {
    return NextResponse.json({ user: null });
  }
}
