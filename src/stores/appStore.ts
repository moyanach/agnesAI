import { create } from "zustand";

export type View = "chat" | "settings";
export type ThemeMode = "light" | "dark" | "system";

interface AppState {
  activeView: View;
  setActiveView: (view: View) => void;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  currentWorkDir: string | null;
  setCurrentWorkDir: (dir: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "chat",
  setActiveView: (view) => set({ activeView: view }),
  theme: "system",
  setTheme: (mode) => set({ theme: mode }),
  currentWorkDir: null,
  setCurrentWorkDir: (dir) => set({ currentWorkDir: dir }),
}));
