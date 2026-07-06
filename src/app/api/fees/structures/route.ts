import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — list fee structures with items + class
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const structures = await db.feeStructure.findMany({
    where: { schoolId: user.schoolId },
    include: {
      class: true,
      items: true,
      _count: { select: { studentFees: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ structures });
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

    const structure = await db.feeStructure.create({
      data: {
        name,
        classId: classId || null,
        schoolId: user.schoolId,
        term,
        dueDate: dueDate || null,
        totalAmount,
        items:
          cleanItems.length > 0 ? { create: cleanItems } : undefined,
      },
      include: { items: true, class: true },
    });

    return NextResponse.json({ structure }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create fee structure" },
      { status: 500 }
    );
  }
}
