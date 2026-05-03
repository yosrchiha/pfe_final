"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://127.0.0.1:8000";

interface DepotAnalyse {
  id: number; nom: string; project_url: string; branche: string; created_at: string;
}
interface Analyse {
  id: number; depot_analyse_id: number; branche: string;
  score_qualite: number; score_securite: number; score_performance: number;
  vulnerabilites: any[]; recommandations: any[]; statut: string; created_at: string;
}
interface TicketNotif { id: number; subject: string; status: string; }

const menuItems = [
  { key: "dashboard",      label: "Tableau de bord", icon: "▦",  href: "/dashboard" },
  { key: "repositories",   label: "Dépôts",          icon: "◈",  href: "/depots" },
  { key: "comparaisons",   label: "Comparaisons",    icon: "📊", href: "/comparaisons" },
  { key: "analyses",       label: "Analyse",         icon: "◎",  href: "/analyse" },
  { key: "videos",         label: "Mes Vidéos",      icon: "🎬", href: "/mes-videos" },   // ← NOUVEAU
  { key: "rapports",       label: "Mes Rapports",    icon: "📄", href: "/mes-rapports" },

  { key: "exploration",    label: "Exploration",     icon: "🗂️",  href: "/exploration-history"},
  { key: "tests",          label: "Tests",           icon: "🧪", href: "/TestsPaage" },
  { key: "issues",         label: "Issues",          icon: "◇",  href: "/issues" },
  { key: "merge_requests", label: "Merge Requests",  icon: "⟁",  href: "/merge-requests" },
   { key: "stats",          label: "Statistiques",    icon: "📈",  href: "/stats" },
   { key: "calendar",       label: "Calendrier",      icon: "📅",  href: "/calendar" },
  { key: "help",           label: "Support",         icon: "💬", href: "/help" },

];

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── 1. THEME — les 2 lignes qui font tout fonctionner ────────
  const { theme, isDark } = useTheme();

  const [username,     setUsername]     = useState("Utilisateur");
  const [activeMenu,   setActiveMenu]   = useState("dashboard");
  const [projets,      setProjets]      = useState<DepotAnalyse[]>([]);
  const [analyses,     setAnalyses]     = useState<Analyse[]>([]);
  const [projetActif,  setProjetActif]  = useState<DepotAnalyse | null>(null);
  const [analyseActif, setAnalyseActif] = useState<Analyse | null>(null);
  const [vue,          setVue]          = useState<"liste" | "detail">("liste");
  const [loading,      setLoading]      = useState(true);
  const [ticketNotifs, setTicketNotifs] = useState<TicketNotif[]>([]);
  const [showNotifs,   setShowNotifs]   = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const headers = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifs(false);
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
      } catch { router.push("/login"); }
    };
    fetchUser();
  }, []);

  const fetchProjets = async (userId: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/analyses/depots-user/${userId}`);
      setProjets(res.data);
      if (res.data.length > 0) { setProjetActif(res.data[0]); fetchAnalyses(res.data[0].id); }
    } catch { setProjets([]); }
    finally { setLoading(false); }
  };

  const fetchAnalyses = async (id: number) => {
    try {
      const res = await axios.get(`${API}/analyses/depot/${id}`);
      setAnalyses(res.data);
    } catch { setAnalyses([]); }
  };

  const selectionnerProjet = (p: DepotAnalyse) => {
    setProjetActif(p); setAnalyseActif(null); setVue("liste"); fetchAnalyses(p.id);
  };

  const handleLogout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("user_id");
    router.push("/login");
  };

  const totalVulns = analyses.reduce((a, b) => a + (b.vulnerabilites?.length || 0), 0);
  const scoreMoyen = analyses.length > 0
    ? Math.round(analyses.reduce((a, b) => a + (b.score_qualite || 0), 0) / analyses.length) : 0;

  const colorScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
    return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  };
  const colorSeverite = (s: string) => {
    if (s === "CRITIQUE") return "#ef4444";
    if (s === "HAUTE")    return "#f97316";
    if (s === "MOYENNE")  return "#eab308";
    return "#10b981";
  };

  const stats = [
    { label: "Projets analysés", value: projets.length,                      icon: "📁", color: "#6366f1" },
    { label: "Analyses totales", value: analyses.length,                      icon: "🔍", color: "#10b981" },
    { label: "Score moyen",      value: scoreMoyen ? `${scoreMoyen}%` : "—", icon: "⭐", color: colorScore(scoreMoyen) },
    { label: "Vulnérabilités",   value: totalVulns,                          icon: "⚠️", color: totalVulns > 0 ? "#ef4444" : "#10b981" },
  ];

  // ── 2. PALETTE DYNAMIQUE — utilise theme.xxx ─────────────────
  const D = {
    bg:         theme.bg,
    sidebar:    theme.bgSecondary,
    card:       theme.bgSecondary,
    border:     theme.border,
    text:       theme.text,
    muted:      theme.textMuted,
    faint:      theme.textFaint,
    tag:        isDark ? "#1e2538" : "#f1f5f9",
    tagText:    isDark ? "#94a3b8" : "#475569",
    navActive:  isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    navHover:   isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
    btnSec:     isDark ? "#1e2538" : "#f1f5f9",
    btnPrimary: isDark ? "#6366f1" : "#0f172a",
    scoreBar:   isDark ? "#1e2538" : "#e2e8f0",
    rowHover:   isDark ? "#1a2030" : "#faf9fe",
    detailBg:   isDark ? "#0f1117" : "#f8fafc",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        @keyframes spin   { to { transform:rotate(360deg); } }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:${D.bg}; }
        ::-webkit-scrollbar-thumb { background:${D.border}; border-radius:3px; }
        @media (max-width:900px) { .sidebar-hide { display:none!important; } .grid-full { grid-template-columns:1fr!important; } }
      `}</style>

      <div style={{ minHeight:"100vh", background:D.bg, fontFamily:"'Inter',sans-serif", color:D.text, display:"flex", transition:"background 0.3s, color 0.3s" }}>

        {/* ══ SIDEBAR ══ */}
        <aside className="sidebar-hide" style={{ width:260, background:D.sidebar, borderRight:`1px solid ${D.border}`, display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", transition:"background 0.3s" }}>

          {/* Logo */}
          <div style={{ padding:"24px 20px", borderBottom:`1px solid ${D.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:18, color:"white" }}>A</div>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:D.text }}>AuditPlatform</div>
                <div style={{ fontSize:10, color:D.faint, marginTop:2 }}>GitLab · IA · PFE 2025</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"24px 16px", display:"flex", flexDirection:"column", gap:4 }}>
            {menuItems.map(item => {
              const isActive = activeMenu === item.key;
              return (
                <button key={item.key}
                  onClick={() => { setActiveMenu(item.key); if (item.href && item.key !== "dashboard") router.push(item.href); }}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, border:"none", width:"100%", textAlign:"left", fontSize:14, fontWeight:500, cursor:"pointer", background: isActive ? D.navActive : "transparent", color: isActive ? "#6366f1" : D.muted, transition:"all 0.2s" }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = D.navHover; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize:18, width:28 }}>{item.icon}</span>
                  {item.label}
                  {item.key === "help" && ticketNotifs.length > 0 && (
                    <span style={{ marginLeft:"auto", background:"#ef4444", color:"white", fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>{ticketNotifs.length}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User section + ThemeToggle */}
          <div style={{ padding:20, borderTop:`1px solid ${D.border}` }}>
            {/* ── TOGGLE MODE SOMBRE/CLAIR ── */}
            <div style={{ marginBottom:12 }}>
              <ThemeToggle />
            </div>
            <div onClick={() => router.push("/profile")}
              style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, cursor:"pointer", padding:8, borderRadius:12, transition:"background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = D.navHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width:40, height:40, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:600, fontSize:16, color:"white" }}>
                {username[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:D.text }}>{username}</div>
                <div style={{ fontSize:11, color:D.faint }}>connecté</div>
              </div>
            </div>
            <button onClick={handleLogout}
              style={{ width:"100%", padding:"8px 12px", background:isDark?"rgba(239,68,68,0.1)":"#f1f5f9", border:"none", borderRadius:10, fontSize:13, fontWeight:500, color:"#ef4444", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s" }}>
              ⎋ Déconnexion
            </button>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Topbar */}
          <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 32px", background:D.sidebar, borderBottom:`1px solid ${D.border}`, transition:"background 0.3s" }}>
            <div>
              <div style={{ fontSize:24, fontWeight:700, color:D.text, letterSpacing:"-0.02em" }}>Tableau de bord</div>
              <div style={{ fontSize:13, color:D.faint, marginTop:4 }}>
                {new Date().toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={() => router.push("/Exploreformpage")} style={{ padding:"10px 20px", background:D.btnSec, border:`1px solid ${D.border}`, borderRadius:12, color:D.muted, fontSize:13, fontWeight:500, cursor:"pointer" }}>📁 Dépôts</button>
              <button onClick={() => router.push("/add-repository")} style={{ padding:"10px 20px", background:D.btnSec, border:`1px solid ${D.border}`, borderRadius:12, color:D.muted, fontSize:13, fontWeight:500, cursor:"pointer" }}>🔀 Comparer</button>
              <button onClick={() => router.push("/analyse")} style={{ padding:"10px 20px", background:D.btnPrimary, border:"none", borderRadius:12, color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nouvelle analyse</button>

              {/* Cloche */}
              <div ref={notifRef} style={{ position:"relative" }}>
                <button onClick={() => setShowNotifs(v => !v)}
                  style={{ position:"relative", width:40, height:40, background:D.btnSec, border:`1px solid ${D.border}`, borderRadius:12, fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  🔔
                  {ticketNotifs.length > 0 && (
                    <span style={{ position:"absolute", top:-4, right:-4, width:18, height:18, background:"#ef4444", borderRadius:"50%", fontSize:10, fontWeight:700, color:"white", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${D.sidebar}`, animation:"pulse 2s ease-in-out infinite" }}>
                      {ticketNotifs.length}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div style={{ position:"absolute", top:48, right:0, width:320, background:D.card, border:`1px solid ${D.border}`, borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,0.2)", zIndex:200, overflow:"hidden" }}>
                    <div style={{ padding:"14px 18px", borderBottom:`1px solid ${D.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:14, fontWeight:600, color:D.text }}>💬 Réponses du support</span>
                      <span style={{ fontSize:11, color:D.faint }}>{ticketNotifs.length} ticket(s)</span>
                    </div>
                    {ticketNotifs.length === 0 ? (
                      <div style={{ padding:24, textAlign:"center", color:D.faint, fontSize:13 }}>Aucune réponse pour le moment</div>
                    ) : ticketNotifs.map(t => (
                      <div key={t.id} onClick={() => { setShowNotifs(false); router.push("/help"); }}
                        style={{ padding:"14px 18px", borderBottom:`1px solid ${D.border}`, cursor:"pointer" }}>
                        <div style={{ fontSize:13, fontWeight:600, color:D.text, marginBottom:4 }}>💬 {t.subject}</div>
                        <div style={{ fontSize:11, color:"#22c55e", display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", display:"inline-block" }} />
                          Le support a répondu à votre ticket
                        </div>
                      </div>
                    ))}
                    <div style={{ padding:"12px 18px", textAlign:"center", borderTop:`1px solid ${D.border}` }}>
                      <button onClick={() => { setShowNotifs(false); router.push("/help"); }}
                        style={{ background:"none", border:"none", color:"#6366f1", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                        Voir tous mes tickets →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>

            {/* Stats */}
            <div className="grid-full" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20, marginBottom:32 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:20, padding:20, transition:"all 0.2s, background 0.3s" }}>
                  <span style={{ fontSize:28 }}>{s.icon}</span>
                  <div style={{ fontSize:32, fontWeight:700, color:s.color, margin:"12px 0 4px" }}>{s.value}</div>
                  <div style={{ fontSize:12, color:D.faint, fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid-full" style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:24, height:"calc(100vh - 260px)" }}>

              {/* Projets */}
              <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:20, overflow:"hidden", display:"flex", flexDirection:"column", transition:"background 0.3s" }}>
                <div style={{ padding:"16px 20px", borderBottom:`1px solid ${D.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:14, fontWeight:600, color:D.faint, textTransform:"uppercase", letterSpacing:"0.05em" }}>Mes projets</span>
                  <span style={{ background:D.tag, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:500, color:D.tagText }}>{projets.length}</span>
                </div>
                <div style={{ flex:1, overflowY:"auto" }}>
                  {loading ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:40, color:D.faint }}>
                      <div style={{ 
  width: 20, 
  height: 20, 
  borderLeft: `2px solid ${D.border}`,
  borderRight: `2px solid ${D.border}`,
  borderBottom: `2px solid ${D.border}`,
  borderTop: `2px solid #6366f1`,
  borderRadius: "50%", 
  animation: "spin 0.6s linear infinite" 
}} />
                    </div>
                  ) : projets.length === 0 ? (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 20px", color:D.faint }}>
                      <span style={{ fontSize:48, marginBottom:16 }}>📁</span>
                      <button onClick={() => router.push("/analyse")} style={{ padding:"10px 20px", background:"#6366f1", border:"none", borderRadius:12, color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Lancer une analyse</button>
                    </div>
                  ) : projets.map(p => (
                    <div key={p.id} onClick={() => selectionnerProjet(p)}
                      style={{ padding:"14px 16px", cursor:"pointer", borderBottom:`1px solid ${D.border}`, borderLeft:`3px solid ${projetActif?.id===p.id?"#6366f1":"transparent"}`, background: projetActif?.id===p.id ? D.navActive : "transparent", transition:"all 0.2s" }}
                      onMouseEnter={e => { if (projetActif?.id!==p.id) e.currentTarget.style.background=D.navHover; }}
                      onMouseLeave={e => { if (projetActif?.id!==p.id) e.currentTarget.style.background="transparent"; }}
                    >
                      <div style={{ fontSize:14, fontWeight:600, color:D.text, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nom}</div>
                      <div style={{ fontSize:11, color:D.faint, fontFamily:"monospace", marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.project_url}</div>
                      <div style={{ display:"flex", gap:6 }}>
                        <span style={{ fontSize:10, padding:"2px 8px", background:D.tag, borderRadius:12, color:D.tagText }}>{p.branche}</span>
                        <span style={{ fontSize:10, padding:"2px 8px", background:D.tag, borderRadius:12, color:D.tagText }}>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel */}
              <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:20, display:"flex", flexDirection:"column", overflow:"hidden", transition:"background 0.3s" }}>
                <div style={{ display:"flex", gap:8, padding:"12px 20px", borderBottom:`1px solid ${D.border}` }}>
                  <button onClick={() => { setVue("liste"); setAnalyseActif(null); }}
                    style={{ padding:"8px 20px", borderRadius:30, fontSize:13, fontWeight:500, border:"none", cursor:"pointer", background: vue==="liste"?D.navActive:"transparent", color: vue==="liste"?"#6366f1":D.muted, transition:"all 0.2s" }}>
                    Analyses ({analyses.length})
                  </button>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:20 }}>
                  {vue==="liste" && !projetActif && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 20px", color:D.faint }}>
                      <span style={{ fontSize:48, marginBottom:16 }}>◎</span>
                      Sélectionnez un projet à gauche
                    </div>
                  )}
                  {vue==="liste" && projetActif && analyses.length===0 && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 20px", color:D.faint }}>
                      <span style={{ fontSize:48, marginBottom:16 }}>🔍</span>
                      Aucune analyse pour ce projet
                    </div>
                  )}
                  {vue==="liste" && projetActif && analyses.length>0 && (
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr>
                          {["Date","Branche","Qualité","Sécurité","Perf.","Vulns","Statut"].map(h => (
                            <th key={h} style={{ textAlign:"left", padding:12, fontSize:11, fontWeight:600, color:D.faint, borderBottom:`1px solid ${D.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.map(a => {
                          const vc = a.vulnerabilites?.length || 0;
                          return (
                            <tr key={a.id} onClick={() => { setAnalyseActif(a); setVue("detail"); }} style={{ cursor:"pointer" }}
                              onMouseEnter={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background=D.rowHover))}
                              onMouseLeave={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background="transparent"))}
                            >
                              <td style={{ padding:12, borderBottom:`1px solid ${D.border}`, fontFamily:"monospace", fontSize:12, color:D.muted }}>{new Date(a.created_at).toLocaleDateString()}</td>
                              <td style={{ padding:12, borderBottom:`1px solid ${D.border}` }}>
                                <span style={{ fontSize:10, padding:"2px 8px", background:D.tag, borderRadius:12, color:D.tagText }}>{a.branche}</span>
                              </td>
                              {[a.score_qualite, a.score_securite, a.score_performance].map((s, i) => (
                                <td key={i} style={{ padding:12, borderBottom:`1px solid ${D.border}` }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ fontSize:13, fontWeight:600, fontFamily:"monospace", minWidth:32, color:colorScore(s) }}>{s ?? "—"}</span>
                                    <div style={{ flex:1, height:4, background:D.scoreBar, borderRadius:2, overflow:"hidden" }}>
                                      <div style={{ width:`${s??0}%`, height:4, borderRadius:2, background:colorScore(s) }} />
                                    </div>
                                  </div>
                                </td>
                              ))}
                              <td style={{ padding:12, borderBottom:`1px solid ${D.border}` }}>
                                <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:30, fontSize:11, fontWeight:500, background: vc===0?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)", color: vc===0?"#10b981":"#ef4444" }}>
                                  {vc===0?"✓ 0":`⚠ ${vc}`}
                                </span>
                              </td>
                              <td style={{ padding:12, borderBottom:`1px solid ${D.border}` }}>
                                <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:30, fontSize:11, fontWeight:500, background: a.statut==="termine"?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)", color: a.statut==="termine"?"#10b981":"#f59e0b" }}>
                                  {a.statut==="termine"?"✓ Terminé":"⏳ En cours"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {vue==="detail" && analyseActif && (
                    <div>
                      <button onClick={() => { setVue("liste"); setAnalyseActif(null); }}
                        style={{ background:D.tag, border:"none", borderRadius:10, padding:"6px 14px", fontSize:12, cursor:"pointer", color:D.muted, marginBottom:16 }}>
                        ← Retour
                      </button>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
                        {[{label:"Qualité",val:analyseActif.score_qualite},{label:"Sécurité",val:analyseActif.score_securite},{label:"Performance",val:analyseActif.score_performance}].map(s => (
                          <div key={s.label} style={{ background:D.detailBg, border:`1px solid ${D.border}`, borderRadius:16, padding:20, textAlign:"center" }}>
                            <div style={{ fontSize:40, fontWeight:700, marginBottom:8, color:colorScore(s.val) }}>{s.val ?? "—"}</div>
                            <div style={{ fontSize:12, color:D.faint }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {analyseActif.vulnerabilites?.length > 0 ? (
                        <>
                          <div style={{ fontSize:14, fontWeight:600, color:D.text, margin:"20px 0 12px" }}>⚠️ Vulnérabilités ({analyseActif.vulnerabilites.length})</div>
                          {analyseActif.vulnerabilites.map((v: any, i: number) => (
                            <div key={i} style={{ 
  background: D.detailBg, 
  borderTop: `1px solid ${D.border}`,
  borderRight: `1px solid ${D.border}`,
  borderBottom: `1px solid ${D.border}`,
  borderLeft: `4px solid ${colorSeverite(v.severite)}`,
  borderRadius: 12, 
  padding: 16, 
  marginBottom: 12 
}}>
                              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                                <span style={{ fontSize:10, fontWeight:600, padding:"2px 10px", borderRadius:20, background:`${colorSeverite(v.severite)}15`, color:colorSeverite(v.severite) }}>{v.severite}</span>
                                <span style={{ fontSize:14, fontWeight:600, color:D.text }}>{v.type}</span>
                              </div>
                              <div style={{ fontSize:11, color:D.faint, fontFamily:"monospace", marginBottom:8 }}>📄 {v.fichier} — ligne {v.ligne}</div>
                              <div style={{ fontSize:12, color:D.muted, background:D.card, padding:"8px 12px", borderRadius:8 }}>💡 {v.suggestion}</div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px", background:"rgba(16,185,129,0.08)", borderRadius:16 }}>
                          <span style={{ fontSize:40, marginBottom:8 }}>✅</span>
                          <span style={{ color:"#10b981" }}>Aucune vulnérabilité — Code propre !</span>
                        </div>
                      )}
                      {analyseActif.recommandations?.length > 0 && (
                        <>
                          <div style={{ fontSize:14, fontWeight:600, color:D.text, margin:"20px 0 12px" }}>💡 Recommandations</div>
                          {analyseActif.recommandations.map((r: any, i: number) => (
                            <div key={i} style={{ background:D.detailBg, border:`1px solid ${D.border}`, borderRadius:12, padding:16, marginBottom:12 }}>
                              <div style={{ fontSize:14, fontWeight:600, color:"#10b981", marginBottom:6 }}>✓ {r.titre}</div>
                              <div style={{ color:D.muted, fontSize:13 }}>{r.description}</div>
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