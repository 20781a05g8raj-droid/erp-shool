import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  const { data: issue, error: issueError } = await supabaseAdmin
    .from("book_issues")
    .select("*, books!inner(id, school_id, title)")
    .eq("id", id)
    .eq("books.school_id", user.schoolId)
    .maybeSingle();

  if (issueError || !issue) {
    return NextResponse.json(
      { error: "Issue record not found" },
      { status: 404 }
    );
  }
  if ((issue.status as string) === "returned") {
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
  const due = new Date(issue.due_date as string);
  due.setHours(0, 0, 0, 0);

  let fine = 0;
  if (returnDate > due) {
    const daysOverdue = Math.floor(
      (returnDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );
    fine = daysOverdue * 2;
  }

  try {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("book_issues")
      .update({
        return_date: returnDateStr,
        status: "returned",
        fine,
      })
      .eq("id", id)
      .select(
        "*, books(id, title, author, isbn, category), students(id, first_name, last_name, admission_number, classes(id, name), sections(id, name))"
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to return book" },
        { status: 500 }
      );
    }

    // Increment available_copies
    const { data: book } = await supabaseAdmin
      .from("library_books")
      .select("available_copies")
      .eq("id", issue.book_id as string)
      .maybeSingle();

    if (book) {
      const newAvailable = (book.available_copies as number) + 1;
      await supabaseAdmin
        .from("library_books")
        .update({ available_copies: newAvailable })
        .eq("id", issue.book_id as string);
    }

    return NextResponse.json(
      toCamelCase(updated as Record<string, unknown>)
    );
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
  const { data: issue, error: issueError } = await supabaseAdmin
    .from("book_issues")
    .select("id, book_id, status, books!inner(school_id)")
    .eq("id", id)
    .eq("books.school_id", user.schoolId)
    .maybeSingle();

  if (issueError || !issue) {
    return NextResponse.json(
      { error: "Issue record not found" },
      { status: 404 }
    );
  }

  try {
    if ((issue.status as string) !== "returned") {
      const { data: book } = await supabaseAdmin
        .from("library_books")
        .select("available_copies")
        .eq("id", issue.book_id as string)
        .maybeSingle();
      if (book) {
        const newAvailable = (book.available_copies as number) + 1;
        await supabaseAdmin
          .from("library_books")
          .update({ available_copies: newAvailable })
          .eq("id", issue.book_id as string);
      }
    }
    const { error } = await supabaseAdmin
      .from("book_issues")
      .delete()
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "Failed to delete issue record" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete issue record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
