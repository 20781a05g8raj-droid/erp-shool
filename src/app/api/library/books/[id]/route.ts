import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/library/books/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: book, error } = await supabaseAdmin
    .from("library_books")
    .select(
      "*, book_issues(*, students(id, first_name, last_name, admission_number))"
    )
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (error || !book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Sort issues desc by created_at and limit to 20
  const issues = (book.book_issues as Array<Record<string, unknown>>) || [];
  issues.sort((a, b) => {
    const ca = (a.created_at as string) || "";
    const cb = (b.created_at as string) || "";
    return cb.localeCompare(ca);
  });
  book.book_issues = issues.slice(0, 20);

  return NextResponse.json(toCamelCase(book as Record<string, unknown>));
}

// PUT /api/library/books/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: existing, error: existError } = await supabaseAdmin
    .from("library_books")
    .select("id, total_copies, available_copies, isbn")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const totalCopies =
    body.totalCopies !== undefined ? Number(body.totalCopies) : (existing.total_copies as number);
  if (totalCopies < 1) {
    return NextResponse.json(
      { error: "Total copies must be at least 1" },
      { status: 400 }
    );
  }

  // Recompute availableCopies: keep the issued delta consistent.
  const issuedDelta =
    (existing.total_copies as number) - (existing.available_copies as number);
  const newAvailable = Math.max(0, totalCopies - issuedDelta);

  // ISBN uniqueness within school (excluding current id)
  if (
    body.isbn &&
    typeof body.isbn === "string" &&
    body.isbn.trim() &&
    body.isbn.trim() !== existing.isbn
  ) {
    const { data: conflict } = await supabaseAdmin
      .from("library_books")
      .select("id")
      .eq("school_id", user.schoolId)
      .eq("isbn", body.isbn.trim())
      .neq("id", id)
      .maybeSingle();
    if (conflict) {
      return NextResponse.json(
        { error: "A book with this ISBN already exists" },
        { status: 400 }
      );
    }
  }

  try {
    const { data: updated, error } = await supabaseAdmin
      .from("library_books")
      .update({
        title: body.title.trim(),
        author: body.author?.trim() || null,
        isbn: body.isbn?.trim() || null,
        category: body.category?.trim() || null,
        publisher: body.publisher?.trim() || null,
        total_copies: totalCopies,
        available_copies: newAvailable,
        cover_image: body.coverImage?.trim() || null,
        shelf_location: body.shelfLocation?.trim() || null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Failed to update book" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      toCamelCase(updated as Record<string, unknown>)
    );
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
  const { data: existing, error: existError } = await supabaseAdmin
    .from("library_books")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (existError || !existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Block if any active (non-returned) issues exist
  const { count: activeIssues } = await supabaseAdmin
    .from("book_issues")
    .select("*", { count: "exact", head: true })
    .eq("book_id", id)
    .in("status", ["issued", "overdue"]);

  if ((activeIssues || 0) > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete book: ${activeIssues} active issue(s) still pending`,
      },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabaseAdmin
      .from("library_books")
      .delete()
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "Failed to delete book" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
