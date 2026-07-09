import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, toCamelCase } from "@/lib/supabase/admin";
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

  let query = supabaseAdmin
    .from("book_issues")
    .select(
      "*, books!inner(id, school_id, title, author, isbn, category), students(id, first_name, last_name, admission_number, classes(id, name), sections(id, name))"
    )
    .eq("books.school_id", schoolId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (studentId) query = query.eq("student_id", studentId);

  const { data: issuesRaw, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }

  const issues = (issuesRaw || []) as Array<Record<string, unknown>>;

  // Compute live fine + overdue status for active issues
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const enriched = issues.map((issue) => {
    if ((issue.status as string) === "returned") return issue;
    const due = new Date(issue.due_date as string);
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

  return NextResponse.json(
    toCamelCase(enriched as Record<string, unknown>[])
  );
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
  const { data: book, error: bookError } = await supabaseAdmin
    .from("library_books")
    .select("id, available_copies, title")
    .eq("id", bookId)
    .eq("school_id", user.schoolId)
    .maybeSingle();

  if (bookError || !book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if ((book.available_copies as number) <= 0) {
    return NextResponse.json(
      { error: "No copies available for issue" },
      { status: 400 }
    );
  }

  // Verify student belongs to same school (if provided)
  if (studentId) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name")
      .eq("id", studentId)
      .eq("school_id", user.schoolId)
      .maybeSingle();
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }
  }

  // Issue + decrement availableCopies (sequentially since Supabase JS client has no transactions)
  try {
    const { data: issue, error: issueError } = await supabaseAdmin
      .from("book_issues")
      .insert({
        book_id: bookId,
        student_id: studentId || null,
        staff_id: staffId || null,
        borrower_name: borrowerName || null,
        issue_date: issueDate,
        due_date: dueDate,
        status: "issued",
        fine: 0,
      })
      .select(
        "*, books(id, title, author, isbn, category), students(id, first_name, last_name, admission_number, classes(id, name), sections(id, name))"
      )
      .single();

    if (issueError || !issue) {
      return NextResponse.json(
        { error: "Failed to issue book" },
        { status: 500 }
      );
    }

    // Decrement available_copies
    const newAvailable = Math.max(0, (book.available_copies as number) - 1);
    const { error: updateError } = await supabaseAdmin
      .from("library_books")
      .update({ available_copies: newAvailable })
      .eq("id", bookId);

    if (updateError) {
      // Best effort: rollback issue
      await supabaseAdmin.from("book_issues").delete().eq("id", issue.id);
      return NextResponse.json(
        { error: "Failed to update book inventory" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      toCamelCase(issue as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to issue book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
