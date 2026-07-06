import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/reports/students — student demographics, class distribution, gender distribution
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;

  // Get all students (active + alumni/transferred)
  const students = await db.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      gender: true,
      status: true,
      bloodGroup: true,
      classId: true,
      admissionDate: true,
      class: { select: { id: true, name: true, order: true } },
    },
  });

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === "active").length;
  const alumniStudents = students.filter((s) => s.status === "alumni").length;
  const transferredStudents = students.filter((s) => s.status === "transferred").length;

  // Gender distribution
  const genderCounts: Record<string, number> = { male: 0, female: 0, other: 0 };
  for (const s of students) {
    const g = s.gender || "other";
    if (g in genderCounts) {
      genderCounts[g]++;
    } else {
      genderCounts.other++;
    }
  }
  const genderDistribution = [
    { name: "Male", value: genderCounts.male },
    { name: "Female", value: genderCounts.female },
    ...(genderCounts.other > 0 ? [{ name: "Other", value: genderCounts.other }] : []),
  ];

  // Class distribution
  const classMap: Record<string, { name: string; order: number; total: number; male: number; female: number; active: number }> = {};
  for (const s of students) {
    if (!s.class) continue;
    if (!classMap[s.class.id]) {
      classMap[s.class.id] = { name: s.class.name, order: s.class.order, total: 0, male: 0, female: 0, active: 0 };
    }
    classMap[s.class.id].total += 1;
    if (s.gender === "male") classMap[s.class.id].male += 1;
    else if (s.gender === "female") classMap[s.class.id].female += 1;
    if (s.status === "active") classMap[s.class.id].active += 1;
  }
  const classDistribution = Object.values(classMap)
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      class: c.name,
      total: c.total,
      male: c.male,
      female: c.female,
      active: c.active,
    }));

  // Blood group distribution (for fun)
  const bloodGroups: Record<string, number> = {};
  for (const s of students) {
    const bg = s.bloodGroup || "Unknown";
    bloodGroups[bg] = (bloodGroups[bg] || 0) + 1;
  }
  const bloodGroupDistribution = Object.entries(bloodGroups)
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count);

  // Admission trend: last 6 months (new admissions)
  const now = new Date();
  const admissionTrend: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("en-IN", { month: "short" });
    const count = students.filter((s) => s.admissionDate && s.admissionDate.startsWith(prefix)).length;
    admissionTrend.push({ month: monthName, count });
  }

  return NextResponse.json({
    totalStudents,
    activeStudents,
    alumniStudents,
    transferredStudents,
    genderDistribution,
    classDistribution,
    bloodGroupDistribution,
    admissionTrend,
  });
}
