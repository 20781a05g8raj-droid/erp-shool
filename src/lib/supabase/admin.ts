// Supabase Admin Client (server-side only, bypasses RLS)
// Uses service role key — NEVER expose to browser!
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eyrykqvsbgsqwvqbfazw.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cnlrcXZzYmdzcXd2cWJmYXp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUxMzIyMSwiZXhwIjoyMDk5MDg5MjIxfQ.ENe1bhIhz4xUKMLFN8dkuojbJCi7u8YdeKSgLOsaVH0";

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper: convert snake_case to camelCase (for API response compatibility)
export function toCamelCase(
  obj: Record<string, unknown> | Record<string, unknown>[] | null
): Record<string, unknown> | Record<string, unknown>[] | null {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((v) =>
      v && typeof v === "object" ? toCamelCase(v as Record<string, unknown>) : v
    ) as Record<string, unknown>[];
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    let value = (obj as Record<string, unknown>)[key];
    // Recursively convert nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      value = toCamelCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      value = value.map((v) =>
        v && typeof v === "object" ? toCamelCase(v as Record<string, unknown>) : v
      );
    }
    result[camelKey] = value;
  }
  return result;
}

// Helper: convert camelCase to snake_case (for DB queries)
export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    result[snakeKey] = obj[key];
  }
  return result;
}
