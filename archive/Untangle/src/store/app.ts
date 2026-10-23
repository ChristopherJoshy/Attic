"use client";

import { create } from "zustand";
import { api, CurrentUser, Group } from "@/lib/api";

type View = "dashboard" | "group";

interface AppState {
  user: CurrentUser | null;
  loading: boolean;
  view: View;
  currentGroup: Group | null;
  setUser: (u: CurrentUser | null) => void;
  setLoading: (b: boolean) => void;
  setView: (v: View) => void;
  openGroup: (g: Group) => void;
  backToDashboard: () => void;
  logout: () => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  loading: true,
  view: "dashboard",
  currentGroup: null,
  setUser: (u) => set({ user: u }),
  setLoading: (b) => set({ loading: b }),
  setView: (v) => set({ view: v }),
  openGroup: (g) => set({ currentGroup: g, view: "group" }),
  backToDashboard: () => set({ currentGroup: null, view: "dashboard" }),
  logout: async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
    }
    set({ user: null, currentGroup: null, view: "dashboard" });
  },
}));
