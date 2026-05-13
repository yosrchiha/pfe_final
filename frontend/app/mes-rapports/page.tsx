"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8001";

interface ExportRapport {
  id: number;
  analyse_id: number;
  user_id: number;
  format: string;
  chemin_fichier: string | null;
  taille: number | null;
  ip_address: string | null;
  created_at: string;
}

const menuItems = [
  { key: "dashboard",      label: "Tableau de bord", icon: "▦",  href: "/dashboard" },
  { key: "repositories",   label: "Dépôts",          icon: "◈",  href: "/depots" },
  { key: "comparaisons",   label: "Comparaisons",    icon: "📊", href: "/comparaisons" },
  { key: "analyses",       label: "Analyse",         icon: "◎",  href: "/analyse" },
  { key: "videos",         label: "Mes Vidéos",      icon: "🎬", href: "/mes-videos" },
  { key: "rapports",       label: "Mes Rapports",    icon: "📄", href: "/mes-rapports" },
  { key: "exploration",    label: "Exploration",     icon: "🗂️",  href: "/exploration-history" },
  { key: "tests",          label: "Tests",           icon: "🧪", href: "/TestsPaage" },
  { key: "issues",         label: "Issues",          icon: "◇",  href: "/issues" },
  { key: "merge_requests", label: "Merge Requests",  icon: "⟁",  href: "/merge-requests" },
  { key: "stats",          label: "Statistiques",    icon: "📈", href: "/stats" },
  { key: "calendar",       label: "Calendrier",      icon: "📅", href: "/calendar" },
  { key: "help",           label: "Support",         icon: "💬", href: "/help" },
];

