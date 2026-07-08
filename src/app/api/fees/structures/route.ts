import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET — list fee structures with items + class
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: structuresRaw, error } = await supabaseAdmin
    .from("fee_structures")
    .select("*, classes(*), fee_items(*)")
    .eq("school_id", user.schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch fee structures" },
      { status: 500 }
    );
  }

  // Compute studentFees count for each structure
  const structures = await Promise.all(
    (structuresRaw || []).map(async (s: Record<string, unknown>) => {
      const { count } = await supabaseAdmin
        .from("student_fees")
        .select("*", { count: "exact", head: true })
        .eq("fee_structure_id", s.id as string);
      s._count = { studentFees: count || 0 };
      return s;
    })
  );

  return NextResponse.json({
    structures: toCamelCase(structures as Record<string, unknown>[]),
  });
}

// POST — create fee structure with items
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, classId, term, dueDate, items } = body as {
      name?: string;
      classId?: string | null;
      term?: string;
      dueDate?: string | null;
      items?: { name?: string; amount?: number }[];
    };

    if (!name || !term) {
      return NextResponse.json(
        { error: "Name and term are required" },
        { status: 400 }
      );
    }

    const cleanItems = Array.isArray(items)
      ? items
          .filter((it) => it && it.name && Number(it.amount) > 0)
          .map((it) => ({ name: String(it.name), amount: Number(it.amount) }))
      : [];

    const totalAmount = cleanItems.reduce((sum, it) => sum + it.amount, 0);

    const { data: structure, error: createError } = await supabaseAdmin
      .from("fee_structures")
      .insert({
        name,
        class_id: classId || null,
        school_id: user.schoolId,
        term,
        due_date: dueDate || null,
        total_amount: totalAmount,
      })
      .select("*, classes(*), fee_items(*)")
      .single();

    if (createError || !structure) {
      return NextResponse.json(
        { error: "Failed to create fee structure" },
        { status: 500 }
      );
    }

    // Create items if any
    if (cleanItems.length > 0) {
      const itemRows = cleanItems.map((it) => ({
        fee_structure_id: structure.id,
        name: it.name,
        amount: it.amount,
      }));
      const { data: insertedItems } = await supabaseAdmin
        .from("fee_items")
        .insert(itemRows)
        .select("*");
      structure.fee_items = insertedItems || [];
    }

    return NextResponse.json(
      { structure: toCamelCase(structure as Record<string, unknown>) },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create fee structure" },
      { status: 500 }
    );
  }
}
