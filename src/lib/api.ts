// Shared API fetcher for client components
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  partial: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  issued: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  returned: "bg-muted text-muted-foreground",
  present: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  absent: "bg-red-500/10 text-red-600 dark:text-red-400",
  late: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  leave: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  halfday: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};
