"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface DepotAnalyse {
  id          : number;
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
  recommandations   : any[];
  statut            : string;
  created_at        : string;
}

interface Depot {
  id: number;
  nom: string;
  url_branche_principale: string;
  proprietaire_id: number;
}

const menuItems = [
  { key: "dashboard",      label: "Vue d'ensemble",  icon: "▦" },
  { key: "repositories",   label: "Dépôts",          icon: "◈" },
  { key: "analyses",       label: "Analyses",        icon: "◎" },
  { key: "issues",         label: "Issues",          icon: "◇" },
  { key: "merge_requests", label: "Merge Requests",  icon: "⟁" },
  { key: "pipelines",      label: "Pipelines",       icon: "⊞" },
  { key: "settings",       label: "Configuration",   icon: "⊙" },
];

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [username,     setUsername]     = useState("Utilisateur");
  const [activeMenu,   setActiveMenu]   = useState("dashboard");
  const [depots,       setDepots]       = useState<Depot[]>([]);
  const [projets,      setProjets]      = useState<DepotAnalyse[]>([]);
  const [analyses,     setAnalyses]     = useState<Analyse[]>([]);
  const [projetActif,  setProjetActif]  = useState<DepotAnalyse | null>(null);
  const [analyseActif, setAnalyseActif] = useState<Analyse | null>(null);
  const [vue,          setVue]          = useState<"liste" | "detail">("liste");
  const [loading,      setLoading]      = useState(true);

  const headers = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

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
      } catch {}
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchDepots = async () => {
      try {
        const res = await axios.get(`${API}/depots/`, { headers: headers() });
        setDepots(res.data);
      } catch {}
    };
    fetchDepots();
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
    setProjetActif(p);
    setAnalyseActif(null);
    setVue("liste");
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

  const c = (s: number) => {
    if (!s && s !== 0) return "#3a3f60";
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

  const stats = [
    { label: "Projets analysés",  val: projets.length,                    col: "#6c63ff" },
    { label: "Analyses totales",  val: analyses.length,                   col: "#00d4aa" },
    { label: "Score moyen",       val: scoreMoyen ? `${scoreMoyen}%` : "—", col: c(scoreMoyen) },
    { label: "Vulnérabilités",    val: totalVulns,                        col: totalVulns > 0 ? "#ff6b6b" : "#00d4aa" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg      : #070810;
          --surface : #0d0f1c;
          --card    : #111428;
          --border  : #1e2240;
          --border2 : #2a2f55;
          --accent  : #6c63ff;
          --green   : #00d4aa;
          --red     : #ff6b6b;
          --yellow  : #ffd166;
          --text    : #e8eaf6;
          --text2   : #7880a0;
          --text3   : #3a3f60;
          --mono    : 'JetBrains Mono', monospace;
          --display : 'Syne', sans-serif;
        }

        body { background: var(--bg); }

        .root { display: flex; height: 100vh; background: var(--bg); font-family: var(--display); color: var(--text); overflow: hidden; }

        /* SIDEBAR */
        .sidebar { width: 220px; min-width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .logo-area { padding: 22px 18px 20px; border-bottom: 1px solid var(--border); }
        .logo-row { display: flex; align-items: center; gap: 10px; }
        .logo-box { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, var(--accent), var(--green)); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff; flex-shrink: 0; box-shadow: 0 4px 14px #6c63ff30; }
        .logo-name { font-size: 13px; font-weight: 700; color: var(--text); }
        .logo-sub  { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-top: 1px; }
        .nav { padding: 14px 10px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .nav-lbl { font-size: 8px; font-weight: 600; color: var(--text3); font-family: var(--mono); letter-spacing: 0.12em; text-transform: uppercase; padding: 0 8px 8px; }
        .nav-btn { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 7px; background: transparent; border: none; color: var(--text3); font-family: var(--display); font-size: 12px; font-weight: 500; cursor: pointer; width: 100%; text-align: left; transition: all 0.15s; }
        .nav-btn:hover { background: #ffffff06; color: var(--text2); }
        .nav-btn.active { background: #6c63ff12; color: var(--text); box-shadow: inset 3px 0 0 var(--accent); }
        .nav-icon { font-size: 13px; width: 18px; text-align: center; flex-shrink: 0; }
        .sidebar-foot { padding: 12px 10px; border-top: 1px solid var(--border); }
        .user-pill { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 8px; cursor: pointer; transition: background 0.15s; margin-bottom: 6px; }
        .user-pill:hover { background: #ffffff06; }
        .avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--green)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .u-name { font-size: 12px; font-weight: 600; color: var(--text2); }
        .u-role { font-size: 9px; color: var(--text3); font-family: var(--mono); }
        .btn-logout { width: 100%; padding: 8px 10px; display: flex; align-items: center; gap: 8px; background: transparent; border: 1px solid #ff6b6b18; border-radius: 7px; color: var(--red); font-family: var(--display); font-size: 11px; cursor: pointer; transition: all 0.15s; }
        .btn-logout:hover { background: #ff6b6b08; border-color: #ff6b6b35; }

        /* MAIN */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 26px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
        .page-title { font-size: 16px; font-weight: 700; color: var(--text); }
        .page-sub   { font-size: 10px; color: var(--text3); font-family: var(--mono); margin-top: 2px; }
        .topbar-btns { display: flex; gap: 8px; }
        .btn-primary { padding: 7px 16px; background: var(--accent); border: none; border-radius: 7px; color: #fff; font-family: var(--display); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-primary:hover { background: #5b52e0; }
        .btn-ghost { padding: 7px 16px; background: transparent; border: 1px solid var(--border2); border-radius: 7px; color: var(--text2); font-family: var(--display); font-size: 12px; cursor: pointer; transition: all 0.15s; }
        .btn-ghost:hover { border-color: var(--accent); color: var(--text); }

        .content { flex: 1; overflow-y: auto; padding: 22px 26px; }
        .content::-webkit-scrollbar { width: 4px; }
        .content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        /* STATS */
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; position: relative; overflow: hidden; }
        .stat-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--ac); }
        .stat-num { font-size: 28px; font-weight: 800; color: var(--ac); font-family: var(--mono); line-height: 1; margin-bottom: 5px; }
        .stat-lbl { font-size: 9px; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.08em; }

        /* GRID */
        .dash-grid { display: grid; grid-template-columns: 250px 1fr; gap: 14px; height: calc(100vh - 198px); }

        /* PROJETS */
        .projets-panel { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
        .panel-head { padding: 13px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .panel-head-title { font-size: 9px; font-weight: 700; color: var(--text2); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em; }
        .panel-count { font-size: 9px; color: var(--text3); font-family: var(--mono); background: var(--surface); padding: 2px 7px; border-radius: 10px; border: 1px solid var(--border); }
        .projets-scroll { flex: 1; overflow-y: auto; }
        .projets-scroll::-webkit-scrollbar { width: 3px; }
        .projets-scroll::-webkit-scrollbar-thumb { background: var(--border); }
        .projet-item { padding: 12px 14px; cursor: pointer; border-bottom: 1px solid var(--border); transition: all 0.15s; border-left: 3px solid transparent; }
        .projet-item:last-child { border-bottom: none; }
        .projet-item:hover { background: #ffffff04; }
        .projet-item.actif { background: #6c63ff08; border-left-color: var(--accent); }
        .projet-nom { font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .projet-url { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .projet-tags { display: flex; gap: 5px; }
        .tag { font-size: 8px; font-family: var(--mono); padding: 2px 7px; border-radius: 10px; font-weight: 500; }
        .tag-branch { color: var(--green); background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .tag-date   { color: var(--text3); background: var(--surface); border: 1px solid var(--border); }

        /* PANNEAU DROIT */
        .right-panel { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
        .right-head { padding: 13px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .right-head-title { font-size: 13px; font-weight: 700; color: var(--text); }
        .right-head-sub { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-top: 2px; }
        .right-scroll { flex: 1; overflow-y: auto; }
        .right-scroll::-webkit-scrollbar { width: 3px; }
        .right-scroll::-webkit-scrollbar-thumb { background: var(--border); }

        /* TABLE */
        .a-table { width: 100%; border-collapse: collapse; }
        .a-table th { padding: 9px 14px; text-align: left; font-size: 8px; font-weight: 600; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em; background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; }
        .a-table td { padding: 12px 14px; border-bottom: 1px solid #1e224035; vertical-align: middle; }
        .a-table tr:last-child td { border-bottom: none; }
        .a-table tr:hover td { background: #ffffff03; cursor: pointer; }

        .score-cell { display: flex; align-items: center; gap: 7px; }
        .score-n { font-size: 12px; font-weight: 700; font-family: var(--mono); min-width: 24px; color: var(--sc); }
        .score-track { flex: 1; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; min-width: 36px; }
        .score-fill  { height: 3px; border-radius: 2px; background: var(--sc); }

        .statut-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-family: var(--mono); padding: 3px 8px; border-radius: 20px; }
        .s-ok  { color: var(--green);  background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .s-run { color: var(--yellow); background: #ffd1660d; border: 1px solid #ffd16620; }
        .s-err { color: var(--red);    background: #ff6b6b0d; border: 1px solid #ff6b6b20; }
        .dot-blink { width: 5px; height: 5px; border-radius: 50%; animation: db 2s infinite; }
        @keyframes db { 0%,100%{opacity:1} 50%{opacity:.3} }

        .vuln-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; font-family: var(--mono); padding: 3px 9px; border-radius: 20px; }
        .v-zero { color: var(--green); background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .v-some { color: var(--red);   background: #ff6b6b0d; border: 1px solid #ff6b6b20; }
        .date-txt { font-size: 10px; color: var(--text3); font-family: var(--mono); }

        /* DETAIL */
        .detail-wrap { padding: 18px; }
        .scores-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .score-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; text-align: center; }
        .score-big { font-size: 36px; font-weight: 800; font-family: var(--mono); color: var(--sc); line-height: 1; margin-bottom: 4px; }
        .score-name { font-size: 8px; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .score-bar { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
        .score-bar-fill { height: 3px; border-radius: 2px; background: var(--sc); }
        .section-lbl { font-size: 9px; font-weight: 700; color: var(--text3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .vuln-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .vuln-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--vc); border-radius: 8px; padding: 11px; }
        .vuln-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .vuln-sev { font-size: 8px; font-weight: 700; font-family: var(--mono); padding: 2px 8px; border-radius: 20px; background: var(--vc); color: #000; }
        .vuln-type { font-size: 11px; font-weight: 700; color: var(--text); }
        .vuln-loc  { font-size: 9px; color: var(--text3); font-family: var(--mono); margin-bottom: 5px; }
        .vuln-fix  { font-size: 11px; color: var(--text2); background: var(--bg); padding: 7px 10px; border-radius: 6px; }
        .reco-list { display: flex; flex-direction: column; gap: 8px; }
        .reco-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 11px; }
        .reco-titre { font-size: 11px; font-weight: 700; color: var(--green); margin-bottom: 4px; }
        .reco-desc  { font-size: 11px; color: var(--text2); }
        .clean-badge { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: #00d4aa0d; border: 1px solid #00d4aa20; border-radius: 8px; color: var(--green); font-size: 12px; font-weight: 700; margin-bottom: 18px; }

        .btn-back { padding: 6px 13px; background: transparent; border: 1px solid var(--border2); border-radius: 6px; color: var(--text2); font-family: var(--mono); font-size: 9px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-back:hover { border-color: var(--accent); color: var(--text); }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; padding: 40px; }
        .empty-icon { font-size: 30px; opacity: 0.08; }
        .empty-txt  { font-size: 10px; color: var(--text3); font-family: var(--mono); text-align: center; line-height: 1.8; }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 30px; color: var(--text3); font-size: 10px; font-family: var(--mono); }
        .spin { width: 14px; height: 14px; border: 2px solid var(--border); border-top: 2px solid var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; opacity: 0.15; }
        .placeholder-icon { font-size: 40px; }
        .placeholder-txt  { font-size: 10px; color: var(--text2); font-family: var(--mono); letter-spacing: 0.1em; text-transform: uppercase; }
      `}</style>

      <div className="root">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logo-row">
              <div className="logo-box">A</div>
              <div>
                <div className="logo-name">AuditPlatform</div>
                <div className="logo-sub">GitLab · LLM · PFE 2025</div>
              </div>
            </div>
          </div>

          <nav className="nav">
            <div className="nav-lbl">Navigation</div>
            {menuItems.map(item => (
              <button
                key={item.key}
                className={`nav-btn ${activeMenu === item.key ? "active" : ""}`}
                onClick={() => {
                  if (item.key === "repositories") router.push("/depots");
                  else if (item.key === "analyses") router.push("/analyse");
                  else setActiveMenu(item.key);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="user-pill" onClick={() => router.push("/profile")}>
              <div className="avatar">{username[0]?.toUpperCase() ?? "U"}</div>
              <div>
                <div className="u-name">{username}</div>
                <div className="u-role">connecté</div>
              </div>
            </div>
            <button className="btn-logout" onClick={handleLogout}>⎋ Déconnexion</button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          <header className="topbar">
            <div>
              <div className="page-title">{menuItems.find(m => m.key === activeMenu)?.label}</div>
              <div className="page-sub">
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            <div className="topbar-btns">
              <button className="btn-ghost" onClick={() => router.push("/add-repository")}>⟁ Comparer</button>
              <button className="btn-ghost" onClick={() => router.push("/Exploreformpage")}>◈ Dépôts</button>
              <button className="btn-primary" onClick={() => router.push("/analyse")}>+ Nouvelle analyse</button>
            </div>
          </header>

          <div className="content">

            {activeMenu === "dashboard" && (
              <>
                {/* Stats */}
                <div className="stats-row">
                  {stats.map((s, i) => (
                    <div key={i} className="stat-card" style={{ "--ac": s.col } as any}>
                      <div className="stat-num">{s.val}</div>
                      <div className="stat-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div className="dash-grid">

                  {/* Projets */}
                  <div className="projets-panel">
                    <div className="panel-head">
                      <span className="panel-head-title">Mes projets</span>
                      <span className="panel-count">{projets.length}</span>
                    </div>
                    <div className="projets-scroll">
                      {loading ? (
                        <div className="loading-state"><div className="spin"/> Chargement...</div>
                      ) : projets.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-icon">◈</div>
                          <div className="empty-txt">
                            Aucun projet analysé
                            <br/>
                            <button className="btn-primary" style={{ marginTop: 12, fontSize: 10, padding: "6px 14px" }} onClick={() => router.push("/analyse")}>
                              + Analyser
                            </button>
                          </div>
                        </div>
                      ) : (
                        projets.map(p => (
                          <div
                            key={p.id}
                            className={`projet-item ${projetActif?.id === p.id ? "actif" : ""}`}
                            onClick={() => selectionnerProjet(p)}
                          >
                            <div className="projet-nom">{p.nom}</div>
                            <div className="projet-url">{p.project_url}</div>
                            <div className="projet-tags">
                              <span className="tag tag-branch">{p.branche}</span>
                              <span className="tag tag-date">{new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Panneau droit */}
                  <div className="right-panel">
                    <div className="right-head">
                      <div>
                        <div className="right-head-title">
                          {vue === "detail" && analyseActif
                            ? `Analyse du ${new Date(analyseActif.created_at).toLocaleDateString("fr-FR")}`
                            : projetActif ? `Analyses — ${projetActif.nom}` : "Sélectionne un projet"
                          }
                        </div>
                        <div className="right-head-sub">
                          {vue === "detail" && analyseActif
                            ? `branche ${analyseActif.branche} · ${analyseActif.vulnerabilites?.length || 0} vulnérabilité(s)`
                            : `${analyses.length} analyse(s) · clique pour voir le détail`
                          }
                        </div>
                      </div>
                      {vue === "detail" && (
                        <button className="btn-back" onClick={() => { setVue("liste"); setAnalyseActif(null); }}>
                          ← Retour
                        </button>
                      )}
                    </div>

                    <div className="right-scroll">

                      {/* Vue liste */}
                      {vue === "liste" && (
                        <>
                          {!projetActif ? (
                            <div className="empty-state">
                              <div className="empty-icon">◎</div>
                              <div className="empty-txt">Sélectionne un projet à gauche</div>
                            </div>
                          ) : analyses.length === 0 ? (
                            <div className="empty-state">
                              <div className="empty-icon">◎</div>
                              <div className="empty-txt">Aucune analyse pour ce projet</div>
                            </div>
                          ) : (
                            <table className="a-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Branche</th>
                                  <th>Qualité</th>
                                  <th>Sécurité</th>
                                  <th>Performance</th>
                                  <th>Vulnérabilités</th>
                                  <th>Statut</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analyses.map(a => {
                                  const v = a.vulnerabilites?.length || 0;
                                  return (
                                    <tr key={a.id} onClick={() => { setAnalyseActif(a); setVue("detail"); }}>
                                      <td className="date-txt">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                                      <td><span className="tag tag-branch">{a.branche}</span></td>
                                      {[a.score_qualite, a.score_securite, a.score_performance].map((s, i) => (
                                        <td key={i}>
                                          <div className="score-cell" style={{ "--sc": c(s) } as any}>
                                            <span className="score-n">{s ?? "—"}</span>
                                            <div className="score-track"><div className="score-fill" style={{ width: `${s ?? 0}%` }}/></div>
                                          </div>
                                        </td>
                                      ))}
                                      <td><span className={`vuln-tag ${v === 0 ? "v-zero" : "v-some"}`}>{v === 0 ? "✓ 0" : `⚠ ${v}`}</span></td>
                                      <td>
                                        <span className={`statut-tag ${a.statut === "termine" ? "s-ok" : a.statut === "en_cours" ? "s-run" : "s-err"}`}>
                                          <div className="dot-blink" style={{ background: a.statut === "termine" ? "#00d4aa" : a.statut === "en_cours" ? "#ffd166" : "#ff6b6b" }}/>
                                          {a.statut}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </>
                      )}

                      {/* Vue détail */}
                      {vue === "detail" && analyseActif && (
                        <div className="detail-wrap">

                          <div className="scores-grid">
                            {[
                              { label: "Qualité",     val: analyseActif.score_qualite },
                              { label: "Sécurité",    val: analyseActif.score_securite },
                              { label: "Performance", val: analyseActif.score_performance },
                            ].map(s => (
                              <div key={s.label} className="score-card" style={{ "--sc": c(s.val) } as any}>
                                <div className="score-big">{s.val ?? "—"}</div>
                                <div className="score-name">{s.label}</div>
                                <div className="score-bar"><div className="score-bar-fill" style={{ width: `${s.val ?? 0}%` }}/></div>
                              </div>
                            ))}
                          </div>

                          {analyseActif.vulnerabilites?.length > 0 ? (
                            <>
                              <div className="section-lbl">⚠ Vulnérabilités ({analyseActif.vulnerabilites.length})</div>
                              <div className="vuln-list">
                                {analyseActif.vulnerabilites.map((v: any, i: number) => (
                                  <div key={i} className="vuln-card" style={{ "--vc": cSev(v.severite) } as any}>
                                    <div className="vuln-top">
                                      <span className="vuln-sev">{v.severite}</span>
                                      <span className="vuln-type">{v.type}</span>
                                    </div>
                                    <div className="vuln-loc">📄 {v.fichier} — ligne {v.ligne}</div>
                                    <div className="vuln-fix">💡 {v.suggestion}</div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="clean-badge">✅ Aucune vulnérabilité — Code propre !</div>
                          )}

                          {analyseActif.recommandations?.length > 0 && (
                            <>
                              <div className="section-lbl">✓ Recommandations ({analyseActif.recommandations.length})</div>
                              <div className="reco-list">
                                {analyseActif.recommandations.map((r: any, i: number) => (
                                  <div key={i} className="reco-card">
                                    <div className="reco-titre">{r.titre}</div>
                                    <div className="reco-desc">{r.description}</div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </>
            )}

            {activeMenu !== "dashboard" && (
              <div className="placeholder">
                <div className="placeholder-icon">{menuItems.find(m => m.key === activeMenu)?.icon}</div>
                <div className="placeholder-txt">{menuItems.find(m => m.key === activeMenu)?.label} — en développement</div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}