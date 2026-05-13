"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8001";

interface LoginEvent {
  id: number;
  event_type: "login_success" | "login_failure" | "logout";
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  created_at: string;
  logout_at: string | null;
}

const menuItems = [
  { key: "dashboard",      label: "Tableau de bord", icon: "▦",  href: "/dashboard" },
  { key: "repositories",   label: "Dépôts",          icon: "◈",  href: "/depots" },
  { key: "comparaisons",   label: "Comparaisons",    icon: "📊", href: "/comparaisons" },
  { key: "analyses",       label: "Analyse",         icon: "◎",  href: "/analyse" },
  { key: "videos",         label: "Mes Vidéos",      icon: "🎬", href: "/mes-videos" },
  { key: "rapports",       label: "Mes Rapports",    icon: "📄", href: "/mes-rapports" },
  { key: "connexions",     label: "Mes Connexions",  icon: "🔐", href: "/mes-connexions" },
  { key: "exploration",    label: "Exploration",     icon: "🗂️",  href: "/exploration-history" },
  { key: "tests",          label: "Tests",           icon: "🧪", href: "/TestsPaage" },
  { key: "issues",         label: "Issues",          icon: "◇",  href: "/issues" },
  { key: "merge_requests", label: "Merge Requests",  icon: "⟁",  href: "/merge-requests" },
  { key: "stats",          label: "Statistiques",    icon: "📈", href: "/stats" },
  { key: "calendar",       label: "Calendrier",      icon: "📅", href: "/calendar" },
  { key: "help",           label: "Support",         icon: "💬", href: "/help" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getDuration(loginAt: string, logoutAt: string | null): string {
  if (!logoutAt) return "—";
  const diff = new Date(logoutAt).getTime() - new Date(loginAt).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}min`;
}

function parseUA(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  if (/iPhone|iPad|iOS/i.test(ua)) return "📱 iOS";
  if (/Android/i.test(ua)) return "📱 Android";
  if (/Windows/i.test(ua)) return "🖥️ Windows";
  if (/Mac/i.test(ua)) return "🍎 macOS";
  if (/Linux/i.test(ua)) return "🐧 Linux";
  return "🌐 Navigateur";
}

export default function MesConnexions() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [username, setUsername] = useState("Utilisateur");
  const [events,   setEvents]   = useState<LoginEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [limit,    setLimit]    = useState(20);

  const headers = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: headers() })
      .then(r => setUsername(r.data.username || r.data.email))
      .catch(() => router.push("/login"));
  }, []);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/auth/me/logins?limit=${limit}`, { headers: headers() })
      .then(r => { setEvents(r.data); setLoading(false); })
      .catch(() => { setError("Impossible de charger l'historique."); setLoading(false); });
  }, [limit]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  // ── Palette ──────────────────────────────────────────────────
  const D = {
    bg:         theme.bg,
    sidebar:    theme.bgSecondary,
    card:       theme.bgSecondary,
    border:     theme.border,
    text:       theme.text,
    muted:      theme.textMuted,
    faint:      theme.textFaint,
    navActive:  isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    navHover:   isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
    rowHover:   isDark ? "#1a2030" : "#faf9fe",
  };

  const successCount  = events.filter(e => e.event_type === "login_success").length;
  const failureCount  = events.filter(e => e.event_type === "login_failure").length;
  const logoutCount   = events.filter(e => e.event_type === "logout").length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width:900px) { .sidebar-hide { display:none!important; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .event-row:hover { background: ${D.rowHover} !important; }
      `}</style>

      {/* ══ SIDEBAR ══ */}
      <aside className="sidebar-hide" style={{ width: 260, background: D.sidebar, borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", transition: "background 0.3s" }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${D.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "white" }}>A</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>AuditPlatform</div>
              <div style={{ fontSize: 10, color: D.faint, marginTop: 2 }}>GitLab · IA · PFE 2025</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "24px 16px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          {menuItems.map(item => {
            const isActive = item.key === "connexions";
            return (
              <button key={item.key}
                onClick={() => { if (item.href) router.push(item.href); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "none", width: "100%", textAlign: "left", fontSize: 14, fontWeight: 500, cursor: "pointer", background: isActive ? D.navActive : "transparent", color: isActive ? "#6366f1" : D.muted, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = D.navHover; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 18, width: 28 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div style={{ padding: 20, borderTop: `1px solid ${D.border}` }}>
          <div style={{ marginBottom: 12 }}><ThemeToggle /></div>
          <div onClick={() => router.push("/profile")}
            style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, cursor: "pointer", padding: 8, borderRadius: 12, transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = D.navHover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 16, color: "white" }}>
              {username[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{username}</div>
              <div style={{ fontSize: 11, color: D.faint }}>connecté</div>
            </div>
          </div>
          <button onClick={handleLogout}
            style={{ width: "100%", padding: "8px 12px", background: isDark ? "rgba(239,68,68,0.1)" : "#f1f5f9", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
            ⎋ Déconnexion
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", background: D.sidebar, borderBottom: `1px solid ${D.border}` }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: D.text }}>🔐 Mes Connexions</h1>
            <p style={{ fontSize: 13, color: D.faint, marginTop: 2 }}>Historique de vos sessions et tentatives de connexion</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${D.border}`, background: D.card, color: D.text, fontSize: 13, cursor: "pointer" }}
            >
              <option value={20}>20 dernières</option>
              <option value={50}>50 dernières</option>
              <option value={100}>100 dernières</option>
            </select>
          </div>
        </header>

        <div style={{ padding: "28px 32px", animation: "fadeIn 0.3s ease" }}>

          {/* ── Stats Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Connexions réussies", value: successCount, color: "#10b981", icon: "✅" },
              { label: "Tentatives échouées", value: failureCount, color: "#ef4444", icon: "❌" },
              { label: "Déconnexions",         value: logoutCount,  color: "#6366f1", icon: "⎋" },
              { label: "Total événements",     value: events.length, color: "#f59e0b", icon: "📋" },
            ].map(stat => (
              <div key={stat.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: D.faint, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── Table ── */}
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "50px 160px 130px 1fr 110px 110px", padding: "12px 20px", borderBottom: `1px solid ${D.border}`, background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" }}>
              {["#", "Date", "Statut", "Appareil / IP", "Type", "Durée"].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: D.faint }}>Chargement…</div>
            ) : error ? (
              <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>{error}</div>
            ) : events.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                <div style={{ color: D.muted, fontSize: 15 }}>Aucun événement de connexion trouvé.</div>
              </div>
            ) : (
              events.map((ev, i) => {
                const isSuccess = ev.event_type === "login_success";
                const isFailure = ev.event_type === "login_failure";
                const isLogout  = ev.event_type === "logout";

                const badgeColor = isSuccess ? "#10b981" : isFailure ? "#ef4444" : "#6366f1";
                const badgeBg    = isSuccess
                  ? (isDark ? "rgba(16,185,129,0.12)" : "#d1fae5")
                  : isFailure
                    ? (isDark ? "rgba(239,68,68,0.12)" : "#fee2e2")
                    : (isDark ? "rgba(99,102,241,0.12)" : "#eef2ff");
                const badgeLabel = isSuccess ? "✅ Succès" : isFailure ? "❌ Échec" : "⎋ Déconnexion";
                const typeLabel  = isSuccess ? "Connexion" : isFailure ? "Tentative" : "Logout";

                return (
                  <div key={ev.id} className="event-row"
                    style={{ display: "grid", gridTemplateColumns: "50px 160px 130px 1fr 110px 110px", padding: "14px 20px", borderBottom: `1px solid ${D.border}`, alignItems: "center", transition: "background 0.15s" }}
                  >
                    {/* # */}
                    <span style={{ fontSize: 12, color: D.faint }}>{i + 1}</span>

                    {/* Date */}
                    <span style={{ fontSize: 13, color: D.text }}>{formatDate(ev.created_at)}</span>

                    {/* Statut badge */}
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: badgeBg, color: badgeColor, width: "fit-content" }}>
                      {badgeLabel}
                    </span>

                    {/* Appareil / IP */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {parseUA(ev.user_agent)}
                      </div>
                      {ev.ip_address && (
                        <div style={{ fontSize: 11, color: D.faint, marginTop: 2 }}>
                          📍 {ev.ip_address}
                        </div>
                      )}
                    </div>

                    {/* Type */}
                    <span style={{ fontSize: 12, color: D.muted }}>{typeLabel}</span>

                    {/* Durée */}
                    <span style={{ fontSize: 13, color: D.muted }}>
                      {isSuccess ? getDuration(ev.created_at, ev.logout_at) : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Note sécurité */}
          <div style={{ marginTop: 20, padding: "14px 18px", background: isDark ? "rgba(99,102,241,0.08)" : "#eef2ff", border: `1px solid ${isDark ? "rgba(99,102,241,0.2)" : "#c7d2fe"}`, borderRadius: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18 }}>ℹ️</span>
            <div style={{ fontSize: 13, color: isDark ? "#a5b4fc" : "#4338ca", lineHeight: 1.5 }}>
              Si vous remarquez une connexion suspecte, changez immédiatement votre mot de passe depuis votre <span style={{ fontWeight: 600, cursor: "pointer", textDecoration: "underline" }} onClick={() => router.push("/profile")}>profil</span>.
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