function formatTaille(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export default function MesRapports() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [username, setUsername] = useState("Utilisateur");
  const [activeMenu, setActiveMenu] = useState("rapports");
  const [exports, setExports] = useState<ExportRapport[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pdf: 0, docx: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFormat, setFilterFormat] = useState<"tous" | "pdf" | "docx">("tous");
  const [ticketNotifs, setTicketNotifs] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const headers = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

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
    rowHover:   isDark ? "#1a2030" : "#faf9fe",
    input:      isDark ? "#1e2538" : "#f8fafc",
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API}/auth/me`, { headers: headers() });
        setUsername(res.data.username ?? "Utilisateur");
      } catch { router.push("/login"); }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await axios.get(`${API}/tickets/unread/count`, { headers: headers() });
        setTicketNotifs(res.data.tickets ?? []);
      } catch {}
    };
    fetchNotifs();
  }, []);

  useEffect(() => {
    const fetchExports = async () => {
      setLoading(true);
      try {
        const [exportsRes, statsRes] = await Promise.all([
          axios.get(`${API}/exports/`, { headers: headers() }),
          axios.get(`${API}/exports/stats`, { headers: headers() }),
        ]);
        setExports(exportsRes.data);
        setStats(statsRes.data);
      } catch {
        setExports([]);
      } finally {
        setLoading(false);
      }
    };
    fetchExports();
  }, []);

    // profile/page.tsx  (ligne 188)
  const handleLogout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }); } catch {}
    localStorage.removeItem("token"); localStorage.removeItem("user_id"); router.push("/login");
  };

  const handleDownload = async (exp: ExportRapport) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/exports/download/${exp.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
        alert(`Erreur : ${err.detail}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport_analyse_${exp.analyse_id}.${exp.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Impossible de télécharger le fichier. Vérifiez votre connexion.");
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/exports/${deleteId}`, { headers: headers() });
      setExports(prev => prev.filter(e => e.id !== deleteId));
      setStats(prev => {
        const deleted = exports.find(e => e.id === deleteId);
        const fmt = deleted?.format ?? "";
        return {
          total: prev.total - 1,
          pdf:   fmt === "pdf"  ? prev.pdf  - 1 : prev.pdf,
          docx:  fmt === "docx" ? prev.docx - 1 : prev.docx,
        };
      });
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const filtered = exports.filter(e => {
    const matchFormat = filterFormat === "tous" || e.format === filterFormat;
    const matchSearch =
      !searchTerm ||
      String(e.analyse_id).includes(searchTerm) ||
      e.format.toLowerCase().includes(searchTerm.toLowerCase()) ||
      new Date(e.created_at).toLocaleDateString("fr-FR").includes(searchTerm);
    return matchFormat && matchSearch;
  });

  const statCards = [
    { label: "Rapports exportés", value: stats.total, icon: "📄", color: "#6366f1" },
    { label: "Format PDF",        value: stats.pdf,   icon: "🔴", color: "#ef4444" },
    { label: "Format DOCX",       value: stats.docx,  icon: "🔵", color: "#3b82f6" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        @keyframes spin { to { transform:rotate(360deg); } }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:${D.bg}; }
        ::-webkit-scrollbar-thumb { background:${D.border}; border-radius:3px; }
        @media (max-width:900px) { .sidebar-hide { display:none!important; } }
      `}</style>

      <div style={{ minHeight:"100vh", background:D.bg, fontFamily:"'Inter',sans-serif", color:D.text, display:"flex", transition:"background 0.3s, color 0.3s" }}>

        {/* ══ SIDEBAR ══ */}
        <aside className="sidebar-hide" style={{ width:260, background:D.sidebar, borderRight:`1px solid ${D.border}`, display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", transition:"background 0.3s" }}>
          <div style={{ padding:"24px 20px", borderBottom:`1px solid ${D.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:18, color:"white" }}>A</div>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:D.text }}>AuditPlatform</div>
                <div style={{ fontSize:10, color:D.faint, marginTop:2 }}>GitLab · IA · PFE 2025</div>
              </div>
            </div>
          </div>

          <nav style={{ flex:1, padding:"24px 16px", display:"flex", flexDirection:"column", gap:4 }}>
            {menuItems.map(item => {
              const isActive = activeMenu === item.key;
              return (
                <button key={item.key}
                  onClick={() => { setActiveMenu(item.key); if (item.href) router.push(item.href); }}
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

          <div style={{ padding:20, borderTop:`1px solid ${D.border}` }}>
            <div style={{ marginBottom:12 }}><ThemeToggle /></div>
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
              <div style={{ fontSize:24, fontWeight:700, color:D.text, letterSpacing:"-0.02em" }}>📄 Mes Rapports</div>
              <div style={{ fontSize:13, color:D.faint, marginTop:4 }}>
                Historique de tous vos rapports exportés
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={() => router.push("/analyse")}
                style={{ padding:"10px 20px", background:D.btnPrimary, border:"none", borderRadius:12, color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                + Nouvelle analyse
              </button>
            </div>
          </header>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>

            {/* Stat cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, marginBottom:32 }}>
              {statCards.map((s, i) => (
                <div key={i} style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:20, padding:24, display:"flex", alignItems:"center", gap:20, transition:"background 0.3s" }}>
                  <div style={{ width:56, height:56, borderRadius:16, background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize:36, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:12, color:D.faint, marginTop:6, fontWeight:500 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:20, padding:"16px 20px", marginBottom:24, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", transition:"background 0.3s" }}>
              <span style={{ fontSize:13, fontWeight:600, color:D.faint }}>🔍 Filtrer :</span>
              <input
                type="text"
                placeholder="Rechercher par ID, format, date…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex:1, minWidth:200, padding:"8px 14px", background:D.input, border:`1px solid ${D.border}`, borderRadius:10, fontSize:13, color:D.text, outline:"none" }}
              />
              <div style={{ display:"flex", gap:8 }}>
                {(["tous","pdf","docx"] as const).map(f => (
                  <button key={f} onClick={() => setFilterFormat(f)}
                    style={{ padding:"8px 16px", borderRadius:10, border:"none", fontSize:12, fontWeight:600, cursor:"pointer", background: filterFormat===f ? "#6366f1" : D.btnSec, color: filterFormat===f ? "white" : D.muted, textTransform:"uppercase", letterSpacing:"0.05em", transition:"all 0.2s" }}>
                    {f === "tous" ? "Tous" : f.toUpperCase()}
                  </button>
                ))}
              </div>
              <span style={{ fontSize:12, color:D.faint, marginLeft:"auto" }}>
                {filtered.length} rapport{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:20, overflow:"hidden", transition:"background 0.3s" }}>
              {loading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, padding:60, color:D.faint }}>
                  <div style={{ width:22, height:22, borderTop:"2px solid #6366f1", borderRight:"2px solid transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                  Chargement des rapports…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"80px 20px", color:D.faint }}>
                  <span style={{ fontSize:56, marginBottom:20 }}>📭</span>
                  <div style={{ fontSize:16, fontWeight:600, color:D.text, marginBottom:8 }}>
                    {exports.length === 0 ? "Aucun rapport exporté" : "Aucun résultat trouvé"}
                  </div>
                  <div style={{ fontSize:13, color:D.faint, textAlign:"center", maxWidth:300 }}>
                    {exports.length === 0
                      ? "Lancez une analyse et exportez votre rapport PDF ou DOCX."
                      : "Essayez de modifier vos filtres de recherche."}
                  </div>
                  {exports.length === 0 && (
                    <button onClick={() => router.push("/analyse")}
                      style={{ marginTop:20, padding:"10px 24px", background:"#6366f1", border:"none", borderRadius:12, color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                      + Lancer une analyse
                    </button>
                  )}
                </div>
              ) : (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr>
                      {["#","Analyse ID","Format","Taille","Date d'export","Fichier","Actions"].map(h => (
                        <th key={h} style={{ textAlign:"left", padding:"14px 16px", fontSize:11, fontWeight:600, color:D.faint, borderBottom:`1px solid ${D.border}`, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((exp, idx) => {
                      const isPdf  = exp.format === "pdf";
                      const fmtColor = isPdf ? "#ef4444" : "#3b82f6";
                      const fileName = exp.chemin_fichier
                        ? exp.chemin_fichier.split("/").pop() ?? "—"
                        : "—";
                      return (
                        <tr key={exp.id}
                          style={{ transition:"background 0.15s" }}
                          onMouseEnter={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = D.rowHover))}
                          onMouseLeave={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = "transparent"))}
                        >
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}`, color:D.faint, fontFamily:"monospace" }}>{idx + 1}</td>
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}` }}>
                            <span style={{ background:"rgba(99,102,241,0.12)", color:"#6366f1", fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>
                              # {exp.analyse_id}
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}` }}>
                            <span style={{ background:`${fmtColor}15`, color:fmtColor, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                              {isPdf ? "🔴" : "🔵"} {exp.format}
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}`, color:D.muted, fontFamily:"monospace", fontSize:12 }}>
                            {formatTaille(exp.taille)}
                          </td>
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}`, color:D.muted, fontFamily:"monospace", fontSize:12 }}>
                            {new Date(exp.created_at).toLocaleString("fr-FR", {
                              day:"2-digit", month:"short", year:"numeric",
                              hour:"2-digit", minute:"2-digit"
                            })}
                          </td>
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}`, maxWidth:200 }}>
                            <span style={{ fontSize:11, color:D.faint, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}
                              title={fileName}>
                              {fileName}
                            </span>
                          </td>
                          <td style={{ padding:"14px 16px", borderBottom:`1px solid ${D.border}` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {exp.chemin_fichier ? (
                                <button onClick={() => handleDownload(exp)}
                                  title="Télécharger"
                                  style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:10, color:"#6366f1", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.22)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.12)"; }}>
                                  ⬇️ Télécharger
                                </button>
                              ) : (
                                <span style={{ fontSize:11, color:D.faint, fontStyle:"italic" }}>Non disponible</span>
                              )}
                              <button onClick={() => setDeleteId(exp.id)}
                                title="Supprimer ce rapport"
                                style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34, background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, cursor:"pointer", fontSize:15, transition:"all 0.2s", flexShrink:0 }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.10)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; }}>
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ══ MODALE CONFIRMATION SUPPRESSION ══ */}
      {deleteId !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => { if (!deleting) setDeleteId(null); }}>
          <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:24, padding:36, maxWidth:420, width:"90%", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:56, height:56, background:"rgba(239,68,68,0.12)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:20 }}>
              🗑️
            </div>
            <div style={{ fontSize:18, fontWeight:700, color:D.text, marginBottom:8 }}>
              Supprimer ce rapport ?
            </div>
            <div style={{ fontSize:13, color:D.faint, marginBottom:28, lineHeight:1.6 }}>
              Cette action est <strong style={{ color:"#ef4444" }}>irréversible</strong>. Le rapport et le fichier associé seront définitivement supprimés.
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                style={{ flex:1, padding:"10px 0", background:D.btnSec, border:`1px solid ${D.border}`, borderRadius:12, fontSize:13, fontWeight:600, color:D.muted, cursor:"pointer", transition:"all 0.2s" }}>
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex:1, padding:"10px 0", background: deleting ? "rgba(239,68,68,0.4)" : "#ef4444", border:"none", borderRadius:12, fontSize:13, fontWeight:600, color:"white", cursor: deleting ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s" }}>
                {deleting ? (
                  <><div style={{ width:14, height:14, borderTop:"2px solid white", borderRight:"2px solid transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} /> Suppression…</>
                ) : "🗑️ Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
