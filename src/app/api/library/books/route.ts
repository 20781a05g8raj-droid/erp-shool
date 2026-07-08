import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  let query = supabaseAdmin
    .from("library_books")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%,publisher.ilike.%${search}%`
    );
  }

  const { data: booksRaw, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch books" }, { status: 500 });
  }

  // Compute issue count for each book
  const books = await Promise.all(
    (booksRaw || []).map(async (b: Record<string, unknown>) => {
      const { count } = await supabaseAdmin
        .from("book_issues")
        .select("*", { count: "exact", head: true })
        .eq("book_id", b.id as string);
      b._count = { issues: count || 0 };
      return b;
    })
  );

  return NextResponse.json(toCamelCase(books as Record<string, unknown>[]));
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
    const { data: conflict } = await supabaseAdmin
      .from("library_books")
      .select("id")
      .eq("school_id", schoolId)
      .eq("isbn", body.isbn.trim())
      .maybeSingle();
    if (conflict) {
      return NextResponse.json(
        { error: "A book with this ISBN already exists" },
        { status: 400 }
      );
    }
  }

  try {
    const { data: book, error } = await supabaseAdmin
      .from("library_books")
      .insert({
        title: body.title.trim(),
        author: body.author?.trim() || null,
        isbn: body.isbn?.trim() || null,
        category: body.category?.trim() || null,
        publisher: body.publisher?.trim() || null,
        total_copies: totalCopies,
        available_copies: totalCopies,
        cover_image: body.coverImage?.trim() || null,
        shelf_location: body.shelfLocation?.trim() || null,
        school_id: schoolId,
      })
      .select("*")
      .single();

    if (error || !book) {
      return NextResponse.json(
        { error: "Failed to create book" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(book as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
