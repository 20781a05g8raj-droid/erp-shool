import { db } from "./db";
import { cookies, headers } from "next/headers";
import type { Role, User } from "@/types";

// Demo password check (in production use bcrypt/argon2)
export function verifyPassword(input: string, stored: string): boolean {
  // stored format: "demo:<plain>"
  if (stored.startsWith("demo:")) {
    return input === stored.slice(5);
  }
  return false;
}

// Server-side: get current user from cookie OR x-user-id header
// (header fallback needed for iframe/preview environments where third-party cookies are blocked)
export async function getCurrentUser(): Promise<User | null> {
  try {
    // 1. Try cookie first
    const cookieStore = await cookies();
    let userId = cookieStore.get("erp_user_id")?.value;

    // 2. Fallback to x-user-id header (set by client from localStorage)
    if (!userId) {
      const headerStore = await headers();
      userId = headerStore.get("x-user-id") || undefined;
    }

    if (!userId) return null;

    const profile = await db.profile.findUnique({
      where: { id: userId },
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

    if (!profile || profile.status !== "active") return null;

    return profile as User;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set("erp_user_id", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("erp_user_id");
}

// Role-based module access control
export const ROLE_MODULES: Record<Role, string[]> = {
  super_admin: [
    "dashboard", "schools", "students", "staff", "classes", "attendance",
    "timetable", "exams", "homework", "fees", "library", "transport",
    "hr", "notices", "certificates", "reports",
  ],
  school_admin: [
    "dashboard", "students", "staff", "classes", "attendance", "timetable",
    "exams", "homework", "fees", "library", "transport", "hr", "notices",
    "certificates", "reports",
  ],
  teacher: [
    "dashboard", "attendance", "timetable", "exams", "homework", "students", "notices",
  ],
  student: [
    "dashboard", "attendance", "timetable", "exams", "homework", "fees", "notices",
  ],
  parent: [
    "dashboard", "attendance", "fees", "homework", "notices", "transport",
  ],
  accountant: ["dashboard", "fees", "students", "reports"],
  librarian: ["dashboard", "library"],
  transport_manager: ["dashboard", "transport", "students"],
  hr: ["dashboard", "staff", "hr"],
};
