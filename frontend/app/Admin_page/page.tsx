// frontend/app/admin/page.tsx
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
          backgroundColor: colors.map(c => c + "20"),
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
            backgroundColor: "#1e293b",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            titleColor: "#f1f5f9",
            bodyColor: "#94a3b8",
            titleFont: { family: "Inter", size: 11 },
            bodyFont:  { family: "Inter", size: 11 },
            padding: 12,
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
        <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>{total}</div>
        <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{center}</div>
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
          backgroundColor: color + "20",
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
            backgroundColor: "#1e293b",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            titleColor: "#f1f5f9",
            bodyColor: "#94a3b8",
          },
        },
        scales: {
          x: {
            grid: { color: "#e2e8f0" },
            ticks: { color: "#64748b", font: { size: 9 } },
            border: { color: "#e2e8f0" },
          },
          y: {
            grid: { color: "#e2e8f0" },
            ticks: { color: "#64748b", font: { size: 9 }, stepSize: 1 },
            border: { color: "#e2e8f0" },
            beginAtZero: true,
          },
        },
      },
    });
    return () => ch.current?.destroy();
  }, [JSON.stringify(data)]);

  return <div style={{ position: "relative", height: 180 }}><canvas ref={ref}/></div>;
}

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

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [sR, uR, dR] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: getHeaders() }),
        axios.get(`${API}/admin/users`, { headers: getHeaders() }),
        axios.get(`${API}/admin/depots`, { headers: getHeaders() }),
      ]);
      setStats(sR.data);
      setUsers(uR.data);
      setDepots(dR.data);
    } catch {}
  };

  const loadDepotsAnalyse = async () => {
    setLoadingA(true);
    try {
      const allDepots: DepotAnalyse[] = [];
      const allAnalyses: Analyse[] = [];
      for (const u of users) {
        try {
          const r = await axios.get(`${API}/analyses/depots-user/${u.id}`, { headers: getHeaders() });
          allDepots.push(...r.data);
          for (const d of r.data) {
            try {
              const ar = await axios.get(`${API}/analyses/depot/${d.id}`, { headers: getHeaders() });
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
    try { const r = await axios.get(`${API}/admin/users/${u.id}/depots`, { headers: getHeaders() }); setUserDepots(r.data); }
    catch { setUserDepots([]); }
  };

  const toggleActive = async (u: User) => {
    await axios.patch(`${API}/admin/users/${u.id}/active`, { is_active: !u.is_active }, { headers: getHeaders() });
    const upd = { ...u, is_active: !u.is_active };
    setUsers(p => p.map(x => x.id === u.id ? upd : x));
    if (selUser?.id === u.id) setSelUser(upd);
    loadAll();
  };

  const toggleRole = async (u: User) => {
    const r = u.role === "admin" ? "user" : "admin";
    await axios.patch(`${API}/admin/users/${u.id}/role`, { role: r }, { headers: getHeaders() });
    const upd = { ...u, role: r };
    setUsers(p => p.map(x => x.id === u.id ? upd : x));
    if (selUser?.id === u.id) setSelUser(upd);
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await axios.delete(`${API}/admin/users/${id}`, { headers: getHeaders() });
    setUsers(p => p.filter(x => x.id !== id));
    if (selUser?.id === id) setSelUser(null);
    loadAll();
  };

  const deleteDepot = async (id: number) => {
    if (!confirm("Supprimer ce dépôt ?")) return;
    await axios.delete(`${API}/admin/depots/${id}`, { headers: getHeaders() });
    setDepots(p => p.filter(x => x.id !== id));
    setUserDepots(p => p.filter(x => x.id !== id));
    loadAll();
  };

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

  const colorScore = (s: number) => {
    if (!s) return "#94a3b8";
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const colorSeverite = (s: string) => {
    if (s === "CRITIQUE") return "#ef4444";
    if (s === "HAUTE")    return "#f97316";
    if (s === "MOYENNE")  return "#eab308";
    return "#10b981";
  };

  const navItems = [
    { key: "overview",  icon: "▦", label: "Vue globale",   count: null },
    { key: "users",     icon: "◉", label: "Utilisateurs",  count: users.length },
    { key: "depots",    icon: "◈", label: "Dépôts",        count: depots.length },
    { key: "analyses",  icon: "◎", label: "Analyses IA",   count: analyses.length },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .admin {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          display: flex;
          flex-direction: column;
        }

        /* Topbar */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: white;
        }
        .title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .badge-admin {
          background: #eef2ff;
          color: #6366f1;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
        }
        .back-btn {
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 12px;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        /* Body */
        .body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* Sidebar */
        .sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid #eef2ff;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          overflow-y: auto;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          color: #475569;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 2px;
        }
        .nav-item:hover {
          background: #f8fafc;
          color: #0f172a;
        }
        .nav-item.active {
          background: #eef2ff;
          color: #6366f1;
        }
        .nav-icon {
          font-size: 18px;
          width: 24px;
        }
        .nav-badge {
          margin-left: auto;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
        }
        .sidebar-stats {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid #f1f5f9;
        }
        .mini-stat {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 8px;
        }
        .mini-stat-val {
          font-size: 20px;
          font-weight: 700;
        }
        .mini-stat-lbl {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }

        /* Main */
        .main {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
        }
        .main::-webkit-scrollbar {
          width: 6px;
        }
        .main::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .main::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .page-header {
          margin-bottom: 24px;
        }
        .page-title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .page-sub {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.2s;
        }
        .stat-card:hover {
          border-color: #e2e8f0;
          transform: translateY(-2px);
        }
        .stat-card-icon {
          font-size: 24px;
          margin-bottom: 12px;
        }
        .stat-card-val {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .stat-card-lbl {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        /* Charts */
        .charts-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }
        .chart-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px;
        }
        .chart-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .chart-sub {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 16px;
        }
        .legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 16px;
        }
        .legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .legend-lbl {
          flex: 1;
          font-size: 12px;
          color: #475569;
        }
        .legend-val {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
        }

        .big-chart {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
        }

        /* Search */
        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .search-wrapper {
          position: relative;
          flex: 1;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 14px;
        }
        .search-input {
          width: 100%;
          padding: 10px 16px 10px 42px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          background: white;
        }
        .search-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .search-count {
          font-size: 13px;
          color: #64748b;
        }

        /* Table */
        .table-container {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          overflow: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          text-align: left;
          padding: 14px 20px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: #fefefe;
          border-bottom: 1px solid #f1f5f9;
        }
        td {
          padding: 14px 20px;
          font-size: 13px;
          border-bottom: 1px solid #f8fafc;
          vertical-align: middle;
        }
        .table-row {
          cursor: pointer;
          transition: background 0.15s;
        }
        .table-row:hover {
          background: #faf9fe;
        }

        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 500;
        }
        .badge-admin {
          background: #eef2ff;
          color: #6366f1;
        }
        .badge-user {
          background: #f1f5f9;
          color: #475569;
        }
        .badge-active {
          background: #ecfdf5;
          color: #10b981;
        }
        .badge-inactive {
          background: #fef2f2;
          color: #ef4444;
        }
        .badge-branch {
          background: #eef2ff;
          color: #6366f1;
        }
        .badge-ok {
          background: #ecfdf5;
          color: #10b981;
        }
        .badge-err {
          background: #fef2f2;
          color: #ef4444;
        }
        .vuln-chip {
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 500;
        }
        .vc-zero {
          background: #ecfdf5;
          color: #10b981;
        }
        .vc-some {
          background: #fef2f2;
          color: #ef4444;
        }

        /* Score cell */
        .score-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .score-value {
          font-size: 13px;
          font-weight: 600;
          font-family: monospace;
          min-width: 32px;
        }
        .score-bar {
          flex: 1;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }
        .score-bar-fill {
          height: 4px;
          border-radius: 2px;
        }

        /* Actions */
        .actions {
          display: flex;
          gap: 6px;
        }
        .action-btn {
          width: 30px;
          height: 30px;
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }
        .action-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .action-btn-danger {
          background: #fef2f2;
          color: #ef4444;
        }
        .action-btn-danger:hover {
          background: #fee2e2;
        }

        /* Panel */
        .panel {
          width: 380px;
          background: white;
          border-left: 1px solid #eef2ff;
          overflow-y: auto;
          padding: 24px;
          animation: slideIn 0.2s ease;
        }
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .panel-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .panel-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .panel-close {
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          width: 28px;
          height: 28px;
          cursor: pointer;
          font-size: 16px;
          color: #64748b;
        }
        .panel-close:hover {
          background: #e2e8f0;
        }
        .info-row {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .info-label {
          width: 100px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .info-value {
          flex: 1;
          font-size: 13px;
          color: #1e293b;
          font-family: monospace;
        }
        .panel-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 20px 0;
        }
        .panel-btn {
          padding: 10px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .panel-btn-green {
          background: #ecfdf5;
          color: #10b981;
          border: 1px solid #bbf7d0;
        }
        .panel-btn-green:hover {
          background: #d1fae5;
        }
        .panel-btn-purple {
          background: #eef2ff;
          color: #6366f1;
          border: 1px solid #c7d2fe;
        }
        .panel-btn-purple:hover {
          background: #e0e7ff;
        }
        .panel-btn-red {
          background: #fef2f2;
          color: #ef4444;
          border: 1px solid #fee2e2;
        }
        .panel-btn-red:hover {
          background: #fee2e2;
        }

        .depot-item {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 8px;
        }
        .depot-name {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .depot-url {
          font-size: 10px;
          color: #64748b;
          font-family: monospace;
          word-break: break-all;
        }

        .scores-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 20px 0;
        }
        .score-panel-card {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          text-align: center;
        }
        .score-panel-value {
          font-size: 24px;
          font-weight: 700;
        }
        .score-panel-label {
          font-size: 10px;
          color: #64748b;
          margin-top: 4px;
        }

        .vuln-mini {
          background: #f8fafc;
          border: 1px solid #eef2ff;
          border-left: 3px solid;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 8px;
        }
        .vuln-mini-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .vuln-severity {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
        }
        .vuln-type {
          font-size: 12px;
          font-weight: 600;
        }
        .vuln-location {
          font-size: 10px;
          color: #64748b;
          font-family: monospace;
          margin-bottom: 6px;
        }
        .vuln-suggestion {
          font-size: 11px;
          color: #475569;
          background: white;
          padding: 6px 8px;
          border-radius: 8px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
        }
        .loading-state {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .sidebar { display: none; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .charts-row { grid-template-columns: 1fr; }
          .panel { width: 100%; }
        }
      `}</style>

      <div className="admin">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="logo">A</div>
            <span className="title">AuditPlatform</span>
            <span className="badge-admin">ADMIN</span>
          </div>
          <button className="back-btn" onClick={() => router.push("/dashboard")}>← Dashboard</button>
        </div>

        <div className="body">
          {/* Sidebar */}
          <div className="sidebar">
            {navItems.map(item => (
              <div
                key={item.key}
                className={`nav-item ${tab === item.key ? "active" : ""}`}
                onClick={() => { setTab(item.key as any); setSearch(""); setSelUser(null); setSelAnalyse(null); }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.count !== null && <span className="nav-badge">{item.count}</span>}
              </div>
            ))}

            <div className="sidebar-stats">
              <div className="mini-stat">
                <div className="mini-stat-val" style={{ color: "#6366f1" }}>{totalUsers}</div>
                <div className="mini-stat-lbl">Utilisateurs</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-val" style={{ color: "#f97316" }}>{totalDepots}</div>
                <div className="mini-stat-lbl">Dépôts</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-val" style={{ color: "#10b981" }}>{depotsA.length}</div>
                <div className="mini-stat-lbl">Projets IA</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-val" style={{ color: "#a855f7" }}>{analyses.length}</div>
                <div className="mini-stat-lbl">Analyses</div>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="main">
            {/* OVERVIEW */}
            {tab === "overview" && stats && (
              <>
                <div className="page-header">
                  <div className="page-title">Vue d'ensemble</div>
                  <div className="page-sub">
                    {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>

                <div className="stats-grid">
                  {[
                    { icon: "👥", label: "Utilisateurs",   val: totalUsers,    color: "#6366f1" },
                    { icon: "📁", label: "Dépôts",         val: totalDepots,   color: "#f97316" },
                    { icon: "🤖", label: "Projets IA",     val: depotsA.length, color: "#10b981" },
                    { icon: "🔍", label: "Analyses",       val: analyses.length, color: "#a855f7" },
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <div className="stat-card-icon">{s.icon}</div>
                      <div className="stat-card-val" style={{ color: s.color }}>{s.val}</div>
                      <div className="stat-card-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="charts-row">
                  <div className="chart-card">
                    <div className="chart-title">Rôles utilisateurs</div>
                    <div className="chart-sub">Admins vs Utilisateurs</div>
                    <DonutChart
                      data={[adminCount, userCount]}
                      labels={["Admins", "Utilisateurs"]}
                      colors={["#a855f7", "#10b981"]}
                      total={totalUsers}
                      center="comptes"
                    />
                    <div className="legend">
                      <div className="legend-row">
                        <div className="legend-dot" style={{ background: "#a855f7" }} />
                        <span className="legend-lbl">Admins</span>
                        <span className="legend-val">{adminCount}</span>
                      </div>
                      <div className="legend-row">
                        <div className="legend-dot" style={{ background: "#10b981" }} />
                        <span className="legend-lbl">Utilisateurs</span>
                        <span className="legend-val">{userCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="chart-card">
                    <div className="chart-title">Statut des comptes</div>
                    <div className="chart-sub">Actifs vs Inactifs</div>
                    <DonutChart
                      data={[activeCount, inactiveCount]}
                      labels={["Actifs", "Inactifs"]}
                      colors={["#10b981", "#ef4444"]}
                      total={totalUsers}
                      center="comptes"
                    />
                    <div className="legend">
                      <div className="legend-row">
                        <div className="legend-dot" style={{ background: "#10b981" }} />
                        <span className="legend-lbl">Actifs</span>
                        <span className="legend-val">{activeCount}</span>
                      </div>
                      <div className="legend-row">
                        <div className="legend-dot" style={{ background: "#ef4444" }} />
                        <span className="legend-lbl">Inactifs</span>
                        <span className="legend-val">{inactiveCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="chart-card">
                    <div className="chart-title">Ressources</div>
                    <div className="chart-sub">Utilisateurs vs Dépôts</div>
                    <DonutChart
                      data={[totalUsers, totalDepots]}
                      labels={["Utilisateurs", "Dépôts"]}
                      colors={["#6366f1", "#f97316"]}
                      total={totalUsers + totalDepots}
                      center="total"
                    />
                    <div className="legend">
                      <div className="legend-row">
                        <div className="legend-dot" style={{ background: "#6366f1" }} />
                        <span className="legend-lbl">Utilisateurs</span>
                        <span className="legend-val">{totalUsers}</span>
                      </div>
                      <div className="legend-row">
                        <div className="legend-dot" style={{ background: "#f97316" }} />
                        <span className="legend-lbl">Dépôts</span>
                        <span className="legend-val">{totalDepots}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {topUsers.length > 0 && (
                  <div className="big-chart">
                    <div className="chart-title">Dépôts par utilisateur</div>
                    <div className="chart-sub">Top {topUsers.length} contributeurs</div>
                    <BarChart
                      labels={topUsers.map(u => u.username || u.email.split("@")[0])}
                      data={topUsers.map(u => u.depot_count)}
                      color="#f97316"
                    />
                  </div>
                )}

                <div className="page-header" style={{ marginTop: 24, marginBottom: 16 }}>
                  <div className="page-title">Derniers inscrits</div>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>ID</th><th>Email</th><th>Username</th><th>Rôle</th><th>Statut</th><th>Dépôts</th></tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 6).map(u => (
                        <tr key={u.id} className="table-row" onClick={() => { setTab("users"); openUser(u); }}>
                          <td style={{ fontFamily: "monospace", color: "#64748b" }}>#{u.id}</td>
                          <td style={{ color: "#6366f1" }}>{u.email}</td>
                          <td>{u.username || "—"}</td>
                          <td><span className={`badge ${u.role === "admin" ? "badge-admin" : "badge-user"}`}>{u.role}</span></td>
                          <td><span className={`badge ${u.is_active ? "badge-active" : "badge-inactive"}`}>{u.is_active ? "Actif" : "Inactif"}</span></td>
                          <td>{u.depot_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* USERS */}
            {tab === "users" && (
              <>
                <div className="page-header">
                  <div className="page-title">Utilisateurs</div>
                  <div className="page-sub">{users.length} comptes enregistrés</div>
                </div>

                <div className="search-bar">
                  <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input className="search-input" placeholder="Rechercher par email ou username..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <span className="search-count">{filteredUsers.length} résultat(s)</span>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>ID</th><th>Email</th><th>Username</th><th>Rôle</th><th>Statut</th><th>Dépôts</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="table-row" onClick={() => openUser(u)}>
                          <td style={{ fontFamily: "monospace", color: "#64748b" }}>#{u.id}</td>
                          <td style={{ color: "#6366f1" }}>{u.email}</td>
                          <td>{u.username || "—"}</td>
                          <td><span className={`badge ${u.role === "admin" ? "badge-admin" : "badge-user"}`}>{u.role}</span></td>
                          <td><span className={`badge ${u.is_active ? "badge-active" : "badge-inactive"}`}>{u.is_active ? "Actif" : "Inactif"}</span></td>
                          <td>{u.depot_count}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="actions">
                              <button className="action-btn" title={u.is_active ? "Désactiver" : "Activer"} onClick={() => toggleActive(u)}>{u.is_active ? "⏸" : "▶"}</button>
                              <button className="action-btn" title="Changer rôle" onClick={() => toggleRole(u)}>🛡</button>
                              <button className="action-btn action-btn-danger" title="Supprimer" onClick={() => deleteUser(u.id)}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && <tr><td colSpan={7} className="empty-state">Aucun utilisateur trouvé</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* DEPOTS */}
            {tab === "depots" && (
              <>
                <div className="page-header">
                  <div className="page-title">Dépôts GitLab</div>
                  <div className="page-sub">{depots.length} dépôts enregistrés · {depotsA.length} projets analysés</div>
                </div>

                <div className="search-bar">
                  <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <span className="search-count">{filteredDepots.length + filteredDepotsA.length} résultat(s)</span>
                </div>

                <div className="page-header" style={{ marginTop: 24, marginBottom: 16 }}>
                  <div className="page-title">Dépôts configurés</div>
                  <div className="page-sub">{depots.length} dépôts</div>
                </div>
                <div className="table-container" style={{ marginBottom: 32 }}>
                  <table>
                    <thead><tr><th>ID</th><th>Nom</th><th>Branche principale</th><th>Propriétaire</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredDepots.map(d => (
                        <tr key={d.id} className="table-row">
                          <td style={{ fontFamily: "monospace", color: "#64748b" }}>#{d.id}</td>
                          <td style={{ fontWeight: 600 }}>{d.nom}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{d.url_branche_principale || "—"}</td>
                          <td>{d.owner_email || `user #${d.proprietaire_id}`}</td>
                          <td><button className="action-btn action-btn-danger" onClick={() => deleteDepot(d.id)}>🗑</button></td>
                        </tr>
                      ))}
                      {filteredDepots.length === 0 && <tr><td colSpan={5} className="empty-state">Aucun dépôt</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="page-header" style={{ marginBottom: 16 }}>
                  <div className="page-title">Projets analysés par IA</div>
                  <div className="page-sub">{depotsA.length} projets</div>
                </div>
                {loadingA ? (
                  <div className="loading-state"><div className="spinner" /> Chargement...</div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead><tr><th>ID</th><th>Nom</th><th>URL GitLab</th><th>Branche</th><th>Date</th></tr></thead>
                      <tbody>
                        {filteredDepotsA.map(d => (
                          <tr key={d.id} className="table-row">
                            <td style={{ fontFamily: "monospace", color: "#64748b" }}>#{d.id}</td>
                            <td style={{ fontWeight: 600 }}>{d.nom}</td>
                            <td style={{ fontFamily: "monospace", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{d.project_url}</td>
                            <td><span className="badge badge-branch">{d.branche}</span></td>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                          </tr>
                        ))}
                        {filteredDepotsA.length === 0 && <tr><td colSpan={5} className="empty-state">Aucun projet analysé</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ANALYSES */}
            {tab === "analyses" && (
              <>
                <div className="page-header">
                  <div className="page-title">Analyses IA</div>
                  <div className="page-sub">{analyses.length} analyses · score moyen : {scoresMoyens}% · {totalVulns} vulnérabilité(s)</div>
                </div>

                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-card-val" style={{ color: "#6366f1" }}>{analyses.length}</div><div className="stat-card-lbl">Total analyses</div></div>
                  <div className="stat-card"><div className="stat-card-val" style={{ color: colorScore(scoresMoyens) }}>{scoresMoyens ? `${scoresMoyens}%` : "—"}</div><div className="stat-card-lbl">Score moyen</div></div>
                  <div className="stat-card"><div className="stat-card-val" style={{ color: totalVulns > 0 ? "#ef4444" : "#10b981" }}>{totalVulns}</div><div className="stat-card-lbl">Vulnérabilités</div></div>
                  <div className="stat-card"><div className="stat-card-val" style={{ color: "#10b981" }}>{analyses.filter(a => a.statut === "termine").length}</div><div className="stat-card-lbl">Terminées</div></div>
                </div>

                <div className="search-bar">
                  <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input className="search-input" placeholder="Rechercher par branche ou statut..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <span className="search-count">{filteredAnalyses.length} résultat(s)</span>
                </div>

                {loadingA ? (
                  <div className="loading-state"><div className="spinner" /> Chargement...</div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead><tr><th>ID</th><th>Date</th><th>Branche</th><th>Qualité</th><th>Sécurité</th><th>Performance</th><th>Vulns</th><th>Statut</th></tr></thead>
                      <tbody>
                        {filteredAnalyses.map(a => {
                          const v = a.vulnerabilites?.length || 0;
                          return (
                            <tr key={a.id} className="table-row" onClick={() => setSelAnalyse(a)}>
                              <td style={{ fontFamily: "monospace", color: "#64748b" }}>#{a.id}</td>
                              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                              <td><span className="badge badge-branch">{a.branche}</span></td>
                              {[a.score_qualite, a.score_securite, a.score_performance].map((s, i) => (
                                <td key={i}>
                                  <div className="score-cell">
                                    <span className="score-value" style={{ color: colorScore(s) }}>{s ?? "—"}</span>
                                    <div className="score-bar"><div className="score-bar-fill" style={{ width: `${s ?? 0}%`, background: colorScore(s) }} /></div>
                                  </div>
                                </td>
                              ))}
                              <td><span className={`vuln-chip ${v === 0 ? "vc-zero" : "vc-some"}`}>{v === 0 ? "✓ 0" : `⚠ ${v}`}</span></td>
                              <td><span className={`badge ${a.statut === "termine" ? "badge-ok" : "badge-err"}`}>{a.statut}</span></td>
                            </tr>
                          );
                        })}
                        {filteredAnalyses.length === 0 && <tr><td colSpan={8} className="empty-state">Aucune analyse trouvée</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Panel Utilisateur */}
          {selUser && tab === "users" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">{selUser.username || selUser.email}</div>
                  <div className="panel-sub">Détails du compte</div>
                </div>
                <button className="panel-close" onClick={() => setSelUser(null)}>✕</button>
              </div>
              <div className="info-row"><div className="info-label">ID</div><div className="info-value">#{selUser.id}</div></div>
              <div className="info-row"><div className="info-label">Email</div><div className="info-value">{selUser.email}</div></div>
              <div className="info-row"><div className="info-label">Username</div><div className="info-value">{selUser.username || "—"}</div></div>
              <div className="info-row"><div className="info-label">Rôle</div><div className="info-value">{selUser.role}</div></div>
              <div className="info-row"><div className="info-label">Statut</div><div className="info-value">{selUser.is_active ? "Actif" : "Inactif"}</div></div>
              <div className="info-row"><div className="info-label">Dépôts</div><div className="info-value">{selUser.depot_count}</div></div>
              <div className="info-row"><div className="info-label">Inscrit le</div><div className="info-value">{selUser.created_at ? new Date(selUser.created_at).toLocaleDateString() : "—"}</div></div>

              <div className="panel-buttons">
                <button className={`panel-btn ${selUser.is_active ? "panel-btn-red" : "panel-btn-green"}`} onClick={() => toggleActive(selUser)}>
                  {selUser.is_active ? "⏸ Désactiver" : "▶ Activer"}
                </button>
                <button className="panel-btn panel-btn-purple" onClick={() => toggleRole(selUser)}>
                  🛡 Passer en {selUser.role === "admin" ? "user" : "admin"}
                </button>
              </div>

              <div className="panel-title" style={{ fontSize: 14, marginTop: 16, marginBottom: 12 }}>Dépôts ({userDepots.length})</div>
              {userDepots.length === 0 ? (
                <div className="empty-state">Aucun dépôt</div>
              ) : (
                userDepots.map(d => (
                  <div key={d.id} className="depot-item">
                    <div className="depot-name">{d.nom}</div>
                    <div className="depot-url">{d.url_branche_principale || "—"}</div>
                    <button className="panel-btn panel-btn-red" style={{ marginTop: 8, width: "100%" }} onClick={() => deleteDepot(d.id)}>🗑 Supprimer</button>
                  </div>
                ))
              )}

              <button className="panel-btn panel-btn-red" style={{ marginTop: 16 }} onClick={() => deleteUser(selUser.id)}>🗑 Supprimer l'utilisateur</button>
            </div>
          )}

          {/* Panel Analyse */}
          {selAnalyse && tab === "analyses" && (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Analyse #{selAnalyse.id}</div>
                  <div className="panel-sub">{new Date(selAnalyse.created_at).toLocaleString()} · {selAnalyse.branche}</div>
                </div>
                <button className="panel-close" onClick={() => setSelAnalyse(null)}>✕</button>
              </div>

              <div className="scores-panel">
                {[
                  { label: "Qualité", val: selAnalyse.score_qualite },
                  { label: "Sécurité", val: selAnalyse.score_securite },
                  { label: "Performance", val: selAnalyse.score_performance },
                ].map(s => (
                  <div key={s.label} className="score-panel-card">
                    <div className="score-panel-value" style={{ color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                    <div className="score-panel-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="panel-title" style={{ fontSize: 14, marginTop: 8, marginBottom: 12 }}>Vulnérabilités ({selAnalyse.vulnerabilites?.length || 0})</div>
              {(selAnalyse.vulnerabilites?.length || 0) === 0 ? (
                <div className="empty-state">✅ Code propre</div>
              ) : (
                selAnalyse.vulnerabilites.map((v: any, i: number) => (
                  <div key={i} className="vuln-mini" style={{ borderLeftColor: colorSeverite(v.severite) }}>
                    <div className="vuln-mini-header">
                      <span className="vuln-severity" style={{ background: `${colorSeverite(v.severite)}15`, color: colorSeverite(v.severite) }}>{v.severite}</span>
                      <span className="vuln-type">{v.type}</span>
                    </div>
                    <div className="vuln-location">📄 {v.fichier} — ligne {v.ligne}</div>
                    <div className="vuln-suggestion">💡 {v.suggestion}</div>
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