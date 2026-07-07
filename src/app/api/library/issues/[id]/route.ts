import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/library/issues/[id] — return a book
// Body: { returnDate? (defaults to today) }
// Computes fine if returnDate > dueDate (₹2/day), sets status=returned,
// increments availableCopies.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const issue = await db.bookIssue.findFirst({
    where: { id, book: { schoolId: user.schoolId } },
    include: {
      book: { select: { id: true, title: true, schoolId: true } },
    },
  });
  if (!issue) {
    return NextResponse.json({ error: "Issue record not found" }, { status: 404 });
  }
  if (issue.status === "returned") {
    return NextResponse.json(
      { error: "Book already returned" },
      { status: 400 }
    );
  }

  const returnDateStr =
    typeof body.returnDate === "string" && body.returnDate
      ? body.returnDate
      : new Date().toISOString().split("T")[0];

  const returnDate = new Date(returnDateStr);
  returnDate.setHours(0, 0, 0, 0);
  const due = new Date(issue.dueDate);
  due.setHours(0, 0, 0, 0);

  let fine = 0;
  if (returnDate > due) {
    const daysOverdue = Math.floor(
      (returnDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );
    fine = daysOverdue * 2;
  }

  try {
    const [updated] = await db.$transaction([
      db.bookIssue.update({
        where: { id },
        data: {
          returnDate: returnDateStr,
          status: "returned",
          fine,
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
              category: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      }),
      db.libraryBook.update({
        where: { id: issue.bookId },
        data: { availableCopies: { increment: 1 } },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to return book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/library/issues/[id] — admin can remove an erroneous issue record.
// If the issue was active (not returned), restore availableCopies.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const issue = await db.bookIssue.findFirst({
    where: { id, book: { schoolId: user.schoolId } },
    select: { id: true, bookId: true, status: true },
  });
  if (!issue) {
    return NextResponse.json({ error: "Issue record not found" }, { status: 404 });
  }

  try {
    if (issue.status !== "returned") {
      await db.libraryBook.update({
        where: { id: issue.bookId },
        data: { availableCopies: { increment: 1 } },
      });
    }
    await db.bookIssue.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete issue record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
