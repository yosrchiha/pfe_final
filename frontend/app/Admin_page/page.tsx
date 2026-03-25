"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Chart, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  DoughnutController, BarController,
} from "chart.js";

Chart.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  DoughnutController, BarController
);

const API = "http://127.0.0.1:8000";

interface Stats  { total_users: number; active_users: number; total_depots: number; admin_count: number; }
interface User   { id: number; email: string; username: string | null; role: string; is_active: boolean; created_at: string | null; depot_count: number; }
interface Depot  { id: number; nom: string; url_branche_principale: string | null; proprietaire_id: number; owner_email: string | null; created_at: string | null; }

interface DepotAnalyse {
  id          : number;
  user_id     : number;
  nom         : string;
  project_url : string;
  branche     : string;
  created_at  : string;
}

interface Analyse {
  id                : number;
  depot_analyse_id  : number;
  branche           : string;
  score_qualite     : number;
  score_securite    : number;
  score_performance : number;
  vulnerabilites    : any[];
  statut            : string;
  created_at        : string;
}

// ── Donut Chart ────────────────────────────────────────
function DonutChart({ data, labels, colors, total, center }: {
  data: number[]; labels: string[]; colors: string[]; total: number; center: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ch  = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ch.current?.destroy();
    ch.current = new Chart(ref.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c + "99"),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: "74%",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#080a14",
            borderColor: "#1a1e35",
            borderWidth: 1,
            titleColor: "#e8eaf6",
            bodyColor: "#8890b0",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont:  { family: "JetBrains Mono", size: 11 },
            padding: 12,
            callbacks: {
              label: (ctx) => `  ${ctx.label} : ${ctx.parsed}  (${total > 0 ? Math.round(ctx.parsed / total * 100) : 0}%)`
            }
          },
        },
      },
    });
    return () => ch.current?.destroy();
  }, [JSON.stringify(data)]);

  return (
    <div style={{ position: "relative", height: 160, width: 160, margin: "0 auto" }}>
      <canvas ref={ref}/>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none"
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#e8eaf6", fontFamily: "JetBrains Mono" }}>{total}</div>
        <div style={{ fontSize: 9, color: "#3a4060", fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: "0.08em" }}>{center}</div>
      </div>
    </div>
  );
}

// ── Bar Chart ──────────────────────────────────────────
function BarChart({ labels, data, color }: { labels: string[]; data: number[]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ch  = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ch.current?.destroy();
    ch.current = new Chart(ref.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: color + "44",
          borderColor: color,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false as any,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#080a14",
            borderColor: "#1a1e35",
            borderWidth: 1,
            titleColor: "#e8eaf6",
            bodyColor: "#8890b0",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont:  { family: "JetBrains Mono", size: 11 },
            padding: 12,
          },
        },
        scales: {
          x: {
            grid: { color: "#1a1e35" },
            ticks: { color: "#3a4060", font: { family: "JetBrains Mono", size: 9 } },
            border: { color: "#1a1e35" },
          },
          y: {
            grid: { color: "#1a1e35" },
            ticks: { color: "#3a4060", font: { family: "JetBrains Mono", size: 9 }, stepSize: 1 },
            border: { color: "#1a1e35" },
            beginAtZero: true,
          },
        },
      },
    });
    return () => ch.current?.destroy();
  }, [JSON.stringify(data)]);

  return <div style={{ position: "relative", height: 180 }}><canvas ref={ref}/></div>;
}

