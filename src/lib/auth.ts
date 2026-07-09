// Server-side auth helpers using Supabase
import { supabaseAdmin } from "./supabase/admin";
import type { User } from "@/types";

// Convert snake_case to camelCase for a profile object
function normalizeProfile(p: Record<string, unknown> | null): User | null {
  if (!p) return null;
  return {
    id: p.id as string,
    email: p.email as string,
    name: p.name as string,
    role: p.role as User["role"],
    schoolId: (p.school_id as string) || null,
    phone: (p.phone as string) || null,
    avatar: (p.avatar as string) || null,
    status: p.status as string,
    studentId: (p.student_id as string) || null,
    staffId: (p.staff_id as string) || null,
  };
}

// Get current user from Supabase session OR x-user-id header (fallback)
export async function getCurrentUser(): Promise<User | null> {
  try {
    let userId: string | null = null;
    // 1. Try x-user-id header first (very fast, doesn't require importing & instantiating server client)
    try {
      const { headers } = await import("next/headers");
      const headerStore = await headers();
      userId = headerStore.get("x-user-id");
    } catch {
      // Ignore header retrieval failure
    }

    // 2. Fallback to Supabase session client if no header found
    if (!userId) {
      try {
        const { createSupabaseServerClient } = await import("./supabase/server");
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          userId = session.user.id;
        }
      } catch {
        // Session check failed
      }
    }

    if (!userId) return null;

    // Use admin client (bypasses RLS) to fetch profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, role, school_id, phone, avatar, status, student_id, staff_id")
      .eq("id", userId)
      .single();

    return normalizeProfile(profile);
  } catch (error) {
    console.error("getCurrentUser error:", error);
    return null;
  }
}

// Verify password (Supabase Auth handles this — kept for backward compat)
export function verifyPassword(input: string, stored: string): boolean {
  if (stored.startsWith("demo:")) {
    return input === stored.slice(5);
  }
  return false;
}

// Session cookie helpers (Supabase manages these automatically)
export async function setSessionCookie(_userId: string) {
  // No-op
}

export async function clearSessionCookie() {
  // No-op
}
