// Browser-side Supabase client
// Uses NEXT_PUBLIC_ env vars (safe to expose to browser)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eyrykqvsbgsqwvqbfazw.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_yLrJYPAOGjfnbObtl8Kr0A_Gxxzqje6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
