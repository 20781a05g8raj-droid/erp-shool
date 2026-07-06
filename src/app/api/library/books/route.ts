import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/library/books — list with optional ?search=&category= filters
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { schoolId };
  if (category && category !== "all") where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { author: { contains: search } },
      { isbn: { contains: search } },
      { publisher: { contains: search } },
    ];
  }

  const books = await db.libraryBook.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: { select: { issues: true } },
    },
  });

  return NextResponse.json(books);
}

// POST /api/library/books — create book
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = user.schoolId;
  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const totalCopies = Number(body.totalCopies) || 1;
  if (totalCopies < 1) {
    return NextResponse.json(
      { error: "Total copies must be at least 1" },
      { status: 400 }
    );
  }

  // ISBN uniqueness within school (if provided)
  if (body.isbn && typeof body.isbn === "string" && body.isbn.trim()) {
    const conflict = await db.libraryBook.findFirst({
      where: { schoolId, isbn: body.isbn.trim() },
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
    const book = await db.libraryBook.create({
      data: {
        title: body.title.trim(),
        author: body.author?.trim() || null,
        isbn: body.isbn?.trim() || null,
        category: body.category?.trim() || null,
        publisher: body.publisher?.trim() || null,
        totalCopies,
        availableCopies: totalCopies,
        coverImage: body.coverImage?.trim() || null,
        shelfLocation: body.shelfLocation?.trim() || null,
        schoolId,
      },
    });
    return NextResponse.json(book, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
