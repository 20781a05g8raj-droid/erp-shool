import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// DELETE /api/transport/assignments/[id]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("student_transport")
    .select("id, transport_routes!inner(school_id)")
    .eq("id", id)
    .eq("transport_routes.school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json(
      { error: "Assignment not found" },
      { status: 404 }
    );
  }

  try {
    const { error } = await supabaseAdmin
      .from("student_transport")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to remove assignment" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to remove assignment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
