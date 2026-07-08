import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Role } from "@/types";

// POST /api/auth/signup
// User enters email + password + name. System checks if email exists in
// students or staff tables, determines role, creates a Profile, and logs them in.
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if profile already exists (already signed up)
    const existingProfile = await db.profile.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingProfile) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login instead." },
        { status: 400 }
      );
    }

    // Determine role by checking students table first, then staff table
    let role: Role | null = null;
    let schoolId: string | null = null;
    let studentId: string | null = null;
    let staffId: string | null = null;
    let displayName = name?.trim() || "";

    // 1. Check students table (student's own email OR parent's email)
    const student = await db.student.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { parentEmail: normalizedEmail },
        ],
        status: "active",
      },
    });

    if (student) {
      if (student.email === normalizedEmail) {
        role = "student";
      } else if (student.parentEmail === normalizedEmail) {
        role = "parent";
      }
      schoolId = student.schoolId;
      studentId = student.id;
      if (!displayName) {
        displayName = role === "parent" ? `Parent of ${student.firstName}` : `${student.firstName} ${student.lastName}`;
      }
    }

    // 2. If not found in students, check staff table
    if (!role) {
      const staff = await db.staff.findFirst({
        where: { email: normalizedEmail, status: "active" },
      });

      if (staff) {
        schoolId = staff.schoolId;
        staffId = staff.id;
        if (!displayName) {
          displayName = `${staff.firstName} ${staff.lastName}`;
        }
        // Determine role based on staff type + designation
        if (staff.type === "teaching") {
          role = "teacher";
        } else {
          // Non-teaching: map by designation
          const desig = (staff.designation || "").toLowerCase();
          if (desig.includes("accountant") || desig.includes("finance")) {
            role = "accountant";
          } else if (desig.includes("librarian") || desig.includes("library")) {
            role = "librarian";
          } else if (desig.includes("transport")) {
            role = "transport_manager";
          } else if (desig.includes("hr") || desig.includes("human resource")) {
            role = "hr";
          } else if (desig.includes("principal") || desig.includes("admin") || desig.includes("director")) {
            role = "school_admin";
          } else {
            // Default non-teaching staff to HR role (they can view staff directory)
            role = "hr";
          }
        }
      }
    }

    // 3. If email not found in either table
    if (!role || !schoolId) {
      return NextResponse.json(
        {
          error:
            "Your email is not registered in our system. Please contact your school administrator to add you first, then come back to sign up.",
        },
        { status: 403 }
      );
    }

    // Create the profile
    const profile = await db.profile.create({
      data: {
        email: normalizedEmail,
        password: `demo:${password}`, // same format as seed
        name: displayName,
        role,
        schoolId,
        studentId,
        staffId,
        status: "active",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        phone: true,
        avatar: true,
        status: true,
        studentId: true,
        staffId: true,
      },
    });

    return NextResponse.json({
      user: profile,
      message: `Account created successfully! You are registered as ${role.replace("_", " ")}.`,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An error occurred during signup. Please try again." },
      { status: 500 }
    );
  }
}
