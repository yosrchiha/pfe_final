"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export const DARK = {
  bg:          "#0f1117",
  bgSecondary: "#141921",
  bgCard:      "#1a2030",
  border:      "#1e2538",
  text:        "#f1f5f9",
  textMuted:   "#94a3b8",
  textFaint:   "#475569",
  input:       "#141921",
  inputBorder: "#1e2538",
  name: "dark",
} as const;

export const LIGHT = {
  bg:          "#f4f6fb",
  bgSecondary: "#ffffff",
  bgCard:      "#ffffff",
  border:      "#e2e8f0",
  text:        "#0f172a",
  textMuted:   "#475569",
  textFaint:   "#94a3b8",
  input:       "#ffffff",
  inputBorder: "#e2e8f0",
  name: "light",
} as const;

// Définir le type Theme comme l'union des deux
export type ThemeType = typeof DARK | typeof LIGHT;

interface ThemeCtx {
  theme: ThemeType;
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
    const saved = localStorage.getItem("theme");
    if (saved === "light") setIsDark(false);
  }, []);

  const toggle = () => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem("theme", newValue ? "dark" : "light");
      return newValue;
    });
  };

  return (
    <Ctx.Provider value={{ theme: isDark ? DARK : LIGHT, toggle, isDark }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}