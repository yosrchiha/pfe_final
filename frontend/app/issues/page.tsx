"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://127.0.0.1:8000";

interface Projet {
  id: number;
  nom: string;
  project_url: string;
  branche: string;
  created_at: string;
}

interface Issue {
  id               : number;
  titre            : string;
  description      : string;
  severite         : string;
  type_vuln        : string;
  fichier          : string;
  ligne            : number;
  statut           : string;
  issue_url        : string;
  created_at       : string;
  depot_analyse_id : number;
}

export default function IssuesPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const D = {
    bg: theme.bg,
    card: theme.bgSecondary,
    border: theme.border,
    text: theme.text,
    muted: theme.textMuted,
    faint: theme.textFaint,
    tag: isDark ? "#1e2538" : "#f1f5f9",
    tagText: isDark ? "#94a3b8" : "#475569",
    btnPrimary: isDark ? "#6366f1" : "#0f172a",
    btnSec: isDark ? "#1e2538" : "#f1f5f9",
    inputBg: isDark ? "#0f1117" : "white",
    rowHover: isDark ? "#1a2030" : "#faf9fe",
    selectedBg: isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    codeBg: isDark ? "#0f1117" : "#f8fafc",
    cardBg: isDark ? "#131625" : "white",
    severity: {
      CRITIQUE: { bg: isDark ? "#ef444420" : "#fef2f2", text: "#ef4444", icon: "🔴", label: "Critique" },
      HAUTE:    { bg: isDark ? "#f9731620" : "#fff7ed", text: "#f97316", icon: "🟠", label: "Haute" },
      MOYENNE:  { bg: isDark ? "#eab30820" : "#fffbeb", text: "#eab308", icon: "🟡", label: "Moyenne" },
      FAIBLE:   { bg: isDark ? "#10b98120" : "#ecfdf5", text: "#10b981", icon: "🟢", label: "Faible" },
    },
    statut: {
      opened: { bg: isDark ? "#6366f120" : "#eef2ff", text: "#6366f1", icon: "○", label: "Ouverte" },
      closed: { bg: isDark ? "#10b98120" : "#dcfce7", text: "#10b981", icon: "✓", label: "Fermée" },
    },
  };

  const [projets, setProjets] = useState<Projet[]>([]);
  const [projetSelectionne, setProjetSelectionne] = useState<Projet | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSeverite, setFilterSeverite] = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    ouvertes: 0,
    fermees: 0,
    critiques: 0,
    hautes: 0,
    moyennes: 0,
    faibles: 0,
  });

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    const fetchProjets = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
        const userId = me.data.id;
        const res = await axios.get(`${API}/analyses/depots-user/${userId}`);
        setProjets(res.data);
        if (res.data.length > 0) {
          setProjetSelectionne(res.data[0]);
          fetchIssues(res.data[0].id);
        }
      } catch (e) {
        console.error("Erreur chargement projets", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProjets();
  }, []);

  const fetchIssues = async (projetId: number) => {
    setLoadingIssues(true);
    try {
      const res = await axios.get(`${API}/issues/depot/${projetId}`, { headers: getHeaders() });
      setIssues(res.data);
      
      const data = res.data;
      setStats({
        total: data.length,
        ouvertes: data.filter((i: Issue) => i.statut === "opened").length,
        fermees: data.filter((i: Issue) => i.statut === "closed").length,
        critiques: data.filter((i: Issue) => i.severite === "CRITIQUE").length,
        hautes: data.filter((i: Issue) => i.severite === "HAUTE").length,
        moyennes: data.filter((i: Issue) => i.severite === "MOYENNE").length,
        faibles: data.filter((i: Issue) => i.severite === "FAIBLE").length,
      });
    } catch (e) {
      console.error("Erreur chargement issues", e);
      setIssues([]);
    } finally {
      setLoadingIssues(false);
    }
  };

  const selectionnerProjet = (projet: Projet) => {
    setProjetSelectionne(projet);
    setSelectedIssue(null);
    fetchIssues(projet.id);
  };

  const syncStatus = async (id: number) => {
    try {
      const res = await axios.patch(`${API}/issues/${id}/sync`, {}, { headers: getHeaders() });
      setIssues(prev => prev.map(issue => 
        issue.id === id ? { ...issue, statut: res.data.statut } : issue
      ));
      fetchIssues(projetSelectionne!.id);
    } catch (e) {
      alert("Erreur synchronisation");
    }
  };

  const toggleStatus = async (issue: Issue) => {
    setTogglingId(issue.id);
    const action = issue.statut === "opened" ? "close" : "reopen";
    try {
      const res = await axios.put(`${API}/issues/${issue.id}/${action}`, {}, { headers: getHeaders() });
      const updatedStatut = res.data.statut;
      setIssues(prev => {
        const updated = prev.map(i => i.id === issue.id ? { ...i, statut: updatedStatut } : i);
        setStats({
          total: updated.length,
          ouvertes: updated.filter(i => i.statut === "opened").length,
          fermees: updated.filter(i => i.statut === "closed").length,
          critiques: updated.filter(i => i.severite === "CRITIQUE").length,
          hautes: updated.filter(i => i.severite === "HAUTE").length,
          moyennes: updated.filter(i => i.severite === "MOYENNE").length,
          faibles: updated.filter(i => i.severite === "FAIBLE").length,
        });
        return updated;
      });
      if (selectedIssue?.id === issue.id) {
        setSelectedIssue(prev => prev ? { ...prev, statut: updatedStatut } : null);
      }
    } catch (e) {
      alert("Erreur lors du changement de statut");
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = issues.filter(issue => {
    const matchSearch = 
      issue.titre?.toLowerCase().includes(search.toLowerCase()) ||
      issue.fichier?.toLowerCase().includes(search.toLowerCase()) ||
      issue.type_vuln?.toLowerCase().includes(search.toLowerCase());
    
    const matchSeverite = filterSeverite === "tous" || issue.severite === filterSeverite;
    const matchStatut = filterStatut === "tous" || issue.statut === filterStatut;
    
    return matchSearch && matchSeverite && matchStatut;
  });

  const severiteConfig = (s: string) => {
    return D.severity[s as keyof typeof D.severity] || D.severity.FAIBLE;
  };

  const statutConfig = (s: string) => {
    return D.statut[s as keyof typeof D.statut] || D.statut.opened;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex" }}>

        {/* Sidebar des projets */}
        <div style={{ width: 320, background: D.card, borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
          <div style={{ padding: 24, borderBottom: `1px solid ${D.border}` }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 4 }}>Mes projets</h2>
            <p style={{ fontSize: 12, color: D.faint }}>Sélectionnez un projet pour voir ses issues</p>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: D.faint }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
                Chargement...
              </div>
            ) : projets.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: D.faint }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
                <div>Aucun projet analysé</div>
              </div>
            ) : (
              projets.map(projet => (
                <div
                  key={projet.id}
                  onClick={() => selectionnerProjet(projet)}
                  style={{
                    padding: "14px 16px",
                    margin: "4px 8px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderTop: `1px solid ${projetSelectionne?.id === projet.id ? "#6366f1" : "transparent"}`,
                    borderRight: `1px solid ${projetSelectionne?.id === projet.id ? "#6366f1" : "transparent"}`,
                    borderBottom: `1px solid ${projetSelectionne?.id === projet.id ? "#6366f1" : "transparent"}`,
                    borderLeft: `1px solid ${projetSelectionne?.id === projet.id ? "#6366f1" : "transparent"}`,
                    background: projetSelectionne?.id === projet.id ? D.selectedBg : "transparent"
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4 }}>{projet.nom}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontFamily: "monospace", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{projet.project_url}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: D.tag, borderRadius: 12, color: D.tagText }}>{projet.branche}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: D.tag, borderRadius: 12, color: D.tagText }}>{new Date(projet.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          {/* Topbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", background: D.card, borderBottom: `1px solid ${D.border}` }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", margin: "0 0 4px 0" }}>Issues GitLab</h1>
              <p style={{ fontSize: 13, color: D.faint, margin: 0 }}>
                {projetSelectionne ? `Issues détectées pour ${projetSelectionne.nom}` : "Sélectionnez un projet à gauche"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ThemeToggle />
              <button onClick={() => router.push("/dashboard")} style={{ background: D.btnSec, border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted, display: "flex", alignItems: "center", gap: 6 }}>
                ← Tableau de bord
              </button>
            </div>
          </div>

          {projetSelectionne && (
            <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, padding: "20px 32px", background: D.card, borderBottom: `1px solid ${D.border}` }}>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#6366f1", marginBottom: 4 }}>{stats.total}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Total</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>{stats.ouvertes}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Ouvertes</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>{stats.fermees}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Fermées</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>{stats.critiques}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Critiques</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#f97316", marginBottom: 4 }}>{stats.hautes}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Hautes</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#eab308", marginBottom: 4 }}>{stats.moyennes}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Moyennes</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>{stats.faibles}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontWeight: 500 }}>Faibles</div>
                </div>
              </div>

              {/* Filtres */}
              <div style={{ display: "flex", gap: 12, padding: "16px 32px", background: D.card, borderBottom: `1px solid ${D.border}`, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: D.faint, fontSize: 14 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher par titre, fichier..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: "100%", padding: "10px 16px 10px 42px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, background: D.inputBg, color: D.text, outline: "none" }}
                  />
                </div>
                <select value={filterSeverite} onChange={e => setFilterSeverite(e.target.value)} style={{ padding: "10px 16px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, background: D.inputBg, color: D.text, cursor: "pointer" }}>
                  <option value="tous">Toutes sévérités</option>
                  <option value="CRITIQUE">🔴 Critique</option>
                  <option value="HAUTE">🟠 Haute</option>
                  <option value="MOYENNE">🟡 Moyenne</option>
                  <option value="FAIBLE">🟢 Faible</option>
                </select>
                <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={{ padding: "10px 16px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, background: D.inputBg, color: D.text, cursor: "pointer" }}>
                  <option value="tous">Tous statuts</option>
                  <option value="opened">○ Ouvertes</option>
                  <option value="closed">✓ Fermées</option>
                </select>
                <span style={{ fontSize: 13, color: D.faint, background: D.tag, padding: "5px 12px", borderRadius: 20 }}>{filtered.length} résultat(s)</span>
                <button onClick={() => fetchIssues(projetSelectionne.id)} style={{ background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", color: D.muted }}>↻ Rafraîchir</button>
              </div>

              {/* Cards Grid */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 20 }}>
                {loadingIssues ? (
                  <div style={{ textAlign: "center", padding: 60, color: D.faint }}>
                    <div style={{ width: 20, height: 20, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
                    Chargement des issues...
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 80, color: D.faint }}>
                    <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.5 }}>◇</div>
                    <div>Aucune issue trouvée pour ce projet</div>
                  </div>
                ) : (
                  filtered.map(issue => {
                    const severity = severiteConfig(issue.severite);
                    const status = statutConfig(issue.statut);
                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        style={{
                          background: selectedIssue?.id === issue.id ? D.selectedBg : D.cardBg,
                          borderTop: `1px solid ${D.border}`,
                          borderRight: `1px solid ${D.border}`,
                          borderBottom: `1px solid ${D.border}`,
                          borderLeft: `4px solid ${severity.text}`,
                          borderRadius: 20,
                          padding: 20,
                          transition: "all 0.2s",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 600, background: severity.bg, color: severity.text }}>
                            {severity.icon} {severity.label}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 500, background: status.bg, color: status.text }}>
                            {status.icon} {status.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: D.text, marginBottom: 8, lineHeight: 1.4 }}>{issue.titre}</div>
                        <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace", marginBottom: 8 }}>📄 {issue.fichier} — ligne {issue.ligne}</div>
                        <div style={{ fontSize: 12, color: D.muted, background: D.bg, padding: "10px 12px", borderRadius: 12, margin: "12px 0", lineHeight: 1.5 }}>💡 {issue.description?.slice(0, 150)}...</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                          <span style={{ fontSize: 10, color: D.faint, fontFamily: "monospace" }}>{new Date(issue.created_at).toLocaleDateString()}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStatus(issue); }}
                              disabled={togglingId === issue.id}
                              style={{
                                background: issue.statut === "opened"
                                  ? (isDark ? "#ef444420" : "#fef2f2")
                                  : (isDark ? "#10b98120" : "#dcfce7"),
                                border: `1px solid ${issue.statut === "opened" ? "#ef4444" : "#10b981"}`,
                                borderRadius: 8,
                                padding: "5px 12px",
                                fontSize: 11,
                                cursor: togglingId === issue.id ? "not-allowed" : "pointer",
                                color: issue.statut === "opened" ? "#ef4444" : "#10b981",
                                fontWeight: 600,
                                opacity: togglingId === issue.id ? 0.6 : 1,
                                transition: "all 0.2s"
                              }}
                            >
                              {togglingId === issue.id ? "..." : issue.statut === "opened" ? "✕ Fermer" : "↺ Rouvrir"}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); syncStatus(issue.id); }} style={{ background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", color: D.muted }}>↻ Sync</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {!projetSelectionne && !loading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: D.faint }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.5 }}>📁</div>
                <div>Sélectionnez un projet dans la barre latérale</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel latéral détail */}
      {selectedIssue && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 15, display: "block" }} onClick={() => setSelectedIssue(null)} />
          <div style={{
            position: "fixed", right: 0, top: 0, width: 480, height: "100vh",
            background: D.card, borderLeft: `1px solid ${D.border}`,
            transform: "translateX(0)", transition: "transform 0.3s ease",
            zIndex: 20, display: "flex", flexDirection: "column",
            boxShadow: "-4px 0 20px rgba(0,0,0,0.05)"
          }}>
            <div style={{ padding: 24, borderBottom: `1px solid ${D.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D.text, marginBottom: 6 }}>{selectedIssue.titre}</div>
                <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace" }}>Issue #{selectedIssue.id} · {new Date(selectedIssue.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => setSelectedIssue(null)} style={{ background: D.btnSec, border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, color: D.muted }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Lien GitLab</div>
                <a href={selectedIssue.issue_url} target="_blank" rel="noreferrer" style={{ color: "#6366f1", textDecoration: "none", fontSize: 13 }}>{selectedIssue.issue_url}</a>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Sévérité</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 600, background: severiteConfig(selectedIssue.severite).bg, color: severiteConfig(selectedIssue.severite).text }}>
                  {severiteConfig(selectedIssue.severite).icon} {severiteConfig(selectedIssue.severite).label}
                </span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Type</div>
                <div style={{ fontSize: 13, color: D.text }}>{selectedIssue.type_vuln}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Localisation</div>
                <div style={{ fontSize: 13, color: D.text, fontFamily: "monospace" }}>📄 {selectedIssue.fichier} — ligne {selectedIssue.ligne}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Description complète</div>
                <pre style={{ background: D.codeBg, border: `1px solid ${D.border}`, borderRadius: 12, padding: 14, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", color: D.text }}>{selectedIssue.description}</pre>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Statut</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 500, background: statutConfig(selectedIssue.statut).bg, color: statutConfig(selectedIssue.statut).text }}>
                  {statutConfig(selectedIssue.statut).icon} {statutConfig(selectedIssue.statut).label}
                </span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => toggleStatus(selectedIssue)}
                  disabled={togglingId === selectedIssue.id}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: togglingId === selectedIssue.id ? "not-allowed" : "pointer",
                    border: "none",
                    transition: "all 0.2s",
                    opacity: togglingId === selectedIssue.id ? 0.6 : 1,
                    background: selectedIssue.statut === "opened"
                      ? (isDark ? "#ef444430" : "#fef2f2")
                      : (isDark ? "#10b98130" : "#dcfce7"),
                    color: selectedIssue.statut === "opened" ? "#ef4444" : "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {togglingId === selectedIssue.id
                    ? "⏳ En cours..."
                    : selectedIssue.statut === "opened"
                      ? "✕ Fermer l'issue sur GitLab"
                      : "↺ Rouvrir l'issue sur GitLab"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}