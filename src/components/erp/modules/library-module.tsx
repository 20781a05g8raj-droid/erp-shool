"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Library,
  BookOpen,
  BookCheck,
  Layers,
  Search,
  Pencil,
  Trash2,
  BookMarked,
  RotateCcw,
  History,
  Hash,
  MapPin,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch, formatDate, formatCurrency, STATUS_COLORS } from "@/lib/api";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { StatsCard } from "@/components/erp/stats-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ============ Types ============
interface LibraryBookRow {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  publisher?: string | null;
  totalCopies: number;
  availableCopies: number;
  coverImage?: string | null;
  shelfLocation?: string | null;
  createdAt: string;
  _count?: { issues: number };
}

interface StudentLite {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

interface BookLite {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
}

interface BookIssueRow {
  id: string;
  bookId: string;
  studentId?: string | null;
  staffId?: string | null;
  borrowerName?: string | null;
  issueDate: string;
  dueDate: string;
  returnDate?: string | null;
  fine: number;
  status: string;
  daysOverdue?: number;
  book?: BookLite | null;
  student?: StudentLite | null;
}

// ============ Constants ============
const COMMON_CATEGORIES = [
  "Fiction",
  "Non-Fiction",
  "Science",
  "Mathematics",
  "History",
  "Geography",
  "Literature",
  "Biography",
  "Reference",
  "Comics",
  "Children",
  "Religion",
  "Philosophy",
  "Technology",
  "Business",
  "Arts",
  "Sports",
  "Other",
];

const FINE_PER_DAY = 2;

const EMPTY_BOOK_FORM = {
  title: "",
  author: "",
  isbn: "",
  category: "",
  publisher: "",
  totalCopies: 1,
  shelfLocation: "",
  coverImage: "",
};

// ============ Helpers ============
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}
function computeFine(issue: BookIssueRow): { fine: number; daysOverdue: number; overdue: boolean } {
  if (issue.status === "returned") {
    return { fine: issue.fine || 0, daysOverdue: 0, overdue: false };
  }
  const refDate = issue.returnDate || todayISO();
  const days = daysBetween(issue.dueDate, refDate);
  if (days > 0) {
    return { fine: days * FINE_PER_DAY, daysOverdue: days, overdue: true };
  }
  return { fine: 0, daysOverdue: 0, overdue: false };
}

