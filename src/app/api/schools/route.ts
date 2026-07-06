import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/schools — super_admin only: list all schools with counts
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schools = await db.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          students: true,
          staff: true,
          classes: true,
        },
      },
    },
  });

  // Compute fee revenue per school
  const result = await Promise.all(
    schools.map(async (s) => {
      const studentFees = await db.studentFee.findMany({
        where: { student: { schoolId: s.id } },
        select: { paidAmount: true, dueAmount: true, totalAmount: true },
      });
      const totalRevenue = studentFees.reduce((sum, f) => sum + f.paidAmount, 0);
      const totalDue = studentFees.reduce((sum, f) => sum + f.dueAmount, 0);
      const totalExpected = studentFees.reduce((sum, f) => sum + f.totalAmount, 0);

      // Subscription badge heuristic: created within 30 days => Trial, else Active
      const ageDays = Math.floor(
        (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const subscription = ageDays <= 30 ? "Trial" : "Active";

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        email: s.email,
        logo: s.logo,
        establishedDate: s.establishedDate,
        createdAt: s.createdAt,
        counts: {
          students: s._count.students,
          staff: s._count.staff,
          classes: s._count.classes,
        },
        revenue: {
          total: Math.round(totalRevenue),
          due: Math.round(totalDue),
          expected: Math.round(totalExpected),
        },
        subscription,
      };
    })
  );

  return NextResponse.json({ schools: result });
}

// POST /api/schools — super_admin only: create a new school
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "School name is required" }, { status: 400 });
  }

  try {
    const school = await db.school.create({
      data: {
        name: body.name.trim(),
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        logo: body.logo?.trim() || null,
        establishedDate: body.establishedDate || null,
      },
    });
    return NextResponse.json(school, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
