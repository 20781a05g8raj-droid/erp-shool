"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { LoginScreen } from "@/components/auth/login-screen";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function Home() {
  const { user, loading, fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <DashboardShell />;
}
