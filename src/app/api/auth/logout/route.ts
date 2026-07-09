import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /api/auth/logout — sign out from Supabase
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
