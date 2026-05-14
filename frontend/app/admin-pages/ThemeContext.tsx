"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ── PALETTES ──────────────────────────────────────────────────────
export const DARK = {
  bg:           "#07090f",
  sidebar:      "#0a0c14",
  card:         "#0a0c14",
  cardBorder:   "#1e2235",
  header:       "#0a0c14",
  headerBorder: "#1e2235",
  tableHead:    "#07090f",
  tableRow:     "#0a0c14",
  tableRowAlt:  "#07090f",
  tableBorder:  "#13151e",
  input:        "#07090f",
  inputBorder:  "#1e2235",
  text:         "#f1f3fc",
  textMuted:    "#a8b0d0",
  textFaint:    "#5a6080",
  accent:       "#5b63f5",
  accentText:   "#818cf8",
  name: "dark",
} as const;

export const LIGHT = {
  bg:           "#f4f6fb",
  sidebar:      "#ffffff",
  card:         "#ffffff",
  cardBorder:   "#e2e8f0",
  header:       "#ffffff",
  headerBorder: "#e2e8f0",
  tableHead:    "#f8fafc",
  tableRow:     "#ffffff",
  tableRowAlt:  "#f8fafc",
  tableBorder:  "#f1f5f9",
  input:        "#ffffff",
  inputBorder:  "#e2e8f0",
  text:         "#0f172a",
  textMuted:    "#475569",
  textFaint:    "#94a3b8",
  accent:       "#6366f1",
  accentText:   "#6366f1",
  name: "light",
} as const;

// ✅ Correction : type Theme = typeof DARK | typeof LIGHT (union des deux)
export type Theme = typeof DARK | typeof LIGHT;

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({
  theme: DARK,
  toggle: () => {},
  isDark: true
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("admin_theme");
    if (saved === "light") setIsDark(false);
  }, []);

  const toggle = () => {
    setIsDark(prev => {
      localStorage.setItem("admin_theme", prev ? "light" : "dark");
      return !prev;
    });
  };

  const theme = isDark ? DARK : LIGHT;

  return (
    <Ctx.Provider value={{ theme, toggle, isDark }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}