// =================================================================
// LibraryModule
// =================================================================
export function LibraryModule() {
  const [activeTab, setActiveTab] = useState("catalog");

  // Catalog state
  const [books, setBooks] = useState<LibraryBookRow[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookForm, setBookForm] = useState<typeof EMPTY_BOOK_FORM>(EMPTY_BOOK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);

  // Issue/Return state
  const [issues, setIssues] = useState<BookIssueRow[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [issueForm, setIssueForm] = useState({
    bookId: "",
    studentId: "",
    issueDate: todayISO(),
    dueDate: addDaysISO(7),
  });
  const [issuing, setIssuing] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<BookIssueRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  // ---------- Fetchers ----------
  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter && categoryFilter !== "all")
        params.set("category", categoryFilter);
      const data = await apiFetch<LibraryBookRow[]>(
        `/api/library/books?${params.toString()}`
      );
      setBooks(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load books");
    } finally {
      setLoadingBooks(false);
    }
  }, [search, categoryFilter]);

  const fetchIssues = useCallback(async () => {
    setLoadingIssues(true);
    try {
      const data = await apiFetch<BookIssueRow[]>(`/api/library/issues`);
      setIssues(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await apiFetch<BookIssueRow[]>(`/api/library/issues?status=all`);
      setHistory(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const data = await apiFetch<StudentLite[]>(
        `/api/students?search=${encodeURIComponent(studentSearch)}`
      );
      setStudents(data);
    } catch {
      /* silent */
    }
  }, [studentSearch]);

  // ---------- Effects ----------
  // Debounced search for books catalog
  useEffect(() => {
    const t = setTimeout(() => {
      fetchBooks();
    }, 300);
    return () => clearTimeout(t);
  }, [search, categoryFilter, fetchBooks]);

  useEffect(() => {
    if (activeTab === "issues") {
      fetchIssues();
    }
  }, [activeTab, fetchIssues]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  useEffect(() => {
    if (activeTab !== "issues") return;
    const t = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch, activeTab, fetchStudents]);

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const totalBooks = books.length;
    const totalCopies = books.reduce((s, b) => s + b.totalCopies, 0);
    const availableCopies = books.reduce((s, b) => s + b.availableCopies, 0);
    const issuedCopies = totalCopies - availableCopies;
    const categories = new Set(
      books.map((b) => b.category).filter(Boolean) as string[]
    ).size;
    return { totalBooks, totalCopies, availableCopies, issuedCopies, categories };
  }, [books]);

  // Derived available books for issue dropdown
  const availableBooks = useMemo(
    () => books.filter((b) => b.availableCopies > 0),
    [books]
  );

  // Currently issued (active)
  const currentlyIssued = useMemo(
    () => issues.filter((i) => i.status !== "returned"),
    [issues]
  );

  // History filtered
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return history.filter((i) => {
      if (historyStatusFilter !== "all" && i.status !== historyStatusFilter)
        return false;
      if (!q) return true;
      const title = i.book?.title?.toLowerCase() || "";
      const borrower =
        (i.student
          ? `${i.student.firstName} ${i.student.lastName}`.toLowerCase()
          : i.borrowerName?.toLowerCase() || "");
      return title.includes(q) || borrower.includes(q);
    });
  }, [history, historySearch, historyStatusFilter]);

  // ---------- Handlers ----------
  const openAddBook = () => {
    setEditingBookId(null);
    setBookForm(EMPTY_BOOK_FORM);
    setBookDialogOpen(true);
  };

  const openEditBook = (book: LibraryBookRow) => {
    setEditingBookId(book.id);
    setBookForm({
      title: book.title,
      author: book.author || "",
      isbn: book.isbn || "",
      category: book.category || "",
      publisher: book.publisher || "",
      totalCopies: book.totalCopies,
      shelfLocation: book.shelfLocation || "",
      coverImage: book.coverImage || "",
    });
    setBookDialogOpen(true);
  };

  const submitBook = async () => {
    if (!bookForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (bookForm.totalCopies < 1) {
      toast.error("Total copies must be at least 1");
      return;
    }
    setSubmitting(true);
    try {
      if (editingBookId) {
        await apiFetch(`/api/library/books/${editingBookId}`, {
          method: "PUT",
          body: JSON.stringify(bookForm),
        });
        toast.success("Book updated");
      } else {
        await apiFetch(`/api/library/books`, {
          method: "POST",
          body: JSON.stringify(bookForm),
        });
        toast.success("Book added");
      }
      setBookDialogOpen(false);
      await fetchBooks();
      await fetchIssues();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save book");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteBook = async () => {
    if (!deleteBookId) return;
    try {
      await apiFetch(`/api/library/books/${deleteBookId}`, { method: "DELETE" });
      toast.success("Book deleted");
      setDeleteBookId(null);
      await fetchBooks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete book");
    }
  };

  const handleIssue = async () => {
    if (!issueForm.bookId) {
      toast.error("Select a book to issue");
      return;
    }
    if (!issueForm.studentId) {
      toast.error("Select a student");
      return;
    }
    if (issueForm.dueDate < issueForm.issueDate) {
      toast.error("Due date cannot be before issue date");
      return;
    }
    setIssuing(true);
    try {
      const student = students.find((s) => s.id === issueForm.studentId);
      await apiFetch(`/api/library/issues`, {
        method: "POST",
        body: JSON.stringify({
          bookId: issueForm.bookId,
          studentId: issueForm.studentId,
          borrowerName: student
            ? `${student.firstName} ${student.lastName}`
            : undefined,
          issueDate: issueForm.issueDate,
          dueDate: issueForm.dueDate,
        }),
      });
      toast.success("Book issued");
      setIssueForm({
        bookId: "",
        studentId: "",
        issueDate: todayISO(),
        dueDate: addDaysISO(7),
      });
      await Promise.all([fetchBooks(), fetchIssues()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue book");
    } finally {
      setIssuing(false);
    }
  };

  const handleReturn = async (issueId: string) => {
    setReturningId(issueId);
    try {
      await apiFetch(`/api/library/issues/${issueId}`, {
        method: "PUT",
        body: JSON.stringify({ returnDate: todayISO() }),
      });
      toast.success("Book returned");
      await Promise.all([fetchBooks(), fetchIssues()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return book");
    } finally {
      setReturningId(null);
    }
  };

  // ---------- Render ----------
  return (
    <div>
      <PageHeader
        title="Library"
        description="Manage book catalog, issue/return, and fines."
        icon={Library}
        actionLabel="Add Book"
        onAction={openAddBook}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="catalog">
            <BookOpen className="w-4 h-4 mr-1.5" />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="issues">
            <BookCheck className="w-4 h-4 mr-1.5" />
            Issue / Return
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-1.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ============ Catalog Tab ============ */}
        <TabsContent value="catalog" className="mt-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total Books"
              value={stats.totalBooks}
              icon={Library}
              color="text-indigo-600"
              delay={0}
            />
            <StatsCard
              title="Available Copies"
              value={stats.availableCopies}
              icon={BookOpen}
              color="text-emerald-600"
              delay={0.05}
            />
            <StatsCard
              title="Issued Copies"
              value={stats.issuedCopies}
              icon={BookCheck}
              color="text-blue-600"
              delay={0.1}
            />
            <StatsCard
              title="Categories"
              value={stats.categories}
              icon={Layers}
              color="text-amber-600"
              delay={0.15}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, ISBN, publisher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {COMMON_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Books Grid */}
          {loadingBooks ? (
            <CatalogSkeleton />
          ) : books.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No books found"
              description={
                search || categoryFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Start by adding books to your library catalog."
              }
              actionLabel="Add Book"
              onAction={openAddBook}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {books.map((book, idx) => (
                <BookCard
                  key={book.id}
                  book={book}
                  index={idx}
                  onEdit={() => openEditBook(book)}
                  onDelete={() => setDeleteBookId(book.id)}
                />
              ))}
            </motion.div>
          )}
        </TabsContent>

        {/* ============ Issue/Return Tab ============ */}
        <TabsContent value="issues" className="mt-6 space-y-6">
          {/* Issue a Book */}
          <Card className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookMarked className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Issue a Book</h3>
                <p className="text-xs text-muted-foreground">
                  Select an available book and a student to issue.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Book</Label>
                <Select
                  value={issueForm.bookId}
                  onValueChange={(v) =>
                    setIssueForm((f) => ({ ...f, bookId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an available book" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBooks.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No books available
                      </div>
                    ) : (
                      availableBooks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.title}
                          {b.author ? ` — ${b.author}` : ""} ({b.availableCopies}{" "}
                          avail.)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block">Student</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search student by name / admission no."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={issueForm.studentId}
                    onValueChange={(v) =>
                      setIssueForm((f) => ({ ...f, studentId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No students found
                        </div>
                      ) : (
                        students.slice(0, 50).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.firstName} {s.lastName} ({s.admissionNumber})
                            {s.class ? ` — ${s.class.name}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Issue Date</Label>
                <Input
                  type="date"
                  value={issueForm.issueDate}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Due Date</Label>
                <Input
                  type="date"
                  value={issueForm.dueDate}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button
                onClick={handleIssue}
                disabled={issuing}
                className="gradient-primary text-white"
              >
                {issuing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BookCheck className="w-4 h-4 mr-2" />
                )}
                Issue Book
              </Button>
            </div>
          </Card>

          {/* Currently Issued */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <BookCheck className="w-4 h-4 text-primary" />
                Currently Issued ({currentlyIssued.length})
              </h3>
            </div>

            {loadingIssues ? (
              <IssuesSkeleton />
            ) : currentlyIssued.length === 0 ? (
              <EmptyState
                icon={BookCheck}
                title="No active issues"
                description="All issued books have been returned."
              />
            ) : (
              <Card className="glass-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentlyIssued.map((issue) => {
                      const { fine, daysOverdue, overdue } = computeFine(issue);
                      return (
                        <TableRow key={issue.id}>
                          <TableCell>
                            <div className="font-medium">
                              {issue.book?.title || "—"}
                            </div>
                            {issue.book?.author && (
                              <div className="text-xs text-muted-foreground">
                                {issue.book.author}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {issue.student ? (
                              <div>
                                <div className="font-medium">
                                  {issue.student.firstName}{" "}
                                  {issue.student.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {issue.student.admissionNumber}
                                </div>
                              </div>
                            ) : (
                              issue.borrowerName || "—"
                            )}
                          </TableCell>
                          <TableCell>{formatDate(issue.issueDate)}</TableCell>
                          <TableCell
                            className={cn(
                              overdue && "text-red-600 dark:text-red-400 font-medium"
                            )}
                          >
                            {formatDate(issue.dueDate)}
                          </TableCell>
                          <TableCell>
                            {overdue ? (
                              <Badge
                                className={STATUS_COLORS.overdue}
                                variant="secondary"
                              >
                                {daysOverdue} day(s)
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {fine > 0 ? (
                              <span className="font-medium text-red-600 dark:text-red-400">
                                {formatCurrency(fine)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReturn(issue.id)}
                              disabled={returningId === issue.id}
                            >
                              {returningId === issue.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              Return
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ============ History Tab ============ */}
        <TabsContent value="history" className="mt-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by book title or borrower name..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={historyStatusFilter}
              onValueChange={setHistoryStatusFilter}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingHistory ? (
            <IssuesSkeleton />
          ) : filteredHistory.length === 0 ? (
            <EmptyState
              icon={History}
              title="No issue history"
              description="Issued and returned books will appear here."
            />
          ) : (
            <Card className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Return Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fine Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <div className="font-medium">
                          {issue.book?.title || "—"}
                        </div>
                        {issue.book?.author && (
                          <div className="text-xs text-muted-foreground">
                            {issue.book.author}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {issue.student ? (
                          <div>
                            <div className="font-medium">
                              {issue.student.firstName}{" "}
                              {issue.student.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {issue.student.admissionNumber}
                            </div>
                          </div>
                        ) : (
                          issue.borrowerName || "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(issue.issueDate)}</TableCell>
                      <TableCell>{formatDate(issue.dueDate)}</TableCell>
                      <TableCell>
                        {issue.returnDate ? (
                          formatDate(issue.returnDate)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_COLORS[issue.status] || ""}
                          variant="secondary"
                        >
                          {issue.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {issue.fine > 0 ? (
                          <span className="font-medium">
                            {formatCurrency(issue.fine)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ============ Add/Edit Book Dialog ============ */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBookId ? "Edit Book" : "Add Book"}
            </DialogTitle>
            <DialogDescription>
              {editingBookId
                ? "Update the book details below."
                : "Fill in the details to add a new book to the catalog."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Title *</Label>
              <Input
                value={bookForm.title}
                onChange={(e) =>
                  setBookForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. The Wings of Fire"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Author</Label>
              <Input
                value={bookForm.author}
                onChange={(e) =>
                  setBookForm((f) => ({ ...f, author: e.target.value }))
                }
                placeholder="e.g. A.P.J. Abdul Kalam"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">ISBN</Label>
              <Input
                value={bookForm.isbn}
                onChange={(e) =>
                  setBookForm((f) => ({ ...f, isbn: e.target.value }))
                }
                placeholder="978-3-16-148410-0"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Category</Label>
              <Select
                value={bookForm.category}
                onValueChange={(v) =>
                  setBookForm((f) => ({ ...f, category: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Publisher</Label>
              <Input
                value={bookForm.publisher}
                onChange={(e) =>
                  setBookForm((f) => ({ ...f, publisher: e.target.value }))
                }
                placeholder="e.g. Universities Press"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Total Copies</Label>
              <Input
                type="number"
                min={1}
                value={bookForm.totalCopies}
                onChange={(e) =>
                  setBookForm((f) => ({
                    ...f,
                    totalCopies: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Shelf Location</Label>
              <Input
                value={bookForm.shelfLocation}
                onChange={(e) =>
                  setBookForm((f) => ({ ...f, shelfLocation: e.target.value }))
                }
                placeholder="e.g. A-12 / Rack 3"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Cover Image URL</Label>
              <Input
                value={bookForm.coverImage}
                onChange={(e) =>
                  setBookForm((f) => ({ ...f, coverImage: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBookDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitBook}
              disabled={submitting}
              className="gradient-primary text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBookId ? "Save Changes" : "Add Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete Confirmation ============ */}
      <AlertDialog
        open={!!deleteBookId}
        onOpenChange={(o) => !o && setDeleteBookId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this book?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The book will be permanently removed
              from the catalog. Books with active issues cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBook}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =================================================================
// Sub-components
// =================================================================
function BookCard({
  book,
  index,
  onEdit,
  onDelete,
}: {
  book: LibraryBookRow;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAvailable = book.availableCopies > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="glass-card p-4 h-full flex flex-col hover:shadow-lg transition-shadow">
        <div className="flex gap-3">
          <div className="w-16 h-20 rounded-md overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
            {book.coverImage ? (
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 leading-snug">
              {book.title}
            </h3>
            {book.author && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                by {book.author}
              </p>
            )}
            {book.category && (
              <Badge
                className="mt-1.5 text-[10px]"
                variant="secondary"
              >
                {book.category}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground flex-1">
          {book.isbn && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3 h-3" />
              <span className="truncate">{book.isbn}</span>
            </div>
          )}
          {book.shelfLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{book.shelfLocation}</span>
            </div>
          )}
          {book.publisher && (
            <div className="flex items-center gap-1.5">
              <BookMarked className="w-3 h-3" />
              <span className="truncate">{book.publisher}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
          <Badge
            className={cn(
              "text-[10px]",
              isAvailable
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}
            variant="secondary"
          >
            {book.availableCopies}/{book.totalCopies} available
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="glass-card p-4 h-44 animate-pulse">
          <div className="flex gap-3">
            <div className="w-16 h-20 rounded-md bg-muted/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted/60 rounded w-full" />
              <div className="h-3 bg-muted/60 rounded w-2/3" />
              <div className="h-4 bg-muted/60 rounded w-1/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function IssuesSkeleton() {
  return (
    <Card className="glass-card p-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    </Card>
  );
}
