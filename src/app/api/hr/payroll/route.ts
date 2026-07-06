import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/hr/payroll — list payrolls with filters (month, year, status)
// Role scoping: teacher sees only their own payrolls
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");

  // Teacher role: lock to their own staffId
  const scopedStaffId =
    user.role === "teacher" && user.staffId ? user.staffId : staffId;

  const where: {
    staff: { schoolId: string; id?: string };
    month?: number;
    year?: number;
    status?: string;
  } = {
    staff: { schoolId: user.schoolId },
  };

  if (scopedStaffId) {
    where.staff.id = scopedStaffId;
  }
  if (month && !isNaN(parseInt(month, 10))) {
    where.month = parseInt(month, 10);
  }
  if (year && !isNaN(parseInt(year, 10))) {
    where.year = parseInt(year, 10);
  }
  if (status && status !== "all") {
    where.status = status;
  }

  const payrolls = await db.payroll.findMany({
    where,
    include: {
      staff: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          designation: true,
          department: true,
          type: true,
          photo: true,
          salary: true,
        },
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ payrolls });
}

// POST /api/hr/payroll — generate payroll for a staff or all
// Body: { staffId?, month, year }
// Computation: basic = staff.salary, allowances = basic*0.20, deductions = basic*0.12, net = basic + allowances - deductions
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { staffId, month, year } = body as {
      staffId?: string;
      month?: number;
      year?: number;
    };

    if (
      typeof month !== "number" ||
      month < 1 ||
      month > 12 ||
      typeof year !== "number"
    ) {
      return NextResponse.json(
        { error: "Valid month (1-12) and year are required" },
        { status: 400 }
      );
    }

    // Gather target staff list
    const staffWhere: { schoolId: string; status?: string; id?: string } = {
      schoolId: user.schoolId,
    };
    // Optionally include inactive staff — but default to all staff in school
    if (staffId) {
      staffWhere.id = staffId;
    }

    const staffList = await db.staff.findMany({
      where: staffWhere,
      select: { id: true, salary: true, employeeId: true },
    });

    if (staffList.length === 0) {
      return NextResponse.json(
        { error: "No staff found" },
        { status: 404 }
      );
    }

    // Determine which staff already have a payroll for this month/year
    const existing = await db.payroll.findMany({
      where: {
        staffId: { in: staffList.map((s) => s.id) },
        month,
        year,
      },
      select: { staffId: true },
    });
    const existingSet = new Set(existing.map((e) => e.staffId));
    const newStaff = staffList.filter((s) => !existingSet.has(s.id));

    if (newStaff.length === 0) {
      return NextResponse.json({
        generated: 0,
        skipped: staffList.length,
        message: "Payroll already generated for the selected staff/month.",
      });
    }

    const toCreate = newStaff.map((s) => {
      const basic = s.salary || 0;
      const allowances = Math.round(basic * 0.2 * 100) / 100;
      const deductions = Math.round(basic * 0.12 * 100) / 100;
      const net = Math.round((basic + allowances - deductions) * 100) / 100;
      return {
        staffId: s.id,
        month,
        year,
        basicSalary: basic,
        allowances,
        deductions,
        netSalary: net,
        status: "pending" as const,
        paidDate: null,
      };
    });

    await db.payroll.createMany({ data: toCreate });

    return NextResponse.json({
      generated: toCreate.length,
      skipped: existingSet.size,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate payroll";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
