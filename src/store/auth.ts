"use client";

import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  currentModule: string;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setModule: (module: string) => void;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  currentModule: "dashboard",
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setModule: (currentModule) => set({ currentModule }),
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null, currentModule: "dashboard" });
  },
  fetchUser: async () => {
    try {
      set({ loading: true });
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