// ── Main component ─────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();

  const [tab,       setTab]       = useState<"overview"|"users"|"depots"|"analyses">("overview");
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [users,     setUsers]     = useState<User[]>([]);
  const [depots,    setDepots]    = useState<Depot[]>([]);
  const [depotsA,   setDepotsA]   = useState<DepotAnalyse[]>([]);
  const [analyses,  setAnalyses]  = useState<Analyse[]>([]);
  const [search,    setSearch]    = useState("");
  const [selUser,   setSelUser]   = useState<User | null>(null);
  const [userDepots,setUserDepots]= useState<Depot[]>([]);
  const [selAnalyse,setSelAnalyse]= useState<Analyse | null>(null);
  const [loadingA,  setLoadingA]  = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [sR, uR, dR] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/depots`),
      ]);
      setStats(sR.data);
      setUsers(uR.data);
      setDepots(dR.data);
    } catch {}
  };

  // Charger tous les dépôts analysés
  const loadDepotsAnalyse = async () => {
    setLoadingA(true);
    try {
      // On charge pour chaque user ses dépôts analysés
      const allDepots: DepotAnalyse[] = [];
      const allAnalyses: Analyse[] = [];
      for (const u of users) {
        try {
          const r = await axios.get(`${API}/analyses/depots-user/${u.id}`);
          allDepots.push(...r.data);
          for (const d of r.data) {
            try {
              const ar = await axios.get(`${API}/analyses/depot/${d.id}`);
              allAnalyses.push(...ar.data);
            } catch {}
          }
        } catch {}
      }
      setDepotsA(allDepots);
      setAnalyses(allAnalyses);
    } catch {}
    finally { setLoadingA(false); }
  };

  useEffect(() => {
    if ((tab === "analyses" || tab === "depots") && users.length > 0) {
      loadDepotsAnalyse();
    }
  }, [tab, users]);

  const openUser = async (u: User) => {
    setSelUser(u);
    try { const r = await axios.get(`${API}/admin/users/${u.id}/depots`); setUserDepots(r.data); }
    catch { setUserDepots([]); }
  };

  const toggleActive = async (u: User) => {
    await axios.patch(`${API}/admin/users/${u.id}/active`, { is_active: !u.is_active });
    const upd = { ...u, is_active: !u.is_active };
    setUsers(p => p.map(x => x.id === u.id ? upd : x));
    if (selUser?.id === u.id) setSelUser(upd);
    loadAll();
  };

  const toggleRole = async (u: User) => {
    const r = u.role === "admin" ? "user" : "admin";
    await axios.patch(`${API}/admin/users/${u.id}/role`, { role: r });
    const upd = { ...u, role: r };
    setUsers(p => p.map(x => x.id === u.id ? upd : x));
    if (selUser?.id === u.id) setSelUser(upd);
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await axios.delete(`${API}/admin/users/${id}`);
    setUsers(p => p.filter(x => x.id !== id));
    if (selUser?.id === id) setSelUser(null);
    loadAll();
  };

  const deleteDepot = async (id: number) => {
    if (!confirm("Supprimer ce dépôt ?")) return;
    await axios.delete(`${API}/admin/depots/${id}`);
    setDepots(p => p.filter(x => x.id !== id));
    setUserDepots(p => p.filter(x => x.id !== id));
    loadAll();
  };

  // Stats
  const adminCount    = stats?.admin_count ?? 0;
  const userCount     = (stats?.total_users ?? 0) - adminCount;
  const activeCount   = stats?.active_users ?? 0;
  const inactiveCount = (stats?.total_users ?? 0) - activeCount;
  const totalUsers    = stats?.total_users ?? 0;
  const totalDepots   = stats?.total_depots ?? 0;

  const topUsers = [...users]
    .filter(u => u.depot_count > 0)
    .sort((a, b) => b.depot_count - a.depot_count)
    .slice(0, 8);

  const scoresMoyens = analyses.length > 0
    ? Math.round(analyses.reduce((a, b) => a + (b.score_qualite || 0), 0) / analyses.length)
    : 0;
  const totalVulns = analyses.reduce((a, b) => a + (b.vulnerabilites?.length || 0), 0);

  const filteredUsers   = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredDepots  = depots.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    (d.owner_email || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredDepotsA = depotsA.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    d.project_url.toLowerCase().includes(search.toLowerCase())
  );
  const filteredAnalyses = analyses.filter(a =>
    a.branche.toLowerCase().includes(search.toLowerCase()) ||
    a.statut.toLowerCase().includes(search.toLowerCase())
  );

  const c = (s: number) => {
    if (!s) return "#3a4060";
    if (s >= 75) return "#00d4aa";
    if (s >= 50) return "#ffd166";
    return "#ff6b6b";
  };

  const cSev = (s: string) => {
    if (s === "CRITIQUE") return "#ff6b6b";
    if (s === "HAUTE")    return "#f97316";
    if (s === "MOYENNE")  return "#ffd166";
    return "#00d4aa";
  };

  const navItems = [
    { key: "overview",  icon: "▦", label: "Vue globale",   count: null },
    { key: "users",     icon: "◉", label: "Utilisateurs",  count: users.length },
    { key: "depots",    icon: "◈", label: "Dépôts GitLab", count: depots.length },
    { key: "analyses",  icon: "◎", label: "Analyses IA",   count: analyses.length },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg       : #060810;
          --surface  : #0b0d1a;
          --card     : #0f1222;
          --card2    : #131629;
          --border   : #1a1e35;
          --border2  : #252a45;
          --accent   : #5b63f5;
          --accent2  : #818cf8;
          --green    : #00d4aa;
          --red      : #ff6b6b;
          --yellow   : #ffd166;
          --orange   : #f97316;
          --purple   : #a855f7;
          --text     : #e8eaf6;
          --text2    : #6870a0;
          --text3    : #2e3355;
          --mono     : 'JetBrains Mono', monospace;
          --display  : 'Outfit', sans-serif;
        }

        body { background: var(--bg); overflow: hidden; }

        .root {
          display: flex; flex-direction: column;
          height: 100vh; background: var(--bg);
          font-family: var(--display); color: var(--text);
          overflow: hidden;
        }

        /* ══ TOPBAR ═══════════════════════════════════════ */
        .topbar {
          display: flex; align-items: center; gap: 12px;
          padding: 0 24px; height: 52px; flex-shrink: 0;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .top-logo {
          width: 30px; height: 30px; border-radius: 7px;
          background: linear-gradient(135deg, var(--accent), var(--purple));
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; color: #fff;
          box-shadow: 0 0 16px #5b63f540;
        }
        .top-name { font-size: 14px; font-weight: 700; color: var(--text); }
        .top-badge {
          font-size: 8px; font-family: var(--mono); font-weight: 600;
          color: var(--accent2); background: #5b63f515;
          border: 1px solid #5b63f530; border-radius: 4px;
          padding: 2px 7px; letter-spacing: 0.1em;
        }
        .top-sep { flex: 1; }
        .top-back {
          padding: 6px 14px; background: transparent;
          border: 1px solid var(--border2); border-radius: 7px;
          color: var(--text2); font-family: var(--mono);
          font-size: 10px; cursor: pointer; transition: all 0.15s;
        }
        .top-back:hover { border-color: var(--accent); color: var(--text); }

        /* ══ BODY ═════════════════════════════════════════ */
        .body { display: flex; flex: 1; overflow: hidden; }

        /* ══ SIDEBAR ══════════════════════════════════════ */
        .sidebar {
          width: 210px; min-width: 210px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          padding: 16px 10px;
          overflow-y: auto;
        }
        .nav-section {
          font-size: 8px; font-weight: 600; color: var(--text3);
          font-family: var(--mono); letter-spacing: 0.14em;
          text-transform: uppercase; padding: 0 8px 10px;
        }
        .nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 10px; border-radius: 8px;
          cursor: pointer; transition: all 0.15s;
          color: var(--text3); font-size: 12px;
          font-weight: 500; margin-bottom: 2px;
          border: 1px solid transparent;
        }
        .nav-item:hover { background: #ffffff05; color: var(--text2); }
        .nav-item-active {
          background: #5b63f510; color: var(--text);
          border-color: #5b63f525;
          box-shadow: inset 3px 0 0 var(--accent);
        }
        .nav-icon { font-size: 13px; width: 18px; text-align: center; }
        .nav-badge {
          margin-left: auto; font-size: 9px; font-family: var(--mono);
          background: var(--border); color: var(--text2);
          padding: 1px 7px; border-radius: 10px;
        }
        .nav-item-active .nav-badge {
          background: #5b63f520; color: var(--accent2);
        }

        .sidebar-stats { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border); }
        .mini-stat { padding: 8px 10px; border-radius: 7px; margin-bottom: 4px; background: var(--card); border: 1px solid var(--border); }
        .mini-stat-val { font-size: 18px; font-weight: 800; font-family: var(--mono); color: var(--text); }
        .mini-stat-lbl { font-size: 8px; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.07em; }

        /* ══ MAIN ═════════════════════════════════════════ */
        .main {
          flex: 1; overflow-y: auto; padding: 22px 26px;
          background: var(--bg);
        }
        .main::-webkit-scrollbar { width: 4px; }
        .main::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        .page-header { margin-bottom: 20px; }
        .page-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .page-sub   { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-top: 3px; }

        /* ══ STAT CARDS ═══════════════════════════════════ */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px 18px;
          position: relative; overflow: hidden; transition: transform 0.15s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--ac);
        }
        .stat-card-icon {
          font-size: 22px; margin-bottom: 10px; opacity: 0.8;
        }
        .stat-card-val {
          font-size: 30px; font-weight: 800; color: var(--ac);
          font-family: var(--mono); line-height: 1; margin-bottom: 4px;
        }
        .stat-card-lbl {
          font-size: 9px; color: var(--text3); font-family: var(--mono);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .stat-card-delta {
          position: absolute; top: 14px; right: 14px;
          font-size: 9px; font-family: var(--mono);
          color: var(--green); background: #00d4aa10;
          padding: 2px 7px; border-radius: 10px;
          border: 1px solid #00d4aa20;
        }

        /* ══ CHARTS ═══════════════════════════════════════ */
        .charts-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
        .chart-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; padding: 18px;
        }
        .chart-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
        .chart-sub   { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-bottom: 14px; }

        .legend { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
        .legend-row { display: flex; align-items: center; gap: 8px; }
        .legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .legend-lbl { font-size: 10px; color: var(--text2); flex: 1; }
        .legend-val { font-size: 10px; font-family: var(--mono); font-weight: 600; color: var(--text); }
        .legend-pct { font-size: 9px; font-family: var(--mono); color: var(--text3); min-width: 28px; text-align: right; }

        /* ══ SEARCH ═══════════════════════════════════════ */
        .search-bar {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 14px;
        }
        .search-wrap { position: relative; flex: 1; }
        .search-ico { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text3); font-size: 13px; pointer-events: none; }
        .search-input {
          width: 100%; background: var(--card); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px 8px 34px;
          color: var(--text); font-family: var(--mono); font-size: 11px;
          outline: none; transition: border-color 0.15s;
        }
        .search-input::placeholder { color: var(--text3); }
        .search-input:focus { border-color: #5b63f555; }
        .search-count { font-size: 10px; color: var(--text3); font-family: var(--mono); white-space: nowrap; }

        /* ══ TABLE ════════════════════════════════════════ */
        .table-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        .th {
          padding: 10px 14px; text-align: left;
          font-size: 8px; font-weight: 600; color: var(--text3);
          font-family: var(--mono); text-transform: uppercase;
          letter-spacing: 0.1em; background: var(--surface);
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .tr { border-bottom: 1px solid #1a1e3540; transition: background 0.12s; cursor: pointer; }
        .tr:last-child { border-bottom: none; }
        .tr:hover { background: #ffffff03; }
        .td { padding: 12px 14px; vertical-align: middle; font-size: 12px; }
        .td-mono { font-family: var(--mono); font-size: 10px; color: var(--text3); }
        .td-accent { color: var(--accent2); font-weight: 600; }

        /* ══ BADGES ═══════════════════════════════════════ */
        .badge { font-size: 9px; font-family: var(--mono); padding: 3px 8px; border-radius: 20px; font-weight: 500; }
        .badge-admin    { color: var(--accent2); background: #5b63f510; border: 1px solid #5b63f530; }
        .badge-user     { color: var(--text3);   background: var(--border); border: 1px solid var(--border2); }
        .badge-active   { color: var(--green);   background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .badge-inactive { color: var(--red);     background: #ff6b6b0d; border: 1px solid #ff6b6b20; }
        .badge-ok       { color: var(--green);   background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .badge-err      { color: var(--red);     background: #ff6b6b0d; border: 1px solid #ff6b6b20; }
        .badge-branch   { color: var(--green);   background: #00d4aa0d; border: 1px solid #00d4aa20; }

        .dot-blink { width: 5px; height: 5px; border-radius: 50%; display: inline-block; margin-right: 4px; animation: db 2s infinite; }
        @keyframes db { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* ══ SCORE CELL ═══════════════════════════════════ */
        .score-cell { display: flex; align-items: center; gap: 6px; }
        .score-n { font-size: 12px; font-weight: 700; font-family: var(--mono); color: var(--sc); min-width: 24px; }
        .score-track { flex: 1; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; min-width: 36px; }
        .score-fill  { height: 3px; border-radius: 2px; background: var(--sc); }

        /* ══ ACTIONS ══════════════════════════════════════ */
        .actions { display: flex; gap: 5px; }
        .btn-ico { width: 28px; height: 28px; background: transparent; border: 1px solid var(--border2); border-radius: 6px; color: var(--text2); font-size: 12px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
        .btn-ico:hover { border-color: var(--accent); color: var(--text); background: #5b63f510; }
        .btn-danger { width: 28px; height: 28px; background: transparent; border: 1px solid #ff6b6b25; border-radius: 6px; color: var(--red); font-size: 12px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
        .btn-danger:hover { background: #ff6b6b10; border-color: #ff6b6b50; }

        /* ══ PANEL DROITE ═════════════════════════════════ */
        .panel {
          width: 300px; min-width: 300px;
          background: var(--surface);
          border-left: 1px solid var(--border);
          overflow-y: auto; padding: 20px;
          animation: slideIn 0.2s ease;
        }
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .panel::-webkit-scrollbar { width: 3px; }
        .panel::-webkit-scrollbar-thumb { background: var(--border); }
        .panel-close { width: 28px; height: 28px; background: transparent; border: 1px solid var(--border2); border-radius: 6px; color: var(--text2); font-size: 16px; cursor: pointer; float: right; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .panel-close:hover { border-color: var(--red); color: var(--red); }
        .panel-title { font-size: 15px; font-weight: 800; color: var(--text); margin-bottom: 3px; clear: both; }
        .panel-sub   { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-bottom: 16px; }
        .panel-divider { height: 1px; background: var(--border); margin: 14px 0; }
        .info-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
        .info-row:last-of-type { border-bottom: none; }
        .info-key { font-size: 9px; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.07em; min-width: 70px; padding-top: 2px; }
        .info-val { font-size: 11px; color: var(--text2); font-family: var(--mono); word-break: break-all; }

        .panel-section { font-size: 9px; font-weight: 600; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em; margin: 14px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }

        .panel-btns { display: flex; flex-direction: column; gap: 6px; margin: 14px 0; }
        .panel-btn { padding: 8px 12px; border-radius: 7px; border: none; font-family: var(--display); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .panel-btn-green  { background: #00d4aa15; color: var(--green); border: 1px solid #00d4aa25; }
        .panel-btn-green:hover { background: #00d4aa25; }
        .panel-btn-red    { background: #ff6b6b10; color: var(--red); border: 1px solid #ff6b6b25; }
        .panel-btn-red:hover { background: #ff6b6b20; }
        .panel-btn-purple { background: #a855f710; color: var(--purple); border: 1px solid #a855f725; }
        .panel-btn-purple:hover { background: #a855f720; }
        .panel-btn-del { background: #ff6b6b08; color: var(--red); border: 1px solid #ff6b6b20; margin-top: 8px; }
        .panel-btn-del:hover { background: #ff6b6b15; }

        .depot-item { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 6px; }
        .depot-item-name { font-size: 11px; font-weight: 600; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .depot-item-url  { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* ══ ANALYSE DETAIL PANEL ═════════════════════════ */
        .scores-panel { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
        .sp-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; text-align: center; }
        .sp-val  { font-size: 22px; font-weight: 800; font-family: var(--mono); color: var(--sc); line-height: 1; }
        .sp-lbl  { font-size: 7px; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3px; }
        .sp-bar  { height: 2px; background: var(--border); border-radius: 1px; overflow: hidden; margin-top: 6px; }
        .sp-fill { height: 2px; border-radius: 1px; background: var(--sc); }

        .vuln-mini { background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--vc); border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
        .vuln-mini-top { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .vuln-sev { font-size: 7px; font-weight: 700; font-family: var(--mono); padding: 1px 6px; border-radius: 20px; background: var(--vc); color: #000; }
        .vuln-type { font-size: 10px; font-weight: 700; color: var(--text); }
        .vuln-loc  { font-size: 8px; color: var(--text3); font-family: var(--mono); margin-bottom: 4px; }
        .vuln-fix  { font-size: 9px; color: var(--text2); background: var(--bg); padding: 5px 8px; border-radius: 5px; }

        /* ══ EMPTY ════════════════════════════════════════ */
        .empty { text-align: center; padding: 40px; color: var(--text3); font-size: 11px; font-family: var(--mono); }

        /* ══ VULN TOTAL CELL ══════════════════════════════ */
        .vuln-chip { font-size: 10px; font-weight: 700; font-family: var(--mono); padding: 3px 9px; border-radius: 20px; }
        .vc-zero { color: var(--green); background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .vc-some { color: var(--red);   background: #ff6b6b0d; border: 1px solid #ff6b6b20; }

        /* ══ SPIN ═════════════════════════════════════════ */
        .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--border2); border-top: 2px solid var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ══ OVERVIEW BIG CHART ═══════════════════════════ */
        .big-chart { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
      `}</style>

      <div className="root">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="top-logo">A</div>
          <span className="top-name">AuditPlatform</span>
          <span className="top-badge">ADMIN PANEL</span>
          <div className="top-sep"/>
          <button className="top-back" onClick={() => router.push("/dashboard")}>← Dashboard</button>
        </div>

        <div className="body">

          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="nav-section">Navigation</div>
            {navItems.map(item => (
              <div
                key={item.key}
                className={`nav-item ${tab === item.key ? "nav-item-active" : ""}`}
                onClick={() => { setTab(item.key as any); setSearch(""); setSelUser(null); setSelAnalyse(null); }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.count !== null && <span className="nav-badge">{item.count}</span>}
              </div>
            ))}

            <div className="sidebar-stats">
              {[
                { val: totalUsers,   lbl: "Utilisateurs", col: "#5b63f5" },
                { val: totalDepots,  lbl: "Dépôts GitLab", col: "#f97316" },
                { val: depotsA.length, lbl: "Projets IA",  col: "#00d4aa" },
                { val: analyses.length, lbl: "Analyses",   col: "#a855f7" },
              ].map(s => (
                <div key={s.lbl} className="mini-stat">
                  <div className="mini-stat-val" style={{ color: s.col }}>{s.val}</div>
                  <div className="mini-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MAIN */}
          <div className="main">

            {/* ══════════ OVERVIEW ══════════════════════ */}
            {tab === "overview" && stats && (
              <>
                <div className="page-header">
                  <div className="page-title">Vue d'ensemble</div>
                  <div className="page-sub">Statistiques globales · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
                </div>

                {/* Stat cards */}
                <div className="stats-grid">
                  {[
                    { icon: "◉", label: "Utilisateurs",   val: totalUsers,         col: "#5b63f5",  delta: "actifs : " + activeCount },
                    { icon: "◈", label: "Dépôts GitLab",  val: totalDepots,        col: "#f97316",  delta: null },
                    { icon: "◎", label: "Projets IA",     val: depotsA.length,     col: "#00d4aa",  delta: null },
                    { icon: "🛡", label: "Admins",         val: adminCount,         col: "#a855f7",  delta: null },
                  ].map(s => (
                    <div key={s.label} className="stat-card" style={{ "--ac": s.col } as any}>
                      <div className="stat-card-icon">{s.icon}</div>
                      <div className="stat-card-val">{s.val}</div>
                      <div className="stat-card-lbl">{s.label}</div>
                      {s.delta && <div className="stat-card-delta">{s.delta}</div>}
                    </div>
                  ))}
                </div>

                {/* Charts row */}
                <div className="charts-row">
                  <div className="chart-card">
                    <div className="chart-title">Rôles utilisateurs</div>
                    <div className="chart-sub">Admins vs Utilisateurs</div>
                    <DonutChart
                      data={[adminCount, userCount]}
                      labels={["Admins", "Utilisateurs"]}
                      colors={["#a855f7", "#00d4aa"]}
                      total={totalUsers}
                      center="comptes"
                    />
                    <div className="legend">
                      {[
                        { label: "Admins",       val: adminCount, col: "#a855f7" },
                        { label: "Utilisateurs", val: userCount,  col: "#00d4aa" },
                      ].map(l => (
                        <div key={l.label} className="legend-row">
                          <div className="legend-dot" style={{ background: l.col }}/>
                          <span className="legend-lbl">{l.label}</span>
                          <span className="legend-val">{l.val}</span>
                          <span className="legend-pct">{totalUsers > 0 ? Math.round(l.val / totalUsers * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="chart-card">
                    <div className="chart-title">Statut des comptes</div>
                    <div className="chart-sub">Actifs vs Inactifs</div>
                    <DonutChart
                      data={[activeCount, inactiveCount]}
                      labels={["Actifs", "Inactifs"]}
                      colors={["#00d4aa", "#ff6b6b"]}
                      total={totalUsers}
                      center="comptes"
                    />
                    <div className="legend">
                      {[
                        { label: "Actifs",   val: activeCount,   col: "#00d4aa" },
                        { label: "Inactifs", val: inactiveCount, col: "#ff6b6b" },
                      ].map(l => (
                        <div key={l.label} className="legend-row">
                          <div className="legend-dot" style={{ background: l.col }}/>
                          <span className="legend-lbl">{l.label}</span>
                          <span className="legend-val">{l.val}</span>
                          <span className="legend-pct">{totalUsers > 0 ? Math.round(l.val / totalUsers * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="chart-card">
                    <div className="chart-title">Ressources globales</div>
                    <div className="chart-sub">Utilisateurs vs Dépôts</div>
                    <DonutChart
                      data={[totalUsers, totalDepots]}
                      labels={["Utilisateurs", "Dépôts"]}
                      colors={["#5b63f5", "#f97316"]}
                      total={totalUsers + totalDepots}
                      center="total"
                    />
                    <div className="legend">
                      {[
                        { label: "Utilisateurs", val: totalUsers,  col: "#5b63f5" },
                        { label: "Dépôts",       val: totalDepots, col: "#f97316" },
                      ].map(l => (
                        <div key={l.label} className="legend-row">
                          <div className="legend-dot" style={{ background: l.col }}/>
                          <span className="legend-lbl">{l.label}</span>
                          <span className="legend-val">{l.val}</span>
                          <span className="legend-pct">{(totalUsers + totalDepots) > 0 ? Math.round(l.val / (totalUsers + totalDepots) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bar chart dépôts par user */}
                {topUsers.length > 0 && (
                  <div className="big-chart">
                    <div className="chart-title">Dépôts par utilisateur</div>
                    <div className="chart-sub">Top {topUsers.length} utilisateurs</div>
                    <BarChart
                      labels={topUsers.map(u => u.username || u.email.split("@")[0])}
                      data={topUsers.map(u => u.depot_count)}
                      color="#f97316"
                    />
                  </div>
                )}

                {/* Derniers inscrits */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5a6080", fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                  Derniers inscrits
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {["#", "Email", "Username", "Rôle", "Statut", "Dépôts"].map(h => (
                          <th key={h} className="th">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 6).map(u => (
                        <tr key={u.id} className="tr" onClick={() => { setTab("users"); openUser(u); }}>
                          <td className="td td-mono">#{u.id}</td>
                          <td className="td td-accent">{u.email}</td>
                          <td className="td td-mono">{u.username || "—"}</td>
                          <td className="td"><span className={u.role === "admin" ? "badge badge-admin" : "badge badge-user"}>{u.role}</span></td>
                          <td className="td"><span className={u.is_active ? "badge badge-active" : "badge badge-inactive"}><div className="dot-blink" style={{ background: u.is_active ? "#00d4aa" : "#ff6b6b" }}/>{u.is_active ? "actif" : "inactif"}</span></td>
                          <td className="td td-mono">{u.depot_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ══════════ UTILISATEURS ══════════════════ */}
            {tab === "users" && (
              <>
                <div className="page-header">
                  <div className="page-title">Utilisateurs</div>
                  <div className="page-sub">{users.length} comptes enregistrés</div>
                </div>
                <div className="search-bar">
                  <div className="search-wrap">
                    <span className="search-ico">⌕</span>
                    <input className="search-input" placeholder="Rechercher par email ou username..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <span className="search-count">{filteredUsers.length} résultat(s)</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>{["#", "Email", "Username", "Rôle", "Statut", "Dépôts", "Actions"].map(h => <th key={h} className="th">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="tr" onClick={() => openUser(u)}>
                          <td className="td td-mono">#{u.id}</td>
                          <td className="td td-accent">{u.email}</td>
                          <td className="td td-mono">{u.username || "—"}</td>
                          <td className="td"><span className={u.role === "admin" ? "badge badge-admin" : "badge badge-user"}>{u.role}</span></td>
                          <td className="td"><span className={u.is_active ? "badge badge-active" : "badge badge-inactive"}><div className="dot-blink" style={{ background: u.is_active ? "#00d4aa" : "#ff6b6b" }}/>{u.is_active ? "actif" : "inactif"}</span></td>
                          <td className="td td-mono">{u.depot_count}</td>
                          <td className="td" onClick={e => e.stopPropagation()}>
                            <div className="actions">
                              <button className="btn-ico" title={u.is_active ? "Désactiver" : "Activer"} onClick={() => toggleActive(u)}>{u.is_active ? "⏸" : "▶"}</button>
                              <button className="btn-ico" title="Changer rôle" onClick={() => toggleRole(u)}>🛡</button>
                              <button className="btn-danger" title="Supprimer" onClick={() => deleteUser(u.id)}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && <tr><td colSpan={7} className="empty">Aucun utilisateur trouvé</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ══════════ DÉPÔTS GITLAB ════════════════ */}
            {tab === "depots" && (
              <>
                <div className="page-header">
                  <div className="page-title">Dépôts GitLab</div>
                  <div className="page-sub">{depots.length} dépôts enregistrés · {depotsA.length} projets analysés</div>
                </div>
                <div className="search-bar">
                  <div className="search-wrap">
                    <span className="search-ico">⌕</span>
                    <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <span className="search-count">{filteredDepots.length + filteredDepotsA.length} résultat(s)</span>
                </div>

                {/* Tab dépôts classiques */}
                <div style={{ fontSize: 9, fontWeight: 600, color: "#3a4060", fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  Dépôts configurés ({depots.length})
                </div>
                <div className="table-wrap" style={{ marginBottom: 16 }}>
                  <table>
                    <thead>
                      <tr>{["#", "Nom", "Branche principale", "Propriétaire", "Action"].map(h => <th key={h} className="th">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filteredDepots.map(d => (
                        <tr key={d.id} className="tr">
                          <td className="td td-mono">#{d.id}</td>
                          <td className="td td-accent">{d.nom}</td>
                          <td className="td td-mono" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.url_branche_principale || "—"}</td>
                          <td className="td td-mono">{d.owner_email || `user #${d.proprietaire_id}`}</td>
                          <td className="td"><button className="btn-danger" onClick={() => deleteDepot(d.id)}>🗑</button></td>
                        </tr>
                      ))}
                      {filteredDepots.length === 0 && <tr><td colSpan={5} className="empty">Aucun dépôt</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Projets analysés */}
                <div style={{ fontSize: 9, fontWeight: 600, color: "#3a4060", fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  Projets analysés par IA ({depotsA.length})
                </div>
                {loadingA ? (
                  <div className="empty"><div className="spin"/> Chargement...</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>{["#", "Nom", "URL GitLab", "Branche", "Date"].map(h => <th key={h} className="th">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {filteredDepotsA.map(d => (
                          <tr key={d.id} className="tr">
                            <td className="td td-mono">#{d.id}</td>
                            <td className="td td-accent">{d.nom}</td>
                            <td className="td td-mono" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.project_url}</td>
                            <td className="td"><span className="badge badge-branch">{d.branche}</span></td>
                            <td className="td td-mono">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                          </tr>
                        ))}
                        {filteredDepotsA.length === 0 && <tr><td colSpan={5} className="empty">Aucun projet analysé</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ══════════ ANALYSES IA ══════════════════ */}
            {tab === "analyses" && (
              <>
                <div className="page-header">
                  <div className="page-title">Analyses IA</div>
                  <div className="page-sub">
                    {analyses.length} analyses · score moyen : {scoresMoyens}% · {totalVulns} vulnérabilité(s) détectée(s)
                  </div>
                </div>

                {/* Ministatistiques */}
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                  {[
                    { label: "Total analyses",    val: analyses.length,                                     col: "#5b63f5" },
                    { label: "Score moyen",        val: scoresMoyens ? `${scoresMoyens}%` : "—",            col: c(scoresMoyens) },
                    { label: "Vulnérabilités",     val: totalVulns,                                         col: totalVulns > 0 ? "#ff6b6b" : "#00d4aa" },
                    { label: "Analyses terminées", val: analyses.filter(a => a.statut === "termine").length, col: "#00d4aa" },
                  ].map(s => (
                    <div key={s.label} className="stat-card" style={{ "--ac": s.col } as any}>
                      <div className="stat-card-val">{s.val}</div>
                      <div className="stat-card-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="search-bar">
                  <div className="search-wrap">
                    <span className="search-ico">⌕</span>
                    <input className="search-input" placeholder="Rechercher par branche ou statut..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <span className="search-count">{filteredAnalyses.length} résultat(s)</span>
                </div>

                {loadingA ? (
                  <div className="empty"><div className="spin"/> Chargement des analyses...</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>{["#", "Date", "Branche", "Qualité", "Sécurité", "Performance", "Vulnérabilités", "Statut"].map(h => <th key={h} className="th">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {filteredAnalyses.map(a => {
                          const v = a.vulnerabilites?.length || 0;
                          return (
                            <tr key={a.id} className="tr" onClick={() => setSelAnalyse(a)}>
                              <td className="td td-mono">#{a.id}</td>
                              <td className="td td-mono">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                              <td className="td"><span className="badge badge-branch">{a.branche}</span></td>
                              {[a.score_qualite, a.score_securite, a.score_performance].map((s, i) => (
                                <td key={i} className="td">
                                  <div className="score-cell" style={{ "--sc": c(s) } as any}>
                                    <span className="score-n">{s ?? "—"}</span>
                                    <div className="score-track"><div className="score-fill" style={{ width: `${s ?? 0}%` }}/></div>
                                  </div>
                                </td>
                              ))}
                              <td className="td">
                                <span className={`vuln-chip ${v === 0 ? "vc-zero" : "vc-some"}`}>
                                  {v === 0 ? "✓ 0" : `⚠ ${v}`}
                                </span>
                              </td>
                              <td className="td">
                                <span className={`badge ${a.statut === "termine" ? "badge-ok" : "badge-err"}`}>
                                  <div className="dot-blink" style={{ background: a.statut === "termine" ? "#00d4aa" : "#ff6b6b" }}/>
                                  {a.statut}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredAnalyses.length === 0 && <tr><td colSpan={8} className="empty">Aucune analyse trouvée</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* PANEL UTILISATEUR */}
          {selUser && tab === "users" && (
            <div className="panel">
              <button className="panel-close" onClick={() => setSelUser(null)}>×</button>
              <div className="panel-title">{selUser.username || selUser.email}</div>
              <div className="panel-sub">Détails du compte utilisateur</div>

              {[
                ["ID",        `#${selUser.id}`],
                ["Email",     selUser.email],
                ["Username",  selUser.username || "—"],
                ["Rôle",      selUser.role],
                ["Statut",    selUser.is_active ? "Actif" : "Inactif"],
                ["Dépôts",    String(selUser.depot_count)],
                ["Inscrit le", selUser.created_at ? new Date(selUser.created_at).toLocaleDateString("fr-FR") : "—"],
              ].map(([k, v]) => (
                <div key={k} className="info-row">
                  <span className="info-key">{k}</span>
                  <span className="info-val">{v}</span>
                </div>
              ))}

              <div className="panel-btns">
                <button className={`panel-btn ${selUser.is_active ? "panel-btn-red" : "panel-btn-green"}`} onClick={() => toggleActive(selUser)}>
                  {selUser.is_active ? "⏸ Désactiver" : "▶ Activer"}
                </button>
                <button className="panel-btn panel-btn-purple" onClick={() => toggleRole(selUser)}>
                  🛡 Passer en {selUser.role === "admin" ? "user" : "admin"}
                </button>
              </div>

              <div className="panel-section">Dépôts ({userDepots.length})</div>
              {userDepots.length === 0
                ? <div className="empty" style={{ padding: "14px 0" }}>Aucun dépôt</div>
                : userDepots.map(d => (
                  <div key={d.id} className="depot-item">
                    <div className="depot-item-name">{d.nom}</div>
                    <div className="depot-item-url">{d.url_branche_principale || "—"}</div>
                    <button className="panel-btn panel-btn-del" style={{ width: "100%", justifyContent: "center", fontSize: 11 }} onClick={() => deleteDepot(d.id)}>
                      🗑 Supprimer
                    </button>
                  </div>
                ))
              }

              <div style={{ marginTop: 16 }}>
                <button className="panel-btn panel-btn-del" style={{ width: "100%", justifyContent: "center" }} onClick={() => deleteUser(selUser.id)}>
                  🗑 Supprimer l'utilisateur
                </button>
              </div>
            </div>
          )}

          {/* PANEL ANALYSE DÉTAIL */}
          {selAnalyse && tab === "analyses" && (
            <div className="panel">
              <button className="panel-close" onClick={() => setSelAnalyse(null)}>×</button>
              <div className="panel-title">Analyse #{selAnalyse.id}</div>
              <div className="panel-sub">
                {new Date(selAnalyse.created_at).toLocaleDateString("fr-FR")} · branche {selAnalyse.branche}
              </div>

              <div className="scores-panel">
                {[
                  { label: "Qualité",     val: selAnalyse.score_qualite },
                  { label: "Sécurité",    val: selAnalyse.score_securite },
                  { label: "Performance", val: selAnalyse.score_performance },
                ].map(s => (
                  <div key={s.label} className="sp-card" style={{ "--sc": c(s.val) } as any}>
                    <div className="sp-val">{s.val ?? "—"}</div>
                    <div className="sp-lbl">{s.label}</div>
                    <div className="sp-bar"><div className="sp-fill" style={{ width: `${s.val ?? 0}%` }}/></div>
                  </div>
                ))}
              </div>

              <div className="panel-section">
                Vulnérabilités ({selAnalyse.vulnerabilites?.length || 0})
              </div>

              {(selAnalyse.vulnerabilites?.length || 0) === 0 ? (
                <div style={{ background: "#00d4aa0d", border: "1px solid #00d4aa20", borderRadius: 7, padding: "10px", textAlign: "center", color: "#00d4aa", fontSize: 11, fontWeight: 700 }}>
                  ✅ Code propre
                </div>
              ) : (
                selAnalyse.vulnerabilites.map((v: any, i: number) => (
                  <div key={i} className="vuln-mini" style={{ "--vc": cSev(v.severite) } as any}>
                    <div className="vuln-mini-top">
                      <span className="vuln-sev">{v.severite}</span>
                      <span className="vuln-type">{v.type}</span>
                    </div>
                    <div className="vuln-loc">📄 {v.fichier} — ligne {v.ligne}</div>
                    <div className="vuln-fix">💡 {v.suggestion}</div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}