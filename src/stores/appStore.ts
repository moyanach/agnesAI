import { create } from "zustand";

export type View = "dashboard" | "chat" | "image" | "video" | "settings";
export type ThemeMode = "light" | "dark" | "system";

interface AppState {
  activeView: View;
  setActiveView: (view: View) => void;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),
  theme: "system",
  setTheme: (mode) => set({ theme: mode }),
}));
