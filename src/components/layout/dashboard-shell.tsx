"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ModuleRouter } from "@/components/erp/module-router";
import { Loader2 } from "lucide-react";

export function DashboardShell() {
  const { user, loading, currentModule } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background overflow-x-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentModule}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ModuleRouter />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
