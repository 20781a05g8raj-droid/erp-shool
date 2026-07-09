"use client";

import { useState } from "react";
import {
  Menu, Bell, Search, Sun, Moon, LogOut, ChevronDown, Settings, User as UserIcon,
  CheckCircle2, Info, AlertTriangle, XCircle, Command,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/types";
import { ALL_MODULES } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onMenuClick: () => void;
}

const NOTIF_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  info: { icon: Info, color: "text-sky-500", bg: "bg-sky-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  error: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, currentModule, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);

  if (!user) return null;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const moduleLabel = ALL_MODULES.find((m) => m.id === currentModule)?.label || "Dashboard";

  const notifications = [
    { title: "New fee payment received", time: "5 min ago", type: "success", desc: "₹12,500 — Aarav Sharma, Class 10-A" },
    { title: "Attendance marked for Class 10-A", time: "1 hour ago", type: "info", desc: "28 of 32 students present" },
    { title: "PTM scheduled for Saturday", time: "3 hours ago", type: "info", desc: "10:00 AM — Main Auditorium" },
    { title: "3 fee defaulters this month", time: "1 day ago", type: "warning", desc: "Action required by accounts" },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 px-4 lg:px-6 flex items-center gap-3 bg-background/80 backdrop-blur-xl border-b border-border/70">
      {/* Subtle bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-accent transition-colors text-foreground"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Module title — premium typography */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <h1 className="text-base lg:text-lg font-bold tracking-tight truncate">
          {moduleLabel}
        </h1>
        <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          Live
        </span>
      </div>

      {/* Search — premium */}
      <div className="hidden md:flex relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Search students, staff, classes…"
          className="pl-9 pr-16 w-56 lg:w-72 h-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary/30 transition-all placeholder:text-muted-foreground/70"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 px-1.5 h-5 rounded-md border border-border/70 bg-background/80 text-[10px] font-medium text-muted-foreground">
          <Command className="w-2.5 h-2.5" />
          K
        </kbd>
      </div>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="h-9 w-9 rounded-xl relative overflow-hidden hover:bg-accent"
        aria-label="Toggle theme"
      >
        <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
      </Button>

      {/* Notifications */}
      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl relative hover:bg-accent" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 lg:w-96 p-0 rounded-xl shadow-premium" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="font-semibold text-sm">Notifications</div>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {notifications.length} new
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n, i) => {
              const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.info;
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className="flex gap-3 px-4 py-3 hover:bg-accent/60 transition-colors cursor-pointer border-b border-border/40 last:border-b-0"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", style.bg)}>
                    <Icon className={cn("w-4 h-4", style.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{n.desc}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{n.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-border/60 text-center">
            <button className="text-xs font-medium text-primary hover:underline">
              View all notifications
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-accent transition-colors group">
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-full gradient-primary opacity-60 group-hover:opacity-100 transition-opacity" />
              <Avatar className="relative w-8 h-8 ring-2 ring-background">
                <AvatarFallback className="gradient-primary text-white text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-xs font-semibold">{user.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {ROLE_LABELS[user.role as Role]}
              </div>
            </div>
            <ChevronDown className="hidden md:block w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-0 rounded-xl shadow-premium overflow-hidden" sideOffset={8}>
          {/* User header */}
          <div className="relative p-4 gradient-primary">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/20 text-white text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{user.name}</div>
                <div className="text-[11px] text-white/80 truncate">{user.email}</div>
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-medium backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {ROLE_LABELS[user.role as Role]}
              </span>
            </div>
          </div>

          <div className="p-1">
            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm py-2">
              <UserIcon className="w-4 h-4 mr-2.5 text-muted-foreground" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm py-2">
              <Settings className="w-4 h-4 mr-2.5 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={logout}
              className="rounded-lg cursor-pointer text-sm py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2.5" />
              Sign out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
