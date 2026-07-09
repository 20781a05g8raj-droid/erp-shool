import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// PUT — update fee structure (and replace items)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, classId, term, dueDate, items } = body as {
      name?: string;
      classId?: string | null;
      term?: string;
      dueDate?: string | null;
      items?: { name?: string; amount?: number }[];
    };

    const { data: existing, error: existError } = await supabaseAdmin
      .from("fee_structures")
      .select("*")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (existError || !existing) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    const cleanItems = Array.isArray(items)
      ? items
          .filter((it) => it && it.name && Number(it.amount) > 0)
          .map((it) => ({ name: String(it.name), amount: Number(it.amount) }))
      : [];

    const totalAmount = cleanItems.reduce((sum, it) => sum + it.amount, 0);

    // Replace items: delete then recreate
    await supabaseAdmin.from("fee_items").delete().eq("fee_structure_id", id);

    const updateData: Record<string, unknown> = {
      name: name ?? existing.name,
      class_id: classId === undefined ? existing.class_id : classId || null,
      term: term ?? existing.term,
      due_date: dueDate === undefined ? existing.due_date : dueDate || null,
      total_amount:
        cleanItems.length > 0 ? totalAmount : existing.total_amount,
    };

    const { data: structure, error: updateError } = await supabaseAdmin
      .from("fee_structures")
      .update(updateData)
      .eq("id", id)
      .select("*, classes(*), fee_items(*)")
      .single();

    if (updateError || !structure) {
      return NextResponse.json(
        { error: "Failed to update fee structure" },
        { status: 500 }
      );
    }

    // Insert new items
    if (cleanItems.length > 0) {
      const itemRows = cleanItems.map((it) => ({
        fee_structure_id: id,
        name: it.name,
        amount: it.amount,
      }));
      const { data: insertedItems } = await supabaseAdmin
        .from("fee_items")
        .insert(itemRows)
        .select("*");
      structure.fee_items = insertedItems || [];
    }

    const structureWithCompat = {
      ...structure,
      class: structure.classes,
      items: structure.fee_items || [],
    };

    return NextResponse.json({
      structure: toCamelCase(structureWithCompat as Record<string, unknown>),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update fee structure" },
      { status: 500 }
    );
  }
}

// DELETE — remove fee structure (cascades items; studentFees must be cleared first)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { data: existing, error: existError } = await supabaseAdmin
      .from("fee_structures")
      .select("id")
      .eq("id", id)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (existError || !existing) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    const { count } = await supabaseAdmin
      .from("student_fees")
      .select("*", { count: "exact", head: true })
      .eq("fee_structure_id", id);

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete: this fee structure is assigned to students. Remove assignments first.",
        },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("fee_structures")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete fee structure" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete fee structure" },
      { status: 500 }
    );
  }
}
