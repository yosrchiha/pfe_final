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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .exploration-page {
          min-height: 100vh;
          background: ${D.bg};
          color: ${D.text};
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          display: flex;
          transition: background .28s ease, color .28s ease;
        }
        .app-sidebar {
          width: 248px;
          flex-shrink: 0;
          background: ${D.sidebar};
          border-right: 1px solid ${D.border};
          height: 100vh;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
        }
        .logo-area {
          padding: 22px 18px 18px;
          border-bottom: 1px solid ${D.border};
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .logo-box {
          width: 40px;
          height: 40px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
          color: white;
          font-size: 18px;
          font-weight: 800;
          box-shadow: 0 12px 28px rgba(99,102,241,.24);
        }
        .logo-title { font-size: 16px; font-weight: 750; letter-spacing: -.03em; }
        .logo-sub { font-size: 10px; color: ${D.faint}; margin-top: 3px; }
        .nav-section {
          flex: 1;
          padding: 16px 12px;
          overflow-y: auto;
        }
        .nav-label {
          color: ${D.faint};
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .1em;
          text-transform: uppercase;
          padding: 0 10px;
          margin: 4px 0 10px;
        }
        .nav-item {
          height: 42px;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 10px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          color: ${D.muted};
          font-size: 13px;
          font-weight: 560;
          cursor: pointer;
          transition: all .16s ease;
          margin-bottom: 3px;
        }
        .nav-item:hover { background: ${D.navHover}; color: ${D.text}; }
        .nav-item.active {
          background: ${D.navActive};
          color: ${D.accent};
          font-weight: 680;
        }
        .nav-icon { width: 23px; text-align: center; font-size: 15px; }
        .badge-count {
          margin-left: auto;
          padding: 2px 7px;
          border-radius: 999px;
          background: ${D.accent};
          color: white;
          font-size: 9px;
          font-weight: 750;
        }
        .badge-alert {
          margin-left: auto;
          padding: 2px 7px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          font-size: 9px;
          font-weight: 750;
        }
        .sidebar-footer {
          border-top: 1px solid ${D.border};
          padding: 15px 14px;
        }
        .profile {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 13px;
          padding: 8px;
          border-radius: 12px;
          cursor: pointer;
          transition: background .17s ease;
        }
        .profile:hover { background: ${D.navHover}; }
        .avatar {
          width: 37px;
          height: 37px;
          flex-shrink: 0;
          border-radius: 50%;
          color: white;
          display: grid;
          place-items: center;
          font-weight: 700;
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
        }
        .logout {
          width: 100%;
          height: 38px;
          margin-top: 10px;
          border: 0;
          border-radius: 10px;
          color: #ef4444;
          background: ${isDark ? "rgba(239,68,68,.10)" : "#fef2f2"};
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
        }

        .page-main {
          flex: 1;
          min-width: 0;
          padding: 25px 32px 42px;
          position: relative;
          overflow-x: hidden;
        }
        .page-main::before {
          content: "";
          position: fixed;
          right: -190px;
          top: -220px;
          width: 580px;
          height: 580px;
          pointer-events: none;
          border-radius: 999px;
          background: radial-gradient(circle, ${isDark ? "rgba(99,102,241,.17)" : "rgba(99,102,241,.10)"}, transparent 68%);
        }
        .page-wrap {
          max-width: 1240px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 21px;
        }
        .crumb {
          font-size: 11px;
          font-weight: 760;
          color: ${D.faint};
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .title-row h1 {
          margin: 0;
          font-size: 25px;
          font-weight: 780;
          letter-spacing: -.045em;
        }
        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .primary-button {
          border: 0;
          height: 44px;
          border-radius: 13px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: white;
          background: linear-gradient(135deg,#6366f1,#7c3aed);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 12px 27px rgba(99,102,241,.23);
          transition: transform .16s ease, box-shadow .16s ease;
        }
        .primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 33px rgba(99,102,241,.32);
        }
        .bell {
          position: relative;
          width: 44px;
          height: 44px;
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 13px;
          cursor: pointer;
          font-size: 17px;
        }
        .bell-count {
          position: absolute;
          right: -4px;
          top: -5px;
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          font-size: 9px;
          font-weight: 800;
          animation: pulse 2s ease-in-out infinite;
        }
        .notification-popover {
          position: absolute;
          right: 0;
          top: 52px;
          width: 305px;
          overflow: hidden;
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 16px;
          z-index: 20;
          box-shadow: 0 20px 46px rgba(0,0,0,.15);
        }
        .notification-title {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 700;
          border-bottom: 1px solid ${D.border};
        }
        .notif-empty {
          padding: 23px;
          text-align: center;
          color: ${D.faint};
          font-size: 12px;
        }
        .notif-item {
          padding: 12px 16px;
          border-bottom: 1px solid ${D.border};
          cursor: pointer;
        }
        .notif-item strong { display: block; font-size: 12px; }
        .notif-item span { color: #10b981; font-size: 10px; margin-top: 4px; display: block; }

        .hero {
          display: grid;
          grid-template-columns: 1.3fr .95fr;
          gap: 22px;
          padding: 27px 29px;
          margin-bottom: 19px;
          border-radius: 28px;
          border: 1px solid ${D.border};
          background: ${isDark
            ? "linear-gradient(122deg, rgba(99,102,241,.16), rgba(20,25,33,.95) 53%, rgba(16,185,129,.08))"
            : "linear-gradient(122deg, #eef2ff, #ffffff 53%, #ecfdf5)"};
        }
        .hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #6366f1;
          padding: 7px 12px;
          border-radius: 999px;
          background: ${isDark ? "rgba(99,102,241,.15)" : "#eef2ff"};
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .hero h2 {
          margin: 0 0 10px;
          font-size: 31px;
          line-height: 1.16;
          font-weight: 800;
          letter-spacing: -.052em;
        }
        .hero h2 span {
          background: linear-gradient(100deg,#6366f1,#8b5cf6);
          -webkit-background-clip: text;
          color: transparent;
        }
        .hero p {
          margin: 0;
          color: ${D.muted};
          font-size: 13px;
          line-height: 1.7;
        }
        .workflow {
          display: flex;
          align-items: stretch;
          gap: 7px;
          align-self: center;
        }
        .step {
          flex: 1;
          border: 1px solid ${D.border};
          background: ${D.card};
          border-radius: 15px;
          padding: 13px 9px;
          text-align: center;
        }
        .step-icon {
          height: 31px;
          width: 31px;
          display: grid;
          place-items: center;
          margin: 0 auto 8px;
          border-radius: 10px;
          color: #6366f1;
          font-size: 16px;
          background: rgba(99,102,241,.11);
        }
        .step strong { font-size: 10px; display: block; margin-bottom: 3px; }
        .step small { color: ${D.faint}; font-size: 9px; line-height: 1.35; display: block; }

        .metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 11px;
          margin-bottom: 18px;
        }
        .metric {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 18px;
          padding: 15px 16px;
          display: flex;
          align-items: center;
          gap: 13px;
          animation: fadeUp .25s ease both;
        }
        .metric-icon {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          font-size: 19px;
        }
        .metric strong {
          display: block;
          font-size: 24px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -.045em;
        }
        .metric span {
          display: block;
          color: ${D.faint};
          font-size: 10px;
          font-weight: 650;
          margin-top: 5px;
        }

        .history-board {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 23px;
          overflow: hidden;
        }
        .tabs {
          display: flex;
          gap: 5px;
          padding: 9px;
          border-bottom: 1px solid ${D.border};
          background: ${isDark ? "rgba(255,255,255,.012)" : "#fafbff"};
        }
        .tab {
          height: 48px;
          border: 0;
          border-radius: 13px;
          padding: 0 18px;
          color: ${D.faint};
          background: transparent;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 650;
          transition: .16s ease;
        }
        .tab.active {
          background: ${D.navActive};
          color: ${D.accent};
        }
        .tab-count {
          min-width: 24px;
          height: 23px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: ${D.tag};
          color: ${D.tagText};
          font-size: 10px;
          font-weight: 750;
        }
        .tab.active .tab-count {
          background: rgba(99,102,241,.18);
          color: #6366f1;
        }
        .board-body {
          display: grid;
          grid-template-columns: minmax(420px, 1fr) 380px;
          min-height: 530px;
        }
        .list-pane {
          min-width: 0;
          border-right: 1px solid ${D.border};
        }
        .list-pane.no-detail {
          grid-column: span 2;
          border-right: 0;
        }
        .toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 15px 18px;
          border-bottom: 1px solid ${D.border};
        }
        .search {
          flex: 1;
          position: relative;
        }
        .search span {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: ${D.faint};
        }
        .control {
          width: 100%;
          height: 42px;
          border: 1px solid ${D.border};
          background: ${D.detailBg};
          color: ${D.text};
          border-radius: 12px;
          padding: 0 13px;
          font-size: 12px;
          outline: none;
        }
        .search .control { padding-left: 37px; }
        .control:focus {
          border-color: ${D.accent};
          box-shadow: 0 0 0 3px rgba(99,102,241,.10);
        }
        .rows { max-height: 570px; overflow-y: auto; }
        .row {
          padding: 14px 18px;
          border-bottom: 1px solid ${D.border};
          cursor: pointer;
          transition: background .16s ease;
          border-left: 3px solid transparent;
        }
        .row:hover { background: ${D.rowHover}; }
        .row.selected {
          background: ${D.navActive};
          border-left-color: ${D.accent};
        }
        .row-main {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: flex-start;
        }
        .row-title {
          color: ${D.text};
          font-size: 13px;
          font-weight: 690;
          margin-bottom: 5px;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .row-sub {
          color: ${D.faint};
          font-size: 10px;
          font-family: ui-monospace, SFMono-Regular, monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 8px;
        }
        .row-meta {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          align-items: center;
        }
        .pill {
          border-radius: 999px;
          padding: 4px 9px;
          background: ${D.tag};
          color: ${D.tagText};
          font-size: 10px;
          font-weight: 650;
        }
        .date {
          font-size: 10px;
          color: ${D.faint};
          white-space: nowrap;
        }
        .ghost-link {
          border: 0;
          margin-top: 8px;
          color: ${D.accent};
          background: rgba(99,102,241,.10);
          border-radius: 8px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 680;
          cursor: pointer;
        }
        .file-icon {
          border-radius: 5px;
          padding: 2px 5px;
          font-size: 9px;
          font-weight: 800;
          font-family: ui-monospace, monospace;
        }
        .detail-pane {
          padding: 21px;
          overflow-y: auto;
          max-height: 650px;
          animation: fadeUp .18s ease;
        }
        .empty-detail {
          min-height: 530px;
          display: grid;
          place-items: center;
          padding: 30px;
          text-align: center;
          color: ${D.faint};
        }
        .empty-detail .icon {
          width: 65px;
          height: 65px;
          margin: 0 auto 14px;
          border-radius: 21px;
          display: grid;
          place-items: center;
          font-size: 29px;
          background: ${D.tag};
        }
        .empty-detail strong {
          display: block;
          font-size: 16px;
          color: ${D.text};
          margin-bottom: 7px;
        }
        .empty-detail p { max-width: 270px; font-size: 12px; line-height: 1.6; }
        .detail-close {
          height: 31px;
          border: 1px solid ${D.border};
          background: ${D.tag};
          color: ${D.muted};
          border-radius: 9px;
          padding: 0 11px;
          cursor: pointer;
          font-size: 11px;
          margin-bottom: 14px;
        }
        .detail-card {
          background: ${D.detailBg};
          border: 1px solid ${D.border};
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 13px;
        }
        .detail-card h3 {
          margin: 0 0 13px;
          font-size: 15px;
          line-height: 1.45;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .data-box {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 10px;
          padding: 9px 10px;
        }
        .data-box label {
          display: block;
          text-transform: uppercase;
          color: ${D.faint};
          font-size: 8px;
          font-weight: 760;
          letter-spacing: .1em;
          margin-bottom: 4px;
        }
        .data-box span {
          display: block;
          color: ${D.text};
          font-size: 11px;
          font-weight: 650;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .section-mini-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          color: ${D.muted};
          margin-bottom: 10px;
        }
        .section-mini-title::before {
          content: "";
          height: 13px;
          width: 3px;
          border-radius: 10px;
          background: ${D.accent};
        }
        .related-card {
          background: ${D.detailBg};
          border: 1px solid ${D.border};
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 7px;
        }
        .suggestion {
          font-size: 12px;
          color: ${D.text};
          line-height: 1.65;
        }
        .file-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .file-tag {
          display: inline-flex;
          gap: 5px;
          align-items: center;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 10px;
          font-family: ui-monospace, monospace;
        }
        .gitlab-link {
          width: 100%;
          height: 43px;
          border-radius: 12px;
          color: #fc6038;
          background: rgba(252,96,56,.10);
          border: 1px solid rgba(252,96,56,.25);
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }
        .quick-actions {
          margin-top: 17px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 11px;
        }
        .quick {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          border-radius: 16px;
          border: 1px solid ${D.border};
          background: ${D.card};
          text-align: left;
          cursor: pointer;
          transition: transform .16s ease, border-color .16s ease;
        }
        .quick:hover { transform: translateY(-2px); border-color: rgba(99,102,241,.38); }
        .quick-icon {
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 19px;
        }
        .quick strong { color: ${D.text}; font-size: 12px; display: block; margin-bottom: 4px; }
        .quick span { color: ${D.faint}; font-size: 10px; }

        @media (max-width: 1130px) {
          .sidebar-hide { display: none; }
          .page-main { padding: 20px 16px 36px; }
          .hero { grid-template-columns: 1fr; }
          .metrics { grid-template-columns: repeat(2, 1fr); }
          .board-body { display: block; }
          .list-pane { border-right: 0; }
          .detail-pane { border-top: 1px solid ${D.border}; }
        }
        @media (max-width: 690px) {
          .topbar, .top-actions, .tabs { flex-direction: column; align-items: flex-start; }
          .workflow, .metrics, .quick-actions { display: grid; grid-template-columns: 1fr; }
          .tabs { padding: 10px; }
          .tab { width: 100%; }
        }
      `}</style>

      <div className="exploration-page">
        <aside className="app-sidebar sidebar-hide">
          <div className="logo-area">
            <div className="logo-box">A</div>
            <div>
              <div className="logo-title">AuditIA</div>
              <div className="logo-sub">GitLab · IA · PFE 2025</div>
            </div>
          </div>

          <nav className="nav-section">
            <div className="nav-label">Navigation</div>
            {menuItems.map(item => {
              const isActive = activeMenu === item.key;
              return (
                <button
                  key={item.key}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveMenu(item.key);
                    if (item.href) router.push(item.href);
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.key === "exploration" && explorations.length + corrections.length + mrs.length > 0 && (
                    <span className="badge-count">{explorations.length + corrections.length + mrs.length}</span>
                  )}
                  {item.key === "help" && ticketNotifs.length > 0 && (
                    <span className="badge-alert">{ticketNotifs.length}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <ThemeToggle />
            <div className="profile" onClick={() => router.push("/profile")}>
              <div className="avatar">{username[0]?.toUpperCase() || "U"}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 680 }}>{username}</div>
                <div style={{ fontSize: 10, color: D.faint, marginTop: 3 }}>Connecté</div>
              </div>
            </div>
            <button className="logout" onClick={handleLogout}>⎋ Déconnexion</button>
          </div>
        </aside>

        <main className="page-main">
          <div className="page-wrap">
            <header className="topbar">
              <div>
                <div className="crumb">AuditIA / Exploration</div>
                <div className="title-row">
                  <span style={{ fontSize: 24 }}>🗂️</span>
                  <h1>Historique d'exploration</h1>
                </div>
              </div>

              <div className="top-actions">
                <button className="primary-button" onClick={() => router.push("/Exploreformpage")}>
                  ＋ Nouvelle exploration
                </button>

                <div ref={notifRef} style={{ position: "relative" }}>
                  <button className="bell" onClick={() => setShowNotifs(v => !v)}>
                    🔔
                    {ticketNotifs.length > 0 && <span className="bell-count">{ticketNotifs.length}</span>}
                  </button>
                  {showNotifs && (
                    <div className="notification-popover">
                      <div className="notification-title">💬 Réponses support</div>
                      {ticketNotifs.length === 0 ? (
                        <div className="notif-empty">Aucune réponse</div>
                      ) : ticketNotifs.map(t => (
                        <div
                          className="notif-item"
                          key={t.id}
                          onClick={() => {
                            setShowNotifs(false);
                            router.push("/help");
                          }}
                        >
                          <strong>{t.subject}</strong>
                          <span>Le support a répondu</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <section className="hero">
              <div>
                <div className="hero-tag">🗂️ Traçabilité du code exploré</div>
                <h2>Du fichier inspecté à la <span>correction poussée</span></h2>
                <p>
                  Retrouvez le parcours complet de l'exploration manuelle : les sessions ouvertes,
                  les corrections IA appliquées sur des vulnérabilités et les Merge Requests
                  créées lorsque les changements sont envoyés vers GitLab.
                </p>
              </div>

              <div className="workflow">
                <div className="step">
                  <div className="step-icon">🗂️</div>
                  <strong>Explorer</strong>
                  <small>Parcourir les fichiers</small>
                </div>
                <div className="step">
                  <div className="step-icon">⚡</div>
                  <strong>Corriger</strong>
                  <small>Appliquer une correction IA</small>
                </div>
                <div className="step">
                  <div className="step-icon">⟁</div>
                  <strong>Pousser</strong>
                  <small>Créer une MR GitLab</small>
                </div>
              </div>
            </section>

            <section className="metrics">
              {statCards.map((item, index) => (
                <div className="metric" key={item.label} style={{ animationDelay: `${index * 40}ms` }}>
                  <div className="metric-icon" style={{ background: `${item.color}14`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div>
                    <strong style={{ color: item.color }}>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="history-board">
              <div className="tabs">
                {([
                  { key: "explorations", label: "Sessions d'exploration", icon: "🗂️", count: filteredExp.length },
                  { key: "corrections", label: "Corrections IA", icon: "⚡", count: filteredCorr.length },
                  { key: "mrs", label: "Merge Requests", icon: "⟁", count: filteredMrs.length },
                ] as { key: ActiveTab; label: string; icon: string; count: number }[]).map(tab => (
                  <button
                    key={tab.key}
                    className={`tab ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setSelectedExp(null);
                      setSelectedCorr(null);
                      setSelectedMr(null);
                    }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                    <span className="tab-count">{tab.count}</span>
                  </button>
                ))}
              </div>

              {activeTab === "explorations" && (
                <div className="board-body">
                  <div className={`list-pane ${selectedExp ? "" : "no-detail"}`}>
                    <div className="toolbar">
                      <div className="search">
                        <span>⌕</span>
                        <input
                          className="control"
                          value={searchExp}
                          onChange={e => setSearchExp(e.target.value)}
                          placeholder="Rechercher par projet ou branche..."
                        />
                      </div>
                    </div>

                    {loadingExp ? <Spinner /> : filteredExp.length === 0 ? (
                      <Empty
                        icon="🗂️"
                        msg="Aucune session d'exploration"
                        sub="Commencez par ouvrir un dépôt GitLab et parcourir ses fichiers."
                        action={() => router.push("/Exploreformpage")}
                        actionLabel="+ Explorer un dépôt"
                      />
                    ) : (
                      <div className="rows">
                        {filteredExp.map(e => (
                          <div
                            key={e.id}
                            className={`row ${selectedExp?.id === e.id ? "selected" : ""}`}
                            onClick={() => setSelectedExp(selectedExp?.id === e.id ? null : e)}
                          >
                            <div className="row-main">
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="row-title">📁 {e.projet_nom}</div>
                                <div className="row-sub">{e.projet_chemin}</div>
                                <div className="row-meta">
                                  <span className="pill" style={{ color: "#6366f1" }}>⎇ {e.branche}</span>
                                  <span className="pill">{e.total_fichiers} fichier{e.total_fichiers !== 1 ? "s" : ""}</span>
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div className="date">{fmtDate(e.created_at)}</div>
                                <button
                                  className="ghost-link"
                                  onClick={event => {
                                    event.stopPropagation();
                                    router.push("/Exploreformpage");
                                  }}
                                >
                                  ↗ Ré-explorer
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedExp ? (
                    <aside className="detail-pane">
                      <button className="detail-close" onClick={() => setSelectedExp(null)}>← Fermer</button>

                      <div className="detail-card">
                        <h3>📁 {selectedExp.projet_nom}</h3>
                        <div className="detail-grid">
                          {[
                            { label: "Branche", value: selectedExp.branche },
                            { label: "Fichiers", value: String(selectedExp.total_fichiers) },
                            { label: "Date", value: fmtDate(selectedExp.created_at) },
                            { label: "Projet", value: selectedExp.projet_chemin.split("/").pop() ?? "" },
                          ].map(field => (
                            <div className="data-box" key={field.label}>
                              <label>{field.label}</label>
                              <span>{field.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="section-mini-title">Corrections IA associées</div>
                      {corrections.filter(c => c.fichier_path.includes(selectedExp.projet_nom.split("/").pop() ?? "")).length === 0 ? (
                        <div style={{ color: D.faint, fontSize: 12, textAlign: "center", padding: "15px 0" }}>
                          Aucune correction liée
                        </div>
                      ) : corrections
                        .filter(c => c.fichier_path.includes(selectedExp.projet_nom.split("/").pop() ?? ""))
                        .slice(0, 5)
                        .map(c => (
                          <div className="related-card" key={c.id}>
                            <div style={{ display: "flex", gap: 7, marginBottom: 5, alignItems: "center" }}>
                              <span style={{ fontSize: 9, fontWeight: 750, padding: "3px 7px", borderRadius: 20, color: sevColor(c.vuln_severite), background: `${sevColor(c.vuln_severite)}15` }}>
                                {c.vuln_severite}
                              </span>
                              <span style={{ fontSize: 11, color: D.muted }}>{c.vuln_type}</span>
                            </div>
                            <div style={{ fontSize: 10, fontFamily: "monospace", color: D.faint }}>
                              {c.fichier_path.split("/").pop()}
                            </div>
                          </div>
                        ))}

                      <button className="primary-button" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={() => router.push("/Exploreformpage")}>
                        ↗ Ré-ouvrir l'explorateur
                      </button>
                    </aside>
                  ) : (
                    <div className="empty-detail">
                      <div>
                        <div className="icon">🗂️</div>
                        <strong>Sélectionnez une session</strong>
                        <p>Consultez le dépôt exploré, la branche et les éventuelles corrections associées.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "corrections" && (
                <div className="board-body">
                  <div className={`list-pane ${selectedCorr ? "" : "no-detail"}`}>
                    <div className="toolbar">
                      <div className="search">
                        <span>⌕</span>
                        <input
                          className="control"
                          value={searchCorr}
                          onChange={e => setSearchCorr(e.target.value)}
                          placeholder="Rechercher par fichier ou vulnérabilité..."
                        />
                      </div>
                      <select className="control" style={{ width: 170 }} value={filterSev} onChange={e => setFilterSev(e.target.value)}>
                        <option value="all">Toutes sévérités</option>
                        <option value="CRITIQUE">Critique</option>
                        <option value="HAUTE">Haute</option>
                        <option value="MOYENNE">Moyenne</option>
                        <option value="FAIBLE">Faible</option>
                      </select>
                    </div>

                    {loadingCorr ? <Spinner /> : filteredCorr.length === 0 ? (
                      <Empty icon="⚡" msg="Aucune correction IA" sub="Les corrections appliquées depuis l'explorateur apparaîtront ici." />
                    ) : (
                      <div className="rows">
                        {filteredCorr.map(c => {
                          const style = corrStatusStyle(c.statut);
                          const file = extIcon(c.fichier_path);
                          return (
                            <div
                              key={c.id}
                              className={`row ${selectedCorr?.id === c.id ? "selected" : ""}`}
                              onClick={() => setSelectedCorr(selectedCorr?.id === c.id ? null : c)}
                            >
                              <div className="row-main">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="row-title">
                                    <span className="file-icon" style={{ color: file.color, background: `${file.color}16` }}>{file.icon}</span>
                                    {c.fichier_path.split("/").pop()}
                                    <span style={{ color: D.faint, fontSize: 10, fontFamily: "monospace" }}>L{c.vuln_ligne}</span>
                                  </div>
                                  <div className="row-meta">
                                    <span className="pill" style={{ color: sevColor(c.vuln_severite), background: `${sevColor(c.vuln_severite)}14` }}>
                                      {c.vuln_severite}
                                    </span>
                                    <span style={{ fontSize: 11, color: D.muted }}>{c.vuln_type}</span>
                                  </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div className="date" style={{ marginBottom: 6 }}>{fmtDate(c.created_at)}</div>
                                  <span className="pill" style={{ color: style.color, background: style.bg }}>{style.label}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedCorr ? (
                    <aside className="detail-pane">
                      <button className="detail-close" onClick={() => setSelectedCorr(null)}>← Fermer</button>

                      <div className="detail-card" style={{ borderLeft: `4px solid ${sevColor(selectedCorr.vuln_severite)}` }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                          <span className="pill" style={{ color: sevColor(selectedCorr.vuln_severite), background: `${sevColor(selectedCorr.vuln_severite)}15` }}>
                            {selectedCorr.vuln_severite}
                          </span>
                          <h3 style={{ margin: 0 }}>{selectedCorr.vuln_type}</h3>
                        </div>
                        <div className="detail-grid">
                          {[
                            { label: "Fichier", value: selectedCorr.fichier_path.split("/").pop() ?? "" },
                            { label: "Ligne", value: `L${selectedCorr.vuln_ligne}` },
                            { label: "Date", value: fmtDateFull(selectedCorr.created_at) },
                            { label: "Statut", value: selectedCorr.statut },
                          ].map(field => (
                            <div className="data-box" key={field.label}>
                              <label>{field.label}</label>
                              <span>{field.value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: D.faint, fontFamily: "monospace", background: D.card, borderRadius: 9, padding: "9px 10px", marginTop: 11, wordBreak: "break-all" }}>
                          📄 {selectedCorr.fichier_path}
                        </div>
                      </div>

                      {selectedCorr.vuln_suggestion && (
                        <div className="detail-card">
                          <div className="section-mini-title">Suggestion appliquée</div>
                          <div className="suggestion">{selectedCorr.vuln_suggestion}</div>
                        </div>
                      )}
                    </aside>
                  ) : (
                    <div className="empty-detail">
                      <div>
                        <div className="icon">⚡</div>
                        <strong>Sélectionnez une correction</strong>
                        <p>Consultez la vulnérabilité concernée, le fichier et la suggestion IA.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "mrs" && (
                <div className="board-body">
                  <div className={`list-pane ${selectedMr ? "" : "no-detail"}`}>
                    <div className="toolbar">
                      <div className="search">
                        <span>⌕</span>
                        <input
                          className="control"
                          value={searchMrs}
                          onChange={e => setSearchMrs(e.target.value)}
                          placeholder="Rechercher par projet ou titre..."
                        />
                      </div>
                      <select className="control" style={{ width: 160 }} value={filterMrStatus} onChange={e => setFilterMrStatus(e.target.value)}>
                        <option value="all">Tous statuts</option>
                        <option value="opened">Open</option>
                        <option value="merged">Merged</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    {loadingMrs ? <Spinner /> : filteredMrs.length === 0 ? (
                      <Empty icon="⟁" msg="Aucune Merge Request" sub="Les changements poussés depuis l'explorateur apparaîtront ici." />
                    ) : (
                      <div className="rows">
                        {filteredMrs.map(m => {
                          const style = mrStatusStyle(m.statut);
                          let fileCount = 0;
                          try { fileCount = m.fichiers_modifies ? JSON.parse(m.fichiers_modifies).length : 0; } catch {}
                          return (
                            <div
                              key={m.id}
                              className={`row ${selectedMr?.id === m.id ? "selected" : ""}`}
                              onClick={() => setSelectedMr(selectedMr?.id === m.id ? null : m)}
                            >
                              <div className="row-main">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="row-title">
                                    <span style={{ color: D.faint, fontSize: 10, fontFamily: "monospace" }}>!{m.mr_iid_gitlab}</span>
                                    {m.titre}
                                  </div>
                                  <div className="row-sub">{m.projet_nom}</div>
                                  <div className="row-meta">
                                    <span className="pill" style={{ color: D.accent }}>{m.branche_source}</span>
                                    <span style={{ color: D.faint, fontSize: 10 }}>→</span>
                                    <span className="pill" style={{ color: "#10b981" }}>{m.branche_cible}</span>
                                    {fileCount > 0 && <span className="pill">{fileCount} fichier{fileCount !== 1 ? "s" : ""}</span>}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div className="date" style={{ marginBottom: 7 }}>{fmtDate(m.created_at)}</div>
                                  <span className="pill" style={{ color: style.color, background: style.bg }}>{style.label}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedMr ? (() => {
                    const style = mrStatusStyle(selectedMr.statut);
                    let files: string[] = [];
                    try { files = selectedMr.fichiers_modifies ? JSON.parse(selectedMr.fichiers_modifies) : []; } catch {}
                    return (
                      <aside className="detail-pane">
                        <button className="detail-close" onClick={() => setSelectedMr(null)}>← Fermer</button>

                        <div className="detail-card">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 13 }}>
                            <div>
                              <div style={{ fontSize: 10, color: D.faint, fontFamily: "monospace", marginBottom: 4 }}>!{selectedMr.mr_iid_gitlab}</div>
                              <h3 style={{ margin: 0 }}>{selectedMr.titre}</h3>
                            </div>
                            <span className="pill" style={{ color: style.color, background: style.bg, height: "fit-content" }}>{style.label}</span>
                          </div>

                          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 11px", borderRadius: 10, background: D.card, marginBottom: 12 }}>
                            <span style={{ fontSize: 10, color: D.accent, fontFamily: "monospace", fontWeight: 650 }}>{selectedMr.branche_source}</span>
                            <span style={{ color: D.faint }}>→</span>
                            <span style={{ fontSize: 10, color: "#10b981", fontFamily: "monospace", fontWeight: 650 }}>{selectedMr.branche_cible}</span>
                          </div>

                          <div className="detail-grid">
                            {[
                              { label: "Projet", value: selectedMr.projet_nom },
                              { label: "Date", value: fmtDate(selectedMr.created_at) },
                              { label: "Fichiers", value: String(files.length) },
                              { label: "Chemin", value: selectedMr.projet_chemin.split("/").pop() ?? "" },
                            ].map(field => (
                              <div className="data-box" key={field.label}>
                                <label>{field.label}</label>
                                <span>{field.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {files.length > 0 && (
                          <div className="detail-card">
                            <div className="section-mini-title">Fichiers modifiés</div>
                            <div className="file-tags">
                              {files.slice(0, 12).map((file, index) => {
                                const ext = extIcon(file);
                                return (
                                  <span className="file-tag" key={index} style={{ color: ext.color, background: `${ext.color}10`, border: `1px solid ${ext.color}25` }}>
                                    <strong style={{ fontSize: 8 }}>{ext.icon}</strong>
                                    {file.split("/").pop()}
                                  </span>
                                );
                              })}
                              {files.length > 12 && (
                                <span style={{ fontSize: 10, color: D.faint }}>+{files.length - 12} autres</span>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedMr.mr_url && selectedMr.mr_url !== "none" && (
                          <a className="gitlab-link" href={selectedMr.mr_url} target="_blank" rel="noreferrer">
                            🦊 Voir la Merge Request sur GitLab ↗
                          </a>
                        )}
                      </aside>
                    );
                  })() : (
                    <div className="empty-detail">
                      <div>
                        <div className="icon">⟁</div>
                        <strong>Sélectionnez une MR</strong>
                        <p>Consultez les branches, les fichiers poussés et ouvrez la MR GitLab.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="quick-actions">
              {[
                { icon: "🗂️", label: "Nouvelle exploration", sub: "Explorer un dépôt GitLab", action: () => router.push("/Exploreformpage"), color: "#6366f1" },
                { icon: "◎", label: "Lancer une analyse", sub: "Analyser la qualité du code", action: () => router.push("/analyse"), color: "#10b981" },
                { icon: "⟁", label: "Mes Merge Requests", sub: "Voir toutes les MRs", action: () => router.push("/merge-requests"), color: "#8b5cf6" },
              ].map(action => (
                <button className="quick" key={action.label} onClick={action.action}>
                  <div className="quick-icon" style={{ color: action.color, background: `${action.color}14` }}>{action.icon}</div>
                  <div>
                    <strong>{action.label}</strong>
                    <span>{action.sub}</span>
                  </div>
                </button>
              ))}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
