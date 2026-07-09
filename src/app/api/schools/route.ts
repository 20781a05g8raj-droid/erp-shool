import { NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// GET /api/schools — super_admin only: list all schools with counts
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: schoolsRaw, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch schools" }, { status: 500 });
  }

  const schools = (schoolsRaw || []) as Array<Record<string, unknown>>;

  // Compute counts + fee revenue per school
  const result = await Promise.all(
    schools.map(async (s) => {
      const schoolId = s.id as string;

      const [studentsCountRes, staffCountRes, classesCountRes, studentFeesRes] =
        await Promise.all([
          supabaseAdmin
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId),
          supabaseAdmin
            .from("staff")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId),
          supabaseAdmin
            .from("classes")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId),
          supabaseAdmin
            .from("student_fees")
            .select("paid_amount, due_amount, total_amount, student:students(school_id)")
            .eq("student.school_id", schoolId),
        ]);

      const studentFees = (studentFeesRes.data || []) as Array<{
        paid_amount: number;
        due_amount: number;
        total_amount: number;
      }>;
      const totalRevenue = studentFees.reduce(
        (sum, f) => sum + Number(f.paid_amount),
        0
      );
      const totalDue = studentFees.reduce(
        (sum, f) => sum + Number(f.due_amount),
        0
      );
      const totalExpected = studentFees.reduce(
        (sum, f) => sum + Number(f.total_amount),
        0
      );

      // Subscription badge heuristic: created within 30 days => Trial, else Active
      const ageDays = Math.floor(
        (Date.now() - new Date(s.created_at as string).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const subscription = ageDays <= 30 ? "Trial" : "Active";

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        email: s.email,
        logo: s.logo,
        establishedDate: s.established_date,
        createdAt: s.created_at,
        counts: {
          students: studentsCountRes.count || 0,
          staff: staffCountRes.count || 0,
          classes: classesCountRes.count || 0,
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
    const insertRow = {
      name: body.name.trim(),
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      logo: body.logo?.trim() || null,
      established_date: body.establishedDate || null,
    };

    const { data: schoolRaw, error: insertError } = await supabaseAdmin
      .from("schools")
      .insert(insertRow)
      .select("*")
      .single();

    if (insertError || !schoolRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create school" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(schoolRaw as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
