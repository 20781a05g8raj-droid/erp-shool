// Server-side Supabase client
// Uses @supabase/ssr for cookie-based auth in Next.js App Router
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eyrykqvsbgsqwvqbfazw.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_yLrJYPAOGjfnbObtl8Kr0A_Gxxzqje6";

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // Safe to ignore if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

// Admin client with service role key (bypasses RLS — use with caution!)
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eyrykqvsbgsqwvqbfazw.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cnlrcXZzYmdzcXd2cWJmYXp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUxMzIyMSwiZXhwIjoyMDk5MDg5MjIxfQ.ENe1bhIhz4xUKMLFN8dkuojbJCi7u8YdeKSgLOsaVH0";
  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
