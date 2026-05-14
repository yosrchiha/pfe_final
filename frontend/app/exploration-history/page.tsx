"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────
interface Exploration {
  id: number;
  projet_nom: string;
  projet_chemin: string;
  branche: string;
  total_fichiers: number;
  created_at: string;
}

interface Correction {
  id: number;
  fichier_path: string;
  vuln_type: string;
  vuln_severite: string;
  vuln_ligne: number;
  vuln_suggestion?: string;
  statut: string;
  created_at: string;
}

interface MrExploration {
  id: number;
  projet_nom: string;
  projet_chemin: string;
  branche_source: string;
  branche_cible: string;
  titre: string;
  mr_iid_gitlab: number;
  mr_url: string;
  statut: string;
  created_at: string;
  fichiers_modifies?: string | null;
}

interface TicketNotif { id: number; subject: string; status: string; }

type ActiveTab = "explorations" | "corrections" | "mrs";

// ── Sidebar items (same as dashboard) ────────────────────────────────────────
const menuItems = [
  { key: "dashboard",       label: "Tableau de bord", icon: "▦",  href: "/dashboard" },
  { key: "repositories",    label: "Dépôts",          icon: "◈",  href: "/depots" },
  { key: "comparaisons",    label: "Comparaisons",    icon: "📊", href: "/comparaisons" },
  { key: "analyses",        label: "Analyse",         icon: "◎",  href: "/analyse" },
  { key: "tests",           label: "Tests",           icon: "🧪", href: "/TestsPaage" },
  { key: "issues",          label: "Issues",          icon: "◇",  href: "/issues" },
  { key: "merge_requests",  label: "Merge Requests",  icon: "⟁",  href: "/merge-requests" },
  { key: "exploration",     label: "Exploration",     icon: "🗂️",  href: "/exploration-history" },
  { key: "stats",           label: "Statistiques",    icon: "📈", href: "/stats" },
  { key: "calendar",        label: "Calendrier",      icon: "📅", href: "/calendar" },
  { key: "help",            label: "Support",         icon: "💬", href: "/help" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function sevColor(s: string) {
  if (s === "CRITIQUE") return "#ef4444";
  if (s === "HAUTE")    return "#f97316";
  if (s === "MOYENNE")  return "#eab308";
  return "#10b981";
}

function mrStatusStyle(s: string) {
  if (s === "merged") return { bg: "rgba(16,185,129,0.12)",  color: "#10b981",  label: "✓ Merged"  };
  if (s === "closed") return { bg: "rgba(239,68,68,0.12)",   color: "#ef4444",  label: "✕ Closed"  };
  return               { bg: "rgba(99,102,241,0.12)",        color: "#6366f1",  label: "● Open"    };
}

function corrStatusStyle(s: string) {
  if (s === "poussee") return { bg: "rgba(16,185,129,0.12)",  color: "#10b981",  label: "✓ Poussée"  };
  return               { bg: "rgba(99,102,241,0.12)",         color: "#6366f1",  label: "● Appliquée" };
}

function extIcon(path: string): { icon: string; color: string } {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, { icon: string; color: string }> = {
    py:   { icon: "PY",  color: "#3b82f6" },
    ts:   { icon: "TS",  color: "#06b6d4" },
    tsx:  { icon: "TS",  color: "#06b6d4" },
    js:   { icon: "JS",  color: "#f59e0b" },
    jsx:  { icon: "JS",  color: "#f59e0b" },
    java: { icon: "JV",  color: "#ef4444" },
    go:   { icon: "GO",  color: "#0ea5e9" },
    php:  { icon: "PHP", color: "#8b5cf6" },
    html: { icon: "HT",  color: "#f97316" },
    css:  { icon: "CS",  color: "#ec4899" },
    json: { icon: "JS",  color: "#84cc16" },
    md:   { icon: "MD",  color: "#94a3b8" },
  };
  return ext && map[ext] ? map[ext] : { icon: "—", color: "#64748b" };
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateFull(s: string) {
  return new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ExplorationHistoryPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [username,       setUsername]       = useState("Utilisateur");
  const [activeMenu,     setActiveMenu]     = useState("exploration");
  const [activeTab,      setActiveTab]      = useState<ActiveTab>("explorations");
  const [ticketNotifs,   setTicketNotifs]   = useState<TicketNotif[]>([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Data
  const [explorations,   setExplorations]   = useState<Exploration[]>([]);
  const [corrections,    setCorrections]    = useState<Correction[]>([]);
  const [mrs,            setMrs]            = useState<MrExploration[]>([]);

  // Loading
  const [loadingExp,     setLoadingExp]     = useState(true);
  const [loadingCorr,    setLoadingCorr]    = useState(true);
  const [loadingMrs,     setLoadingMrs]     = useState(true);

  // Search / filter
  const [searchExp,      setSearchExp]      = useState("");
  const [searchCorr,     setSearchCorr]     = useState("");
  const [searchMrs,      setSearchMrs]      = useState("");
  const [filterSev,      setFilterSev]      = useState("all");
  const [filterMrStatus, setFilterMrStatus] = useState("all");

  // Selected rows
  const [selectedExp,    setSelectedExp]    = useState<Exploration | null>(null);
  const [selectedCorr,   setSelectedCorr]   = useState<Correction | null>(null);
  const [selectedMr,     setSelectedMr]     = useState<MrExploration | null>(null);

  const headers = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // ── Fetch user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: headers() })
      .then(r => setUsername(r.data.username ?? "Utilisateur"))
      .catch(() => router.push("/login"));
  }, []);

  // ── Fetch notifs ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await axios.get(`${API}/tickets/unread/count`, { headers: headers() });
        setTicketNotifs(r.data.tickets ?? []);
      } catch {}
    };
    fetch();
    const i = setInterval(fetch, 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifs(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Explorations
    axios.get(`${API}/explorer/history`, { headers: headers() })
      .then(r => setExplorations(r.data ?? []))
      .catch(() => setExplorations([]))
      .finally(() => setLoadingExp(false));

    // Corrections
    axios.get(`${API}/explorer/correction/history`, { headers: headers() })
      .then(r => setCorrections(r.data ?? []))
      .catch(() => setCorrections([]))
      .finally(() => setLoadingCorr(false));

    // MRs
    axios.get(`${API}/explorer/mr/history`, { headers: headers() })
      .then(r => setMrs(r.data ?? []))
      .catch(() => setMrs([]))
      .finally(() => setLoadingMrs(false));
  }, []);

    // profile/page.tsx  (ligne 188)
  const handleLogout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }); } catch {}
    localStorage.removeItem("token"); localStorage.removeItem("user_id"); router.push("/login");
  };

  // ── Theme palette (same as dashboard) ─────────────────────────────────────
  const D = {
    bg:        theme.bg,
    sidebar:   theme.bgSecondary,
    card:      theme.bgSecondary,
    border:    theme.border,
    text:      theme.text,
    muted:     theme.textMuted,
    faint:     theme.textFaint,
    tag:       isDark ? "#1e2538" : "#f1f5f9",
    tagText:   isDark ? "#94a3b8" : "#475569",
    navActive: isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    navHover:  isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
    btnSec:    isDark ? "#1e2538" : "#f1f5f9",
    rowHover:  isDark ? "#1a2030" : "#faf9fe",
    detailBg:  isDark ? "#0f1117" : "#f8fafc",
    accent:    "#6366f1",
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredExp = explorations.filter(e =>
    e.projet_nom.toLowerCase().includes(searchExp.toLowerCase()) ||
    e.branche.toLowerCase().includes(searchExp.toLowerCase())
  );

  const filteredCorr = corrections.filter(c => {
    const matchSearch = c.fichier_path.toLowerCase().includes(searchCorr.toLowerCase()) ||
      c.vuln_type.toLowerCase().includes(searchCorr.toLowerCase());
    const matchSev = filterSev === "all" || c.vuln_severite === filterSev;
    return matchSearch && matchSev;
  });

  const filteredMrs = mrs.filter(m => {
    const matchSearch = m.projet_nom.toLowerCase().includes(searchMrs.toLowerCase()) ||
      m.titre.toLowerCase().includes(searchMrs.toLowerCase());
    const matchStatus = filterMrStatus === "all" || m.statut === filterMrStatus;
    return matchSearch && matchStatus;
  });

  // ── Stats cards ────────────────────────────────────────────────────────────
  const critiques = corrections.filter(c => c.vuln_severite === "CRITIQUE").length;
  const hautes    = corrections.filter(c => c.vuln_severite === "HAUTE").length;
  const mrsMerged = mrs.filter(m => m.statut === "merged").length;

  const statCards = [
    { label: "Sessions d'exploration", value: explorations.length, icon: "🗂️",  color: "#6366f1" },
    { label: "Corrections IA",          value: corrections.length,  icon: "⚡",  color: "#10b981" },
    { label: "Merge Requests",          value: mrs.length,          icon: "⟁",  color: "#8b5cf6" },
    { label: "Vulns critiques corrigées", value: critiques + hautes, icon: "🛡️", color: critiques + hautes > 0 ? "#f97316" : "#10b981" },
  ];

  // ── Loading spinner ────────────────────────────────────────────────────────
  const Spinner = () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${D.border}`, borderTopColor: D.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  const Empty = ({ icon, msg, sub, action, actionLabel }: { icon: string; msg: string; sub?: string; action?: () => void; actionLabel?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", color: D.faint }}>
      <span style={{ fontSize: 52, marginBottom: 16 }}>{icon}</span>
      <div style={{ fontSize: 15, fontWeight: 600, color: D.muted, marginBottom: 6 }}>{msg}</div>
      {sub && <div style={{ fontSize: 13, color: D.faint, marginBottom: 20 }}>{sub}</div>}
      {action && <button onClick={action} style={{ padding: "10px 24px", background: D.accent, border: "none", borderRadius: 12, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{actionLabel}</button>}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes pulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
        .row-hover:hover { background: ${D.rowHover} !important; }
        .nav-btn:hover   { background: ${D.navHover} !important; }
        .tab-btn-hover:hover { opacity: 0.8; }
        input:focus { outline: none; border-color: ${D.accent} !important; }
        select:focus { outline: none; border-color: ${D.accent} !important; }
        .card-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(99,102,241,0.12); }
        @media (max-width: 900px) { .sidebar-hide { display: none !important; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", transition: "background 0.3s, color 0.3s" }}>

        {/* ══ SIDEBAR ══ */}
        <aside className="sidebar-hide" style={{ width: 260, background: D.sidebar, borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", transition: "background 0.3s", flexShrink: 0 }}>

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
          <nav style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
            {menuItems.map(item => {
              const isActive = activeMenu === item.key;
              return (
                <button key={item.key} className="nav-btn"
                  onClick={() => { setActiveMenu(item.key); if (item.href) router.push(item.href); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "none", width: "100%", textAlign: "left", fontSize: 14, fontWeight: 500, cursor: "pointer", background: isActive ? D.navActive : "transparent", color: isActive ? D.accent : D.muted, transition: "all 0.2s" }}>
                  <span style={{ fontSize: 17, width: 26 }}>{item.icon}</span>
                  {item.label}
                  {item.key === "exploration" && (explorations.length + corrections.length + mrs.length > 0) && (
                    <span style={{ marginLeft: "auto", background: D.accent, color: "white", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>
                      {explorations.length + corrections.length + mrs.length}
                    </span>
                  )}
                  {item.key === "help" && ticketNotifs.length > 0 && (
                    <span style={{ marginLeft: "auto", background: "#ef4444", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{ticketNotifs.length}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom */}
          <div style={{ padding: 20, borderTop: `1px solid ${D.border}` }}>
            <div style={{ marginBottom: 12 }}><ThemeToggle /></div>
            <div onClick={() => router.push("/profile")}
              style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, cursor: "pointer", padding: 8, borderRadius: 12, transition: "background 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.background = D.navHover)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15, color: "white", flexShrink: 0 }}>
                {username[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: D.text }}>{username}</div>
                <div style={{ fontSize: 11, color: D.faint }}>connecté</div>
              </div>
            </div>
            <button onClick={handleLogout}
              style={{ width: "100%", padding: "8px 12px", background: isDark ? "rgba(239,68,68,0.1)" : "#f1f5f9", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              ⎋ Déconnexion
            </button>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* ── TOPBAR ── */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", background: D.sidebar, borderBottom: `1px solid ${D.border}`, flexShrink: 0, transition: "background 0.3s" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗂️</span> Explorateur de code
              </div>
              <div style={{ fontSize: 12, color: D.faint, marginTop: 3 }}>
                Historique de vos explorations, corrections IA et Merge Requests
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => router.push("/Exploreformpage")}
                style={{ padding: "10px 20px", background: D.accent, border: "none", borderRadius: 12, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                ＋ Nouvelle exploration
              </button>

              {/* Cloche */}
              <div ref={notifRef} style={{ position: "relative" }}>
                <button onClick={() => setShowNotifs(v => !v)}
                  style={{ position: "relative", width: 40, height: 40, background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  🔔
                  {ticketNotifs.length > 0 && (
                    <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, background: "#ef4444", borderRadius: "50%", fontSize: 10, fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${D.sidebar}`, animation: "pulse 2s ease-in-out infinite" }}>
                      {ticketNotifs.length}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div style={{ position: "absolute", top: 48, right: 0, width: 300, background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", zIndex: 200, overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${D.border}` }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>💬 Réponses support</span>
                    </div>
                    {ticketNotifs.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", color: D.faint, fontSize: 13 }}>Aucune réponse</div>
                    ) : ticketNotifs.map(t => (
                      <div key={t.id} onClick={() => { setShowNotifs(false); router.push("/help"); }}
                        style={{ padding: "12px 18px", borderBottom: `1px solid ${D.border}`, cursor: "pointer" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: D.text }}>{t.subject}</div>
                        <div style={{ fontSize: 11, color: "#22c55e", marginTop: 3 }}>Le support a répondu</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── CONTENT ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>

            {/* ── STAT CARDS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              {statCards.map((s, i) => (
                <div key={i} className="card-hover"
                  style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 18, padding: "18px 20px", transition: "all 0.25s", cursor: "default", animation: `fadeUp 0.35s ease ${i * 0.06}s both` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 26 }}>{s.icon}</span>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: s.color, marginBottom: 4, fontFamily: "monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: D.faint, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── TABS ── */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, overflow: "hidden", animation: "fadeUp 0.4s ease 0.2s both" }}>

              {/* Tab bar */}
              <div style={{ display: "flex", borderBottom: `1px solid ${D.border}`, background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }}>
                {([
                  { key: "explorations", label: "🗂️  Sessions",         count: filteredExp.length },
                  { key: "corrections",  label: "⚡ Corrections IA",   count: filteredCorr.length },
                  { key: "mrs",          label: "⟁ Merge Requests",    count: filteredMrs.length },
                ] as { key: ActiveTab; label: string; count: number }[]).map(tab => (
                  <button key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setSelectedExp(null); setSelectedCorr(null); setSelectedMr(null); }}
                    style={{ padding: "16px 28px", border: "none", borderBottom: activeTab === tab.key ? `2px solid ${D.accent}` : "2px solid transparent", background: "transparent", color: activeTab === tab.key ? D.accent : D.faint, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", marginBottom: -1 }}>
                    {tab.label}
                    <span style={{ padding: "2px 8px", borderRadius: 20, background: activeTab === tab.key ? "rgba(99,102,241,0.15)" : D.tag, color: activeTab === tab.key ? D.accent : D.faint, fontSize: 11, fontWeight: 700 }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* ════════════════════════
                  TAB 1 — EXPLORATIONS
              ════════════════════════ */}
              {activeTab === "explorations" && (
                <div style={{ display: "flex", minHeight: 500 }}>

                  {/* List */}
                  <div style={{ flex: 1, borderRight: selectedExp ? `1px solid ${D.border}` : "none" }}>
                    {/* Search bar */}
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${D.border}` }}>
                      <input value={searchExp} onChange={e => setSearchExp(e.target.value)}
                        placeholder="Rechercher un projet ou une branche…"
                        style={{ width: "100%", padding: "9px 14px", background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, color: D.text, transition: "border-color 0.2s" }} />
                    </div>

                    {loadingExp ? <Spinner /> : filteredExp.length === 0 ? (
                      <Empty icon="🗂️" msg="Aucune session d'exploration" sub="Commencez par explorer un dépôt GitLab" action={() => router.push("/Exploreformpage")} actionLabel="+ Explorer un dépôt" />
                    ) : (
                      <div style={{ overflowY: "auto", maxHeight: 580 }}>
                        {filteredExp.map((e, i) => (
                          <div key={e.id} className="row-hover"
                            onClick={() => setSelectedExp(selectedExp?.id === e.id ? null : e)}
                            style={{ padding: "14px 20px", borderBottom: `1px solid ${D.border}`, cursor: "pointer", background: selectedExp?.id === e.id ? D.navActive : "transparent", transition: "all 0.2s", animation: `fadeUp 0.2s ease ${i * 0.04}s both`, borderLeft: selectedExp?.id === e.id ? `3px solid ${D.accent}` : "3px solid transparent" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {e.projet_nom}
                                </div>
                                <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {e.projet_chemin}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.1)", color: D.accent, borderRadius: 20, fontFamily: "monospace", fontWeight: 600 }}>
                                    ⑂ {e.branche}
                                  </span>
                                  <span style={{ fontSize: 10, padding: "2px 8px", background: D.tag, color: D.tagText, borderRadius: 20 }}>
                                    {e.total_fichiers} fichiers
                                  </span>
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: D.faint }}>{fmtDate(e.created_at)}</div>
                                <button onClick={ev => { ev.stopPropagation(); router.push("/Exploreformpage"); }}
                                  style={{ marginTop: 6, padding: "4px 10px", background: "rgba(99,102,241,0.1)", border: "none", borderRadius: 8, color: D.accent, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                                  ↗ Ré-explorer
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Detail panel */}
                  {selectedExp && (
                    <div style={{ width: 380, flexShrink: 0, padding: 24, overflowY: "auto", maxHeight: 640, animation: "fadeUp 0.2s ease" }}>
                      <button onClick={() => setSelectedExp(null)}
                        style={{ background: D.tag, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: D.muted, cursor: "pointer", marginBottom: 16 }}>
                        ← Fermer
                      </button>
                      <div style={{ background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 12 }}>
                          📁 {selectedExp.projet_nom}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {[
                            { label: "Branche",    value: selectedExp.branche },
                            { label: "Fichiers",   value: String(selectedExp.total_fichiers) },
                            { label: "Date",       value: fmtDate(selectedExp.created_at) },
                            { label: "Projet",     value: selectedExp.projet_chemin.split("/").pop() ?? "" },
                          ].map(f => (
                            <div key={f.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{f.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: D.text, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Corrections liées */}
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: D.muted, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 3, height: 14, background: "#10b981", borderRadius: 2, display: "inline-block" }} />
                          Corrections IA pour ce projet
                        </div>
                        {corrections.filter(c => c.fichier_path.includes(selectedExp.projet_nom.split("/").pop() ?? "")).length === 0 ? (
                          <div style={{ fontSize: 12, color: D.faint, padding: "12px 0", textAlign: "center" }}>Aucune correction liée</div>
                        ) : corrections
                          .filter(c => c.fichier_path.includes(selectedExp.projet_nom.split("/").pop() ?? ""))
                          .slice(0, 5)
                          .map(c => (
                            <div key={c.id} style={{ background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: `${sevColor(c.vuln_severite)}15`, color: sevColor(c.vuln_severite), fontWeight: 700 }}>{c.vuln_severite}</span>
                                <span style={{ fontSize: 11, color: D.muted }}>{c.vuln_type}</span>
                              </div>
                              <div style={{ fontSize: 10, color: D.faint, fontFamily: "monospace" }}>{c.fichier_path.split("/").pop()}</div>
                            </div>
                          ))
                        }
                      </div>

                      <button onClick={() => router.push("/Exploreformpage")}
                        style={{ width: "100%", padding: "12px", background: D.accent, border: "none", borderRadius: 12, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
                        ↗ Ré-ouvrir l'explorateur
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════
                  TAB 2 — CORRECTIONS IA
              ════════════════════════ */}
              {activeTab === "corrections" && (
                <div style={{ display: "flex", minHeight: 500 }}>
                  <div style={{ flex: 1, borderRight: selectedCorr ? `1px solid ${D.border}` : "none" }}>

                    {/* Filters */}
                    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input value={searchCorr} onChange={e => setSearchCorr(e.target.value)}
                        placeholder="Rechercher fichier ou type de vuln…"
                        style={{ flex: 1, minWidth: 200, padding: "8px 13px", background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, color: D.text, transition: "border-color 0.2s" }} />
                      <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
                        style={{ padding: "8px 12px", background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 12, color: D.text, cursor: "pointer" }}>
                        <option value="all">Toutes sévérités</option>
                        <option value="CRITIQUE">CRITIQUE</option>
                        <option value="HAUTE">HAUTE</option>
                        <option value="MOYENNE">MOYENNE</option>
                        <option value="FAIBLE">FAIBLE</option>
                      </select>
                    </div>

                    {loadingCorr ? <Spinner /> : filteredCorr.length === 0 ? (
                      <Empty icon="⚡" msg="Aucune correction IA" sub="Explorez un dépôt et utilisez la correction automatique" />
                    ) : (
                      <div style={{ overflowY: "auto", maxHeight: 560 }}>
                        {filteredCorr.map((c, i) => {
                          const st = corrStatusStyle(c.statut);
                          const ei = extIcon(c.fichier_path);
                          return (
                            <div key={c.id} className="row-hover"
                              onClick={() => setSelectedCorr(selectedCorr?.id === c.id ? null : c)}
                              style={{ padding: "14px 20px", borderBottom: `1px solid ${D.border}`, cursor: "pointer", background: selectedCorr?.id === c.id ? D.navActive : "transparent", transition: "all 0.2s", animation: `fadeUp 0.2s ease ${i * 0.04}s both`, borderLeft: selectedCorr?.id === c.id ? `3px solid ${sevColor(c.vuln_severite)}` : "3px solid transparent" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: ei.color, background: `${ei.color}18`, padding: "1px 5px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>{ei.icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {c.fichier_path.split("/").pop()}
                                    </span>
                                    <span style={{ fontSize: 9, fontFamily: "monospace", color: D.faint, flexShrink: 0 }}>:L{c.vuln_ligne}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: `${sevColor(c.vuln_severite)}15`, color: sevColor(c.vuln_severite), fontWeight: 700 }}>
                                      {c.vuln_severite}
                                    </span>
                                    <span style={{ fontSize: 11, color: D.muted }}>{c.vuln_type}</span>
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 11, color: D.faint, marginBottom: 5 }}>{fmtDate(c.created_at)}</div>
                                  <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Correction detail */}
                  {selectedCorr && (
                    <div style={{ width: 400, flexShrink: 0, padding: 24, overflowY: "auto", maxHeight: 640, animation: "fadeUp 0.2s ease" }}>
                      <button onClick={() => setSelectedCorr(null)}
                        style={{ background: D.tag, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: D.muted, cursor: "pointer", marginBottom: 16 }}>
                        ← Fermer
                      </button>

                      {/* Header */}
                      <div style={{ background: D.detailBg, border: `1px solid ${D.border}`, borderLeft: `4px solid ${sevColor(selectedCorr.vuln_severite)}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: `${sevColor(selectedCorr.vuln_severite)}15`, color: sevColor(selectedCorr.vuln_severite), fontWeight: 700 }}>
                            {selectedCorr.vuln_severite}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: D.text }}>{selectedCorr.vuln_type}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                          {[
                            { label: "Fichier", value: selectedCorr.fichier_path.split("/").pop() ?? "" },
                            { label: "Ligne",   value: `L${selectedCorr.vuln_ligne}` },
                            { label: "Date",    value: fmtDateFull(selectedCorr.created_at) },
                            { label: "Statut",  value: selectedCorr.statut },
                          ].map(f => (
                            <div key={f.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: "9px 11px" }}>
                              <div style={{ fontSize: 9, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{f.label}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: D.text, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Path complet */}
                        <div style={{ fontSize: 10, fontFamily: "monospace", color: D.faint, background: D.card, padding: "8px 12px", borderRadius: 8, wordBreak: "break-all" }}>
                          📄 {selectedCorr.fichier_path}
                        </div>
                      </div>

                      {/* Suggestion */}
                      {selectedCorr.vuln_suggestion && (
                        <div style={{ background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 14, padding: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 3, height: 12, background: "#10b981", borderRadius: 2, display: "inline-block" }} />
                            Suggestion de correction
                          </div>
                          <div style={{ fontSize: 12, color: D.text, lineHeight: 1.7 }}>{selectedCorr.vuln_suggestion}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════
                  TAB 3 — MR EXPLORATIONS
              ════════════════════════ */}
              {activeTab === "mrs" && (
                <div style={{ display: "flex", minHeight: 500 }}>
                  <div style={{ flex: 1, borderRight: selectedMr ? `1px solid ${D.border}` : "none" }}>

                    {/* Filters */}
                    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input value={searchMrs} onChange={e => setSearchMrs(e.target.value)}
                        placeholder="Rechercher un projet ou un titre de MR…"
                        style={{ flex: 1, minWidth: 200, padding: "8px 13px", background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, color: D.text, transition: "border-color 0.2s" }} />
                      <select value={filterMrStatus} onChange={e => setFilterMrStatus(e.target.value)}
                        style={{ padding: "8px 12px", background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 12, color: D.text, cursor: "pointer" }}>
                        <option value="all">Tous statuts</option>
                        <option value="opened">Open</option>
                        <option value="merged">Merged</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    {loadingMrs ? <Spinner /> : filteredMrs.length === 0 ? (
                      <Empty icon="⟁" msg="Aucune Merge Request" sub="Explorez un dépôt, faites des corrections et poussez sur GitLab" />
                    ) : (
                      <div style={{ overflowY: "auto", maxHeight: 560 }}>
                        {filteredMrs.map((m, i) => {
                          const st = mrStatusStyle(m.statut);
                          let fileCount = 0;
                          try { fileCount = m.fichiers_modifies ? JSON.parse(m.fichiers_modifies).length : 0; } catch {}

                          return (
                            <div key={m.id} className="row-hover"
                              onClick={() => setSelectedMr(selectedMr?.id === m.id ? null : m)}
                              style={{ padding: "16px 20px", borderBottom: `1px solid ${D.border}`, cursor: "pointer", background: selectedMr?.id === m.id ? D.navActive : "transparent", transition: "all 0.2s", animation: `fadeUp 0.2s ease ${i * 0.04}s both`, borderLeft: selectedMr?.id === m.id ? `3px solid ${D.accent}` : "3px solid transparent" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, fontFamily: "monospace", color: D.faint, flexShrink: 0 }}>!{m.mr_iid_gitlab}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {m.titre}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: D.faint, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {m.projet_nom}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.1)", color: D.accent, borderRadius: 20, fontFamily: "monospace" }}>
                                      {m.branche_source}
                                    </span>
                                    <span style={{ fontSize: 10, color: D.faint }}>→</span>
                                    <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(16,185,129,0.1)", color: "#10b981", borderRadius: 20, fontFamily: "monospace" }}>
                                      {m.branche_cible}
                                    </span>
                                    {fileCount > 0 && (
                                      <span style={{ fontSize: 10, padding: "2px 8px", background: D.tag, color: D.tagText, borderRadius: 20 }}>
                                        {fileCount} fichier{fileCount > 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 11, color: D.faint, marginBottom: 6 }}>{fmtDate(m.created_at)}</div>
                                  <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* MR detail */}
                  {selectedMr && (() => {
                    const st = mrStatusStyle(selectedMr.statut);
                    let files: string[] = [];
                    try { files = selectedMr.fichiers_modifies ? JSON.parse(selectedMr.fichiers_modifies) : []; } catch {}

                    return (
                      <div style={{ width: 420, flexShrink: 0, padding: 24, overflowY: "auto", maxHeight: 640, animation: "fadeUp 0.2s ease" }}>
                        <button onClick={() => setSelectedMr(null)}
                          style={{ background: D.tag, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, color: D.muted, cursor: "pointer", marginBottom: 16 }}>
                          ← Fermer
                        </button>

                        {/* MR header card */}
                        <div style={{ background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20, marginBottom: 16, position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${st.color}, transparent)` }} />

                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace", marginBottom: 4 }}>!{selectedMr.mr_iid_gitlab}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: D.text, lineHeight: 1.4 }}>{selectedMr.titre}</div>
                            </div>
                            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>{st.label}</span>
                          </div>

                          {/* Branches */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: D.card, borderRadius: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: D.accent, fontWeight: 600 }}>{selectedMr.branche_source}</span>
                            <span style={{ fontSize: 16, color: D.faint }}>→</span>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#10b981", fontWeight: 600 }}>{selectedMr.branche_cible}</span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {[
                              { label: "Projet",      value: selectedMr.projet_nom },
                              { label: "Date",        value: fmtDate(selectedMr.created_at) },
                              { label: "Fichiers",    value: String(files.length) },
                              { label: "Chemin",      value: selectedMr.projet_chemin.split("/").pop() ?? "" },
                            ].map(f => (
                              <div key={f.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: "9px 11px" }}>
                                <div style={{ fontSize: 9, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{f.label}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Fichiers modifiés */}
                        {files.length > 0 && (
                          <div style={{ background: D.detailBg, border: `1px solid ${D.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 3, height: 12, background: D.accent, borderRadius: 2, display: "inline-block" }} />
                              {files.length} fichier{files.length > 1 ? "s" : ""} modifié{files.length > 1 ? "s" : ""}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {files.slice(0, 12).map((f: string, i: number) => {
                                const ei = extIcon(f);
                                return (
                                  <span key={i} style={{ fontSize: 10, padding: "3px 9px", background: `${ei.color}10`, border: `1px solid ${ei.color}25`, borderRadius: 8, color: ei.color, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 8, fontWeight: 700 }}>{ei.icon}</span>
                                    {f.split("/").pop()}
                                  </span>
                                );
                              })}
                              {files.length > 12 && (
                                <span style={{ fontSize: 10, color: D.faint, padding: "3px 0" }}>+{files.length - 12} autres</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Link GitLab */}
                        {selectedMr.mr_url && selectedMr.mr_url !== "none" && selectedMr.mr_url !== "" && (
                          <a href={selectedMr.mr_url} target="_blank" rel="noreferrer"
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", background: "rgba(252,96,56,0.1)", border: "1px solid rgba(252,96,56,0.25)", borderRadius: 12, color: "#fc6038", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                            <span>🦊</span> Voir sur GitLab ↗
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
            {/* end tabs card */}

            {/* ── Quick actions ── */}
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, animation: "fadeUp 0.4s ease 0.35s both" }}>
              {[
                { icon: "🗂️", label: "Nouvelle exploration",  sub: "Explorer un dépôt GitLab",   action: () => router.push("/Exploreformpage"),   color: "#6366f1" },
                { icon: "◎",  label: "Lancer une analyse",    sub: "Analyser la qualité du code", action: () => router.push("/analyse"),            color: "#10b981" },
                { icon: "⟁",  label: "Mes Merge Requests",    sub: "Voir les MRs du projet",      action: () => router.push("/merge-requests"),     color: "#8b5cf6" },
              ].map((a, i) => (
                <button key={i} onClick={a.action} className="card-hover"
                  style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.25s", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${a.color}15`, border: `1px solid ${a.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{a.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 3 }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: D.faint }}>{a.sub}</div>
                  </div>
                </button>
              ))}
            </div>

          </div>
          {/* end content */}
        </div>
        {/* end main */}
      </div>
    </>
  );
}

