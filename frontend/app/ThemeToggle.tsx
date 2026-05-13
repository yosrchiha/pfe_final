"use client";
import { useTheme } from "@/app/ThemeContext";
// OU si le fichier est dans app/ directement :
// import { useTheme } from "../ThemeContext";

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px",
        background: "transparent",
        border: "1px solid currentColor",
        borderRadius: 20, cursor: "pointer",
        fontSize: 13, opacity: 0.7,
        transition: "opacity 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
    >
      {isDark ? "☀️" : "🌙"}
      <span style={{ fontSize: 12 }}>{isDark ? "Clair" : "Sombre"}</span>
    </button>
  );
}
