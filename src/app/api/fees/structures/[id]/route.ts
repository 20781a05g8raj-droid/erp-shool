import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

    const existing = await db.feeStructure.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!existing) {
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
    await db.feeItem.deleteMany({ where: { feeStructureId: id } });

    const structure = await db.feeStructure.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        classId: classId === undefined ? existing.classId : classId || null,
        term: term ?? existing.term,
        dueDate: dueDate === undefined ? existing.dueDate : dueDate || null,
        totalAmount: cleanItems.length > 0 ? totalAmount : existing.totalAmount,
        items:
          cleanItems.length > 0
            ? { create: cleanItems }
            : undefined,
      },
      include: { items: true, class: true },
    });

    return NextResponse.json({ structure });
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
    const existing = await db.feeStructure.findFirst({
      where: { id, schoolId: user.schoolId },
      include: { _count: { select: { studentFees: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Fee structure not found" },
        { status: 404 }
      );
    }

    if (existing._count.studentFees > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete: this fee structure is assigned to students. Remove assignments first.",
        },
        { status: 400 }
      );
    }

    await db.feeStructure.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete fee structure" },
      { status: 500 }
    );
  }
}
