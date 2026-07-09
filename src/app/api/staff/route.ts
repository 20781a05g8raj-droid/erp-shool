import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

// GET /api/staff — list of staff for the current school.
// Supports filters: ?department=&type=&search=&status=&teaching=true
// Returns: { staff: [{ id, firstName, lastName, employeeId, designation, department, type, status, email, phone, dob, gender, qualification, joiningDate, photo, salary, fullName }] }
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const teachingOnly = searchParams.get("teaching") === "true";
  const department = searchParams.get("department");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  let query = supabaseAdmin
    .from("staff")
    .select(`
      id, first_name, last_name, employee_id, email, phone, dob, gender,
      designation, department, qualification, joining_date, type, photo, salary, status
    `)
    .eq("school_id", user.schoolId)
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (teachingOnly) {
    query = query.eq("type", "teaching");
  }
  if (type) {
    query = query.eq("type", type);
  }
  if (department) {
    query = query.eq("department", department);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    const orClause = [
      `first_name.ilike.%${search}%`,
      `last_name.ilike.%${search}%`,
      `employee_id.ilike.%${search}%`,
      `email.ilike.%${search}%`,
    ].join(",");
    query = query.or(orClause);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staff = (data ?? []).map((s) => {
    const camel = toCamelCase(s) as any;
    return {
      ...camel,
      fullName: `${camel.firstName ?? ""} ${camel.lastName ?? ""}`.trim(),
    };
  });

  return NextResponse.json({ staff });
}

// POST /api/staff — create a new staff member
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only HR, school_admin, super_admin can add staff
  if (!canManageStaff(user.role)) {
    return NextResponse.json({ error: "You don't have permission to manage staff" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Auto-generate employeeId if not provided
    let employeeId = body.employeeId;
    if (!employeeId) {
      // Find all employee_ids for this school, parse the trailing number, pick max + 1
      const { data: existingStaff } = await supabaseAdmin
        .from("staff")
        .select("employee_id")
        .eq("school_id", user.schoolId);

      let nextNum = 1;
      for (const s of existingStaff ?? []) {
        const match = (s.employee_id || "").match(/\d+$/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (!isNaN(n) && n >= nextNum) nextNum = n + 1;
        }
      }
      employeeId = `EMP${String(nextNum).padStart(4, "0")}`;
    }

    // Check uniqueness of employeeId within the school
    const { data: existing } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("employee_id", employeeId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Employee ID already exists" },
        { status: 400 }
      );
    }

    const insertData = {
      employee_id: employeeId,
      first_name: body.firstName?.trim(),
      last_name: body.lastName?.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      dob: body.dob || null,
      gender: body.gender || null,
      designation: body.designation?.trim() || null,
      department: body.department?.trim() || null,
      qualification: body.qualification?.trim() || null,
      joining_date: body.joiningDate || null,
      type: body.type || "teaching",
      photo: body.photo?.trim() || null,
      salary: typeof body.salary === "number" ? body.salary : parseFloat(body.salary) || 0,
      status: body.status || "active",
      school_id: user.schoolId,
    };

    const { data, error } = await supabaseAdmin
      .from("staff")
      .insert(insertData)
      .select("*")
      .single();

    if (error || !data) {
      console.error("Create staff error:", error);
      return NextResponse.json(
        { error: "Failed to create staff member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ staff: toCamelCase(data) }, { status: 201 });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { error: "Failed to create staff member" },
      { status: 500 }
    );
  }
}
