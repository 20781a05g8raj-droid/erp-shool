import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import type { Role } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const profile = await db.profile.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (profile.status !== "active") {
      return NextResponse.json(
        { error: "Your account has been suspended. Please contact the administrator." },
        { status: 403 }
      );
    }

    if (!verifyPassword(password, profile.password)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await setSessionCookie(profile.id);

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role as Role,
        schoolId: profile.schoolId,
        phone: profile.phone,
        avatar: profile.avatar,
        status: profile.status,
        studentId: profile.studentId,
        staffId: profile.staffId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
