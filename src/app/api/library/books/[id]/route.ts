import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/library/books/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const book = await db.libraryBook.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      issues: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
        },
      },
    },
  });

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json(book);
}

// PUT /api/library/books/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.libraryBook.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, totalCopies: true, availableCopies: true, isbn: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const totalCopies =
    body.totalCopies !== undefined ? Number(body.totalCopies) : existing.totalCopies;
  if (totalCopies < 1) {
    return NextResponse.json(
      { error: "Total copies must be at least 1" },
      { status: 400 }
    );
  }

  // Recompute availableCopies: keep the issued delta consistent.
  // delta = oldTotal - oldAvailable (books currently issued)
  // newAvailable = newTotal - delta (but not negative)
  const issuedDelta = existing.totalCopies - existing.availableCopies;
  const newAvailable = Math.max(0, totalCopies - issuedDelta);

  // ISBN uniqueness within school (excluding current id)
  if (body.isbn && typeof body.isbn === "string" && body.isbn.trim() && body.isbn.trim() !== existing.isbn) {
    const conflict = await db.libraryBook.findFirst({
      where: {
        schoolId: user.schoolId,
        isbn: body.isbn.trim(),
        NOT: { id },
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "A book with this ISBN already exists" },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await db.libraryBook.update({
      where: { id },
      data: {
        title: body.title.trim(),
        author: body.author?.trim() || null,
        isbn: body.isbn?.trim() || null,
        category: body.category?.trim() || null,
        publisher: body.publisher?.trim() || null,
        totalCopies,
        availableCopies: newAvailable,
        coverImage: body.coverImage?.trim() || null,
        shelfLocation: body.shelfLocation?.trim() || null,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/library/books/[id] — block if any active issues
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await db.libraryBook.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Block if any active (non-returned) issues exist
  const activeIssues = await db.bookIssue.count({
    where: { bookId: id, status: { in: ["issued", "overdue"] } },
  });
  if (activeIssues > 0) {
    return NextResponse.json(
      { error: `Cannot delete book: ${activeIssues} active issue(s) still pending` },
      { status: 400 }
    );
  }

  try {
    // Delete historical issues first (no cascade on BookIssue? actually it does cascade via onDelete: Cascade)
    await db.libraryBook.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
