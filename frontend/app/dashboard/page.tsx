// frontend/app/dashboard/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface DepotAnalyse {
  id: number; nom: string; project_url: string; branche: string; created_at: string;
}
interface Analyse {
  id: number; depot_analyse_id: number; branche: string;
  score_qualite: number; score_securite: number; score_performance: number;
  vulnerabilites: any[]; recommandations: any[]; statut: string; created_at: string;
}
interface TicketNotif {
  id: number; subject: string; status: string;
}

const menuItems = [
  { key: "dashboard",      label: "Tableau de bord", icon: "▦",  href: "/dashboard" },
  { key: "repositories",   label: "Dépôts",          icon: "◈",  href: "/depots" },
  { key: "comparaisons",   label: "Comparaisons",    icon: "📊", href: "/comparaisons" },
  { key: "analyses",       label: "Analyse",         icon: "◎",  href: "/analyse" },
  { key: "tests",          label: "Tests",           icon: "🧪", href: "/TestsPaage" },
  { key: "issues",         label: "Issues",          icon: "◇",  href: "/issues" },
  { key: "merge_requests", label: "Merge Requests",  icon: "⟁",  href: "/merge-requests" },
  { key: "help",           label: "Support",         icon: "💬", href: "/help" },
];

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [username,       setUsername]       = useState("Utilisateur");
  const [activeMenu,     setActiveMenu]     = useState("dashboard");
  const [projets,        setProjets]        = useState<DepotAnalyse[]>([]);
  const [analyses,       setAnalyses]       = useState<Analyse[]>([]);
  const [projetActif,    setProjetActif]    = useState<DepotAnalyse | null>(null);
  const [analyseActif,   setAnalyseActif]   = useState<Analyse | null>(null);
  const [vue,            setVue]            = useState<"liste" | "detail">("liste");
  const [loading,        setLoading]        = useState(true);

  // ── Notifications tickets ──────────────────────────────────────
  const [ticketNotifs,   setTicketNotifs]   = useState<TicketNotif[]>([]);
  const [showNotifs,     setShowNotifs]     = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const headers = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // Polling des notifications toutes les 30 secondes
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await axios.get(`${API}/tickets/unread/count`, { headers: headers() });
        setTicketNotifs(res.data.tickets ?? []);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ferme le dropdown notifs si clic extérieur
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) localStorage.setItem("token", t);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API}/auth/me`, { headers: headers() });
        setUsername(res.data.username ?? "Utilisateur");
        localStorage.setItem("user_id", String(res.data.id));
        fetchProjets(res.data.id);
      } catch {
        router.push("/login");
      }
    };
    fetchUser();
  }, []);

  const fetchProjets = async (userId: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/analyses/depots-user/${userId}`);
      setProjets(res.data);
      if (res.data.length > 0) {
        setProjetActif(res.data[0]);
        fetchAnalyses(res.data[0].id);
      }
    } catch { setProjets([]); }
    finally { setLoading(false); }
  };

  const fetchAnalyses = async (projetId: number) => {
    try {
      const res = await axios.get(`${API}/analyses/depot/${projetId}`);
      setAnalyses(res.data);
    } catch { setAnalyses([]); }
  };

  const selectionnerProjet = (p: DepotAnalyse) => {
    setProjetActif(p); setAnalyseActif(null); setVue("liste");
    fetchAnalyses(p.id);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    router.push("/login");
  };

  const totalVulns = analyses.reduce((a, b) => a + (b.vulnerabilites?.length || 0), 0);
  const scoreMoyen = analyses.length > 0
    ? Math.round(analyses.reduce((a, b) => a + (b.score_qualite || 0), 0) / analyses.length)
    : 0;

  const colorScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
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

  const stats = [
    { label: "Projets analysés", value: projets.length,                           icon: "📁", color: "#6366f1" },
    { label: "Analyses totales", value: analyses.length,                           icon: "🔍", color: "#10b981" },
    { label: "Score moyen",      value: scoreMoyen ? `${scoreMoyen}%` : "—",      icon: "⭐", color: colorScore(scoreMoyen) },
    { label: "Vulnérabilités",   value: totalVulns,                               icon: "⚠️", color: totalVulns > 0 ? "#ef4444" : "#10b981" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        .dashboard { min-height:100vh; background:#f8fafc; font-family:'Inter',sans-serif; color:#1e293b; display:flex; }
        .sidebar { width:260px; background:white; border-right:1px solid #eef2ff; display:flex; flex-direction:column; position:sticky; top:0; height:100vh; }
        .logo-area { padding:24px 20px; border-bottom:1px solid #f1f5f9; }
        .logo { display:flex; align-items:center; gap:12px; }
        .logo-icon { width:40px; height:40px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px; color:white; }
        .logo-text { font-size:18px; font-weight:700; color:#0f172a; letter-spacing:-0.02em; }
        .logo-sub { font-size:10px; color:#64748b; margin-top:2px; }
        .nav { flex:1; padding:24px 16px; display:flex; flex-direction:column; gap:4px; }
        .nav-item { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; background:transparent; border:none; width:100%; text-align:left; font-size:14px; font-weight:500; color:#475569; cursor:pointer; transition:all 0.2s; }
        .nav-item:hover { background:#f8fafc; color:#0f172a; }
        .nav-item.active { background:#eef2ff; color:#6366f1; }
        .nav-icon { font-size:18px; width:28px; }
        .user-section { padding:20px; border-top:1px solid #f1f5f9; }
        .user-card { display:flex; align-items:center; gap:12px; margin-bottom:12px; cursor:pointer; padding:8px; border-radius:12px; transition:background 0.2s; }
        .user-card:hover { background:#f8fafc; }
        .user-avatar { width:40px; height:40px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:16px; color:white; }
        .user-info { flex:1; }
        .user-name { font-size:14px; font-weight:600; color:#0f172a; }
        .user-email { font-size:11px; color:#64748b; }
        .logout-btn { width:100%; padding:8px 12px; background:#f1f5f9; border:none; border-radius:10px; font-size:13px; font-weight:500; color:#ef4444; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .logout-btn:hover { background:#fee2e2; }
        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .topbar { display:flex; align-items:center; justify-content:space-between; padding:20px 32px; background:white; border-bottom:1px solid #eef2ff; }
        .page-title { font-size:24px; font-weight:700; color:#0f172a; letter-spacing:-0.02em; }
        .page-date { font-size:13px; color:#64748b; margin-top:4px; }
        .topbar-right { display:flex; align-items:center; gap:12px; }
        .btn-primary { padding:10px 20px; background:#0f172a; border:none; border-radius:12px; color:white; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .btn-primary:hover { background:#1e293b; transform:translateY(-1px); }
        .btn-secondary { padding:10px 20px; background:#f1f5f9; border:none; border-radius:12px; color:#475569; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; }
        .btn-secondary:hover { background:#e2e8f0; }
        /* NOTIF BELL */
        .notif-wrap { position:relative; }
        .notif-bell { position:relative; width:40px; height:40px; background:#f1f5f9; border:none; border-radius:12px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
        .notif-bell:hover { background:#e2e8f0; }
        .notif-badge { position:absolute; top:-4px; right:-4px; width:18px; height:18px; background:#ef4444; border-radius:50%; font-size:10px; font-weight:700; color:white; display:flex; align-items:center; justify-content:center; border:2px solid white; animation:pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        .notif-dropdown { position:absolute; top:48px; right:0; width:320px; background:white; border:1px solid #eef2ff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.12); z-index:200; overflow:hidden; }
        .notif-header { padding:14px 18px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; }
        .notif-title { font-size:14px; font-weight:600; color:#0f172a; }
        .notif-item { padding:14px 18px; border-bottom:1px solid #f8fafc; cursor:pointer; transition:background 0.15s; }
        .notif-item:hover { background:#f8fafc; }
        .notif-item-subject { font-size:13px; font-weight:600; color:#0f172a; margin-bottom:4px; }
        .notif-item-sub { font-size:11px; color:#22c55e; display:flex; align-items:center; gap:6px; }
        .notif-empty { padding:24px; text-align:center; color:#94a3b8; font-size:13px; }
        .notif-footer { padding:12px 18px; text-align:center; border-top:1px solid #f1f5f9; }
        .notif-footer button { background:none; border:none; color:#6366f1; font-size:13px; font-weight:600; cursor:pointer; }
        /* CONTENT */
        .content { flex:1; overflow-y:auto; padding:24px 32px; }
        .content::-webkit-scrollbar { width:6px; }
        .content::-webkit-scrollbar-track { background:#f1f5f9; border-radius:3px; }
        .content::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }
        .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-bottom:32px; }
        .stat-card { background:white; border:1px solid #eef2ff; border-radius:20px; padding:20px; transition:all 0.2s; }
        .stat-card:hover { border-color:#e2e8f0; transform:translateY(-2px); }
        .stat-icon { font-size:28px; }
        .stat-value { font-size:32px; font-weight:700; color:#0f172a; margin:12px 0 4px; }
        .stat-label { font-size:12px; color:#64748b; font-weight:500; }
        .dashboard-grid { display:grid; grid-template-columns:280px 1fr; gap:24px; height:calc(100vh - 260px); }
        .projets-panel { background:white; border:1px solid #eef2ff; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; }
        .panel-header { padding:16px 20px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; }
        .panel-title { font-size:14px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; }
        .panel-badge { background:#f1f5f9; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:500; color:#475569; }
        .projets-list { flex:1; overflow-y:auto; }
        .projet-item { padding:14px 16px; cursor:pointer; border-bottom:1px solid #f8fafc; transition:all 0.2s; border-left:3px solid transparent; }
        .projet-item:hover { background:#faf9fe; }
        .projet-item.active { background:#eef2ff; border-left-color:#6366f1; }
        .projet-name { font-size:14px; font-weight:600; color:#0f172a; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .projet-url { font-size:11px; color:#64748b; font-family:monospace; margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .projet-meta { display:flex; gap:6px; }
        .meta-tag { font-size:10px; padding:2px 8px; background:#f1f5f9; border-radius:12px; color:#475569; }
        .right-panel { background:white; border:1px solid #eef2ff; border-radius:20px; display:flex; flex-direction:column; overflow:hidden; }
        .panel-tabs { display:flex; gap:8px; padding:12px 20px; border-bottom:1px solid #f1f5f9; }
        .tab-btn { padding:8px 20px; border-radius:30px; font-size:13px; font-weight:500; background:transparent; border:none; color:#64748b; cursor:pointer; transition:all 0.2s; }
        .tab-btn.active { background:#eef2ff; color:#6366f1; }
        .panel-content { flex:1; overflow-y:auto; padding:20px; }
        .data-table { width:100%; border-collapse:collapse; }
        .data-table th { text-align:left; padding:12px; font-size:11px; font-weight:600; color:#64748b; border-bottom:1px solid #f1f5f9; }
        .data-table td { padding:12px; font-size:13px; border-bottom:1px solid #faf9fe; cursor:pointer; }
        .data-table tr:hover td { background:#faf9fe; }
        .score-cell { display:flex; align-items:center; gap:8px; }
        .score-value { font-size:13px; font-weight:600; font-family:monospace; min-width:32px; }
        .score-bar { flex:1; height:4px; background:#e2e8f0; border-radius:2px; overflow:hidden; }
        .score-bar-fill { height:4px; border-radius:2px; }
        .status-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:30px; font-size:11px; font-weight:500; }
        .status-done { background:#ecfdf5; color:#10b981; }
        .status-running { background:#fffbeb; color:#f59e0b; }
        .vuln-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:30px; font-size:11px; font-weight:500; }
        .vuln-clean { background:#ecfdf5; color:#10b981; }
        .vuln-warning { background:#fef2f2; color:#ef4444; }
        .detail-view { padding:8px; }
        .scores-detail { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
        .score-detail-card { background:#f8fafc; border:1px solid #eef2ff; border-radius:16px; padding:20px; text-align:center; }
        .score-detail-value { font-size:40px; font-weight:700; margin-bottom:8px; }
        .score-detail-label { font-size:12px; color:#64748b; }
        .section-title { font-size:14px; font-weight:600; color:#0f172a; margin:20px 0 12px; }
        .vuln-card { background:#f8fafc; border:1px solid #eef2ff; border-radius:12px; padding:16px; margin-bottom:12px; border-left:4px solid; }
        .vuln-header { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .vuln-severity { font-size:10px; font-weight:600; padding:2px 10px; border-radius:20px; }
        .vuln-type { font-size:14px; font-weight:600; }
        .vuln-location { font-size:11px; color:#64748b; font-family:monospace; margin-bottom:8px; }
        .vuln-suggestion { font-size:12px; color:#475569; background:white; padding:8px 12px; border-radius:8px; }
        .reco-card { background:#f8fafc; border:1px solid #eef2ff; border-radius:12px; padding:16px; margin-bottom:12px; }
        .reco-title { font-size:14px; font-weight:600; color:#10b981; margin-bottom:6px; }
        .back-btn { background:#f1f5f9; border:none; border-radius:10px; padding:6px 14px; font-size:12px; cursor:pointer; color:#475569; margin-bottom:16px; }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center; color:#94a3b8; }
        .empty-icon { font-size:48px; margin-bottom:16px; }
        .loading-state { display:flex; align-items:center; justify-content:center; gap:12px; padding:40px; color:#64748b; }
        .spinner { width:20px; height:20px; border:2px solid #e2e8f0; border-top-color:#6366f1; border-radius:50%; animation:spin 0.6s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width:900px) {
          .dashboard-grid { grid-template-columns:1fr; }
          .stats-grid { grid-template-columns:repeat(2,1fr); }
          .sidebar { display:none; }
        }
      `}</style>

      <div className="dashboard">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logo">
              <div className="logo-icon">A</div>
              <div>
                <div className="logo-text">AuditPlatform</div>
                <div className="logo-sub">GitLab · IA · PFE 2025</div>
              </div>
            </div>
          </div>

          <nav className="nav">
            {menuItems.map(item => (
              <button
                key={item.key}
                className={`nav-item ${activeMenu === item.key ? "active" : ""}`}
                onClick={() => {
                  setActiveMenu(item.key);
                  if (item.href && item.key !== "dashboard") router.push(item.href);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {/* Badge notif sur Support */}
                {item.key === "help" && ticketNotifs.length > 0 && (
                  <span style={{ marginLeft:"auto", background:"#ef4444", color:"white", fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>
                    {ticketNotifs.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="user-section">
            <div className="user-card" onClick={() => router.push("/profile")}>
              <div className="user-avatar">{username[0]?.toUpperCase() || "U"}</div>
              <div className="user-info">
                <div className="user-name">{username}</div>
                <div className="user-email">connecté</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>⎋ Déconnexion</button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          <header className="topbar">
            <div>
              <div className="page-title">Tableau de bord</div>
              <div className="page-date">
                {new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
              </div>
            </div>

            <div className="topbar-right">
              <button className="btn-secondary" onClick={() => router.push("/Exploreformpage")}>📁 Dépôts</button>
              <button className="btn-secondary" onClick={() => router.push("/add-repository")}>🔀 Comparer</button>
              <button className="btn-primary" onClick={() => router.push("/analyse")}>+ Nouvelle analyse</button>

              {/* 🔔 CLOCHE NOTIFICATIONS */}
              <div className="notif-wrap" ref={notifRef}>
                <button className="notif-bell" onClick={() => setShowNotifs(v => !v)} title="Notifications support">
                  🔔
                  {ticketNotifs.length > 0 && (
                    <span className="notif-badge">{ticketNotifs.length}</span>
                  )}
                </button>

                {showNotifs && (
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <span className="notif-title">💬 Réponses du support</span>
                      <span style={{ fontSize:11, color:"#94a3b8" }}>{ticketNotifs.length} ticket(s)</span>
                    </div>

                    {ticketNotifs.length === 0 ? (
                      <div className="notif-empty">Aucune réponse pour le moment</div>
                    ) : ticketNotifs.map(t => (
                      <div
                        key={t.id}
                        className="notif-item"
                        onClick={() => { setShowNotifs(false); router.push("/help"); }}
                      >
                        <div className="notif-item-subject">💬 {t.subject}</div>
                        <div className="notif-item-sub">
                          <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", display:"inline-block" }} />
                          Le support a répondu à votre ticket
                        </div>
                      </div>
                    ))}

                    <div className="notif-footer">
                      <button onClick={() => { setShowNotifs(false); router.push("/help"); }}>
                        Voir tous mes tickets →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="content">

            {/* STATS */}
            <div className="stats-grid">
              {stats.map((s, i) => (
                <div key={i} className="stat-card">
                  <span className="stat-icon">{s.icon}</span>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* GRID */}
            <div className="dashboard-grid">

              {/* PROJETS */}
              <div className="projets-panel">
                <div className="panel-header">
                  <span className="panel-title">Mes projets</span>
                  <span className="panel-badge">{projets.length}</span>
                </div>
                <div className="projets-list">
                  {loading ? (
                    <div className="loading-state"><div className="spinner" /> Chargement...</div>
                  ) : projets.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📁</div>
                      <button className="btn-primary" style={{ marginTop:16 }} onClick={() => router.push("/analyse")}>+ Lancer une analyse</button>
                    </div>
                  ) : projets.map(p => (
                    <div
                      key={p.id}
                      className={`projet-item ${projetActif?.id === p.id ? "active" : ""}`}
                      onClick={() => selectionnerProjet(p)}
                    >
                      <div className="projet-name">{p.nom}</div>
                      <div className="projet-url">{p.project_url}</div>
                      <div className="projet-meta">
                        <span className="meta-tag">{p.branche}</span>
                        <span className="meta-tag">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT */}
              <div className="right-panel">
                <div className="panel-tabs">
                  <button className={`tab-btn ${vue === "liste" ? "active" : ""}`}
                    onClick={() => { setVue("liste"); setAnalyseActif(null); }}>
                    Analyses ({analyses.length})
                  </button>
                </div>

                <div className="panel-content">
                  {vue === "liste" && (
                    !projetActif ? (
                      <div className="empty-state"><div className="empty-icon">◎</div>Sélectionnez un projet à gauche</div>
                    ) : analyses.length === 0 ? (
                      <div className="empty-state"><div className="empty-icon">🔍</div>Aucune analyse pour ce projet</div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr><th>Date</th><th>Branche</th><th>Qualité</th><th>Sécurité</th><th>Performance</th><th>Vulns</th><th>Statut</th></tr>
                        </thead>
                        <tbody>
                          {analyses.map(a => {
                            const vc = a.vulnerabilites?.length || 0;
                            return (
                              <tr key={a.id} onClick={() => { setAnalyseActif(a); setVue("detail"); }}>
                                <td style={{ fontFamily:"monospace", fontSize:12 }}>{new Date(a.created_at).toLocaleDateString()}</td>
                                <td><span className="meta-tag">{a.branche}</span></td>
                                {[a.score_qualite, a.score_securite, a.score_performance].map((s, i) => (
                                  <td key={i}>
                                    <div className="score-cell">
                                      <span className="score-value" style={{ color:colorScore(s) }}>{s ?? "—"}</span>
                                      <div className="score-bar"><div className="score-bar-fill" style={{ width:`${s ?? 0}%`, background:colorScore(s) }} /></div>
                                    </div>
                                  </td>
                                ))}
                                <td><span className={`vuln-badge ${vc === 0 ? "vuln-clean" : "vuln-warning"}`}>{vc === 0 ? "✓ 0" : `⚠ ${vc}`}</span></td>
                                <td><span className={`status-badge ${a.statut === "termine" ? "status-done" : "status-running"}`}>{a.statut === "termine" ? "✓ Terminé" : "⏳ En cours"}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  )}

                  {vue === "detail" && analyseActif && (
                    <div className="detail-view">
                      <button className="back-btn" onClick={() => { setVue("liste"); setAnalyseActif(null); }}>← Retour</button>
                      <div className="scores-detail">
                        {[
                          { label:"Qualité",     val:analyseActif.score_qualite },
                          { label:"Sécurité",    val:analyseActif.score_securite },
                          { label:"Performance", val:analyseActif.score_performance },
                        ].map(s => (
                          <div key={s.label} className="score-detail-card">
                            <div className="score-detail-value" style={{ color:colorScore(s.val) }}>{s.val ?? "—"}</div>
                            <div className="score-detail-label">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {analyseActif.vulnerabilites?.length > 0 ? (
                        <>
                          <div className="section-title">⚠️ Vulnérabilités ({analyseActif.vulnerabilites.length})</div>
                          {analyseActif.vulnerabilites.map((v: any, i: number) => (
                            <div key={i} className="vuln-card" style={{ borderLeftColor:colorSeverite(v.severite) }}>
                              <div className="vuln-header">
                                <span className="vuln-severity" style={{ background:`${colorSeverite(v.severite)}15`, color:colorSeverite(v.severite) }}>{v.severite}</span>
                                <span className="vuln-type">{v.type}</span>
                              </div>
                              <div className="vuln-location">📄 {v.fichier} — ligne {v.ligne}</div>
                              <div className="vuln-suggestion">💡 {v.suggestion}</div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="empty-state" style={{ background:"#ecfdf5", borderRadius:16 }}>
                          <div className="empty-icon">✅</div>
                          <div>Aucune vulnérabilité — Code propre !</div>
                        </div>
                      )}
                      {analyseActif.recommandations?.length > 0 && (
                        <>
                          <div className="section-title">💡 Recommandations</div>
                          {analyseActif.recommandations.map((r: any, i: number) => (
                            <div key={i} className="reco-card">
                              <div className="reco-title">✓ {r.titre}</div>
                              <div>{r.description}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}