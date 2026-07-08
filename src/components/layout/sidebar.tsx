"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, X, LogOut, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getNavItems } from "@/lib/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ mobileOpen, setMobileOpen, collapsed, setCollapsed }: SidebarProps) {
  const { user, currentModule, setModule, logout } = useAuthStore();

  if (!user) return null;
  const navItems = getNavItems(user.role);
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebarWidth = collapsed ? 76 : 264;

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-background/40 backdrop-blur-md z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen z-50 lg:z-30",
          "bg-sidebar/95 backdrop-blur-xl flex flex-col",
          "border-r border-sidebar-border",
          "transform transition-transform duration-300 lg:transform-none",
          "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/30 before:to-transparent",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ width: sidebarWidth }}
      >
        {/* ============== Logo / Brand ============== */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0 relative">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-md">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/25 to-transparent" />
              <GraduationCap className="w-5 h-5 text-white relative" />
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="text-sm font-bold tracking-tight gradient-text whitespace-nowrap leading-tight">
                  EduFlow ERP
                </div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                  Greenwood Intl.
                </div>
              </motion.div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ============== Nav items ============== */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setModule(item.id);
                  setMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group",
                  isActive
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 hover:translate-x-0.5",
                  collapsed && "justify-center hover:translate-x-0"
                )}
                title={collapsed ? item.label : undefined}
              >
                {/* Active background pill (animated, slides between items) */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    className="absolute inset-0 rounded-xl gradient-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}

                {/* Subtle hover background for inactive items */}
                {!isActive && (
                  <span className="absolute inset-0 rounded-xl bg-sidebar-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                {/* Left accent bar for active item */}
                {isActive && (
                  <motion.span
                    layoutId="activeAccentBar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white/80"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}

                <item.icon
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 relative z-10 transition-transform",
                    isActive && "drop-shadow-sm",
                    !isActive && "group-hover:scale-110"
                  )}
                />
                {!collapsed && (
                  <span className={cn("truncate relative z-10", isActive && "font-semibold")}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ============== Collapse toggle (desktop) ============== */}
        <div className="hidden lg:block px-2.5 py-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-all",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* ============== User section ============== */}
        <div className="p-2.5 border-t border-sidebar-border">
          <div
            className={cn(
              "flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/50",
              collapsed && "justify-center p-1.5"
            )}
          >
            {/* Avatar with gradient ring */}
            <div className="relative shrink-0">
              <div className="absolute -inset-0.5 rounded-full gradient-primary opacity-80" />
              <Avatar className="relative w-9 h-9 ring-2 ring-sidebar">
                <AvatarFallback className="gradient-primary text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                <div className="text-xs font-semibold truncate leading-tight">{user.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground truncate">
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
              </motion.div>
            )}

            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-[15px] h-[15px]" />
              </button>
            )}

          </div>
        </div>
      </motion.aside>
    </>
  );
}
