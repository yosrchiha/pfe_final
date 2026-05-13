"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";

const NAV = [
  { href: "/admin-pages",                      icon: "⬡",  label: "Dashboard",        sub: "Vue d'ensemble" },
  { href: "/admin-pages/users",                icon: "◈",  label: "Utilisateurs",     sub: "Gestion des comptes" },
  { href: "/admin-pages/depots",               icon: "▣",  label: "Dépôts",           sub: "Tous les projets" },
  { href: "/admin-pages/analyses",             icon: "◉",  label: "Analyses IA",      sub: "Branche complète" },
  { href: "/admin-pages/diffs",                icon: "⇄",  label: "Analyse Diff",     sub: "Comparaison branches" },
  { href: "/admin-pages/tests",                icon: "◎",  label: "Tests Générés",    sub: "Tests unitaires LLM" },
  { href: "/admin-pages/mrs",                  icon: "⊕",  label: "Merge Requests",   sub: "Créées par l'IA" },
  { href: "/admin-pages/stats",                icon: "◈",  label: "Statistiques",     sub: "Métriques globales" },
  { href: "/admin-pages/platform-status", label: "État Plateforme IA" },
  { label: "──────", divider: true },
  // ── Section Exploration ────────────────────────────────────────
  { href: "/admin-pages/explorations",         icon: "🔭", label: "Explorations",     sub: "Historique explorer" },
  { href: "/admin-pages/corrections",          icon: "🩹", label: "Corrections IA",   sub: "Vulns corrigées" },
  { href: "/admin-pages/mr-explorations",      icon: "⊛",  label: "MR Explorer",      sub: "MR via explorateur" },
  { label: "──────", divider: true },
  { href: "/admin-pages/new-analyse",          icon: "▶",  label: "Lancer Analyse",   sub: "Analyse simple",  action: true },
  { href: "/admin-pages/new-diff",             icon: "⇌",  label: "Lancer Diff",      sub: "Analyse diff",    action: true },
  { href: "/admin-pages/explorer",             icon: "⊞",  label: "Explorer",         sub: "Parcourir le code", action: true },
  { label: "──────", divider: true },
  { href: "/dashboard",                        icon: "←",  label: "Espace client",    sub: "Retour au dashboard" },
];

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, isDark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: theme.bg, fontFamily: "'Syne', sans-serif",
      transition: "background 0.3s ease",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${theme.bg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.cardBorder}; border-radius: 4px; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: none; } }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 10px;
          cursor: pointer; transition: all 0.18s;
          text-decoration: none; color: inherit;
          border: 1px solid transparent; position: relative;
        }
        .nav-item:hover {
          background: ${isDark ? "rgba(91,99,245,0.08)" : "rgba(99,102,241,0.06)"};
          border-color: ${isDark ? "rgba(91,99,245,0.15)" : "rgba(99,102,241,0.15)"};
        }
        .nav-item.active {
          background: ${isDark ? "rgba(91,99,245,0.14)" : "rgba(99,102,241,0.1)"};
          border-color: ${isDark ? "rgba(91,99,245,0.3)" : "rgba(99,102,241,0.25)"};
        }
        .theme-toggle-btn:hover { opacity: 0.8; transform: scale(0.97); }
        .theme-toggle-btn { transition: all 0.2s ease; }
      `}</style>

      {/* ══ SIDEBAR ══ */}
      <div style={{
        width: collapsed ? 64 : 240,
        minHeight: "100vh", background: theme.sidebar,
        borderRight: `1px solid ${theme.cardBorder}`,
        display: "flex", flexDirection: "column",
        transition: "width 0.25s ease, background 0.3s",
        flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{ padding: "22px 16px 18px", borderBottom: `1px solid ${theme.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#5b63f5,#9b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 0 22px rgba(91,99,245,0.35)",
          }}>⬡</div>
          {!collapsed && (
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: theme.accentText, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 500 }}>Admin Panel</div>
              <div style={{ color: theme.text, fontSize: 13, fontWeight: 800 }}>AuditPlatform</div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            color: theme.textFaint, fontSize: 14, padding: 4, flexShrink: 0,
          }}>{collapsed ? "→" : "←"}</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item, i) => {
            if (item.divider) return !collapsed
              ? <div key={i} style={{ height: 1, background: theme.cardBorder, margin: "8px 6px" }} />
              : <div key={i} style={{ height: 8 }} />;

            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href!));
            return (
              <a key={item.href} href={item.href} className={`nav-item${isActive ? " active" : ""}${item.action ? " action" : ""}`}>
                <span style={{ fontSize: 16, flexShrink: 0, color: isActive ? theme.accent : item.action ? theme.accent : theme.textFaint, width: 22, textAlign: "center" }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 600, color: isActive ? theme.text : theme.textMuted }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>{item.sub}</div>
                  </div>
                )}
                {isActive && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, background: theme.accent, borderRadius: "0 3px 3px 0" }} />}
              </a>
            );
          })}
        </nav>

        {/* Footer avec toggle */}
        <div style={{ padding: collapsed ? "12px 8px" : "14px 16px", borderTop: `1px solid ${theme.cardBorder}` }}>

          {!collapsed ? (
            <button className="theme-toggle-btn" onClick={toggle} style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "9px 12px", marginBottom: 12,
              background: isDark ? "rgba(91,99,245,0.1)" : "rgba(99,102,241,0.07)",
              border: `1px solid ${isDark ? "rgba(91,99,245,0.3)" : "#e0e5f0"}`,
              borderRadius: 10, cursor: "pointer",
            }}>
              <div style={{ width: 38, height: 21, borderRadius: 11, position: "relative", flexShrink: 0,
                background: isDark ? "rgba(91,99,245,0.3)" : "#e2e8f0",
                border: `1px solid ${isDark ? "rgba(91,99,245,0.5)" : "#cbd5e1"}`,
                transition: "background 0.3s",
              }}>
                <div style={{
                  position: "absolute", top: 2.5, width: 14, height: 14, borderRadius: "50%",
                  left: isDark ? 20 : 2, transition: "left 0.3s ease",
                  background: isDark ? "#818cf8" : "#94a3b8",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8,
                }}>
                  {isDark ? "🌙" : "☀️"}
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted }}>{isDark ? "Mode Sombre" : "Mode Clair"}</div>
                <div style={{ fontSize: 9, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace" }}>{isDark ? "Basculer vers le clair" : "Basculer vers le sombre"}</div>
              </div>
            </button>
          ) : (
            <button onClick={toggle} title={isDark ? "Mode clair" : "Mode sombre"} style={{
              width: "100%", background: "none", border: `1px solid ${theme.cardBorder}`,
              borderRadius: 8, cursor: "pointer", fontSize: 16, padding: "7px 0", marginBottom: 10,
              color: theme.textFaint, transition: "all 0.2s",
            }}>
              {isDark ? "☀️" : "🌙"}
            </button>
          )}

          {!collapsed && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "blink 2.5s ease-in-out infinite" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: theme.textFaint, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Système opérationnel
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: theme.textFaint, opacity: 0.5 }}>PFE 2025 · Neopolis</div>
            </>
          )}
        </div>
      </div>

      {/* ══ MAIN CONTENT ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "hidden", transition: "background 0.3s" }}>
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LayoutInner>{children}</LayoutInner>
    </ThemeProvider>
  );
}

export { useTheme } from "./ThemeContext";
