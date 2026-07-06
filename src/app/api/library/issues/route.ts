import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/library/issues — list with optional ?status= filter (include book + student)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const studentId = searchParams.get("studentId");

  // Filter issues by school via the book relation
  const where: Record<string, unknown> = {
    book: { schoolId },
  };
  if (status && status !== "all") where.status = status;
  if (studentId) where.studentId = studentId;

  const issues = await db.bookIssue.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
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
  });

  // Compute live fine + overdue status for active issues
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const enriched = issues.map((issue) => {
    if (issue.status === "returned") return issue;
    const due = new Date(issue.dueDate);
    due.setHours(0, 0, 0, 0);
    if (today > due) {
      const daysOverdue = Math.floor(
        (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...issue,
        status: "overdue",
        fine: daysOverdue * 2,
        daysOverdue,
      };
    }
    return issue;
  });

  return NextResponse.json(enriched);
}

// POST /api/library/issues — issue a book (decrements availableCopies)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { bookId, studentId, staffId, borrowerName, issueDate, dueDate } = body;

  if (!bookId) {
    return NextResponse.json({ error: "Book is required" }, { status: 400 });
  }
  if (!issueDate || !dueDate) {
    return NextResponse.json(
      { error: "Issue date and due date are required" },
      { status: 400 }
    );
  }

  // Verify book belongs to school and has available copies
  const book = await db.libraryBook.findFirst({
    where: { id: bookId, schoolId: user.schoolId },
    select: { id: true, availableCopies: true, title: true },
  });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (book.availableCopies <= 0) {
    return NextResponse.json(
      { error: "No copies available for issue" },
      { status: 400 }
    );
  }

  // Verify student belongs to same school (if provided)
  if (studentId) {
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }
  }

  // Issue + decrement availableCopies atomically
  try {
    const [issue] = await db.$transaction([
      db.bookIssue.create({
        data: {
          bookId,
          studentId: studentId || null,
          staffId: staffId || null,
          borrowerName: borrowerName || null,
          issueDate,
          dueDate,
          status: "issued",
          fine: 0,
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
        where: { id: bookId },
        data: { availableCopies: { decrement: 1 } },
      }),
    ]);
    return NextResponse.json(issue, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to issue book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
