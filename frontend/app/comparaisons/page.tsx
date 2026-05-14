"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

interface Depot {
  id: number;
  nom: string;
  project_url: string;
  branche: string;
  created_at: string;
}

interface Analyse {
  id: number;
  statut: string;
  resultat_statut: string;
  score_qualite: number;
  score_securite: number;
  score_performance: number;
  vulnerabilites_count: number;
  mr_created: number;
  mr_url: string | null;
  mr_title: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Comparaison {
  id: number;
  depot_id: number;
  from_branch: string;
  to_branch: string;
  commits_count: number;
  files_json: any;
  created_at: string;
  analyses: Analyse[];
}

export default function ComparaisonsPage() {
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
    rowHover: isDark ? "#1a2030" : "#faf9fe",
    modalBg: isDark ? "#141921" : "white",
  };

  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [comparaisons, setComparaisons] = useState<Comparaison[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [filterResultat, setFilterResultat] = useState("tous");
  const [selectedComparaison, setSelectedComparaison] = useState<Comparaison | null>(null);
  const [selectedAnalyse, setSelectedAnalyse] = useState<Analyse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    const fetchDepots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }
        const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
        const userId = me.data.id;
        const res = await axios.get(`${API}/depots/user/${userId}`, { headers: getHeaders() });
        setDepots(res.data);
      } catch (e: any) {
        console.error("Erreur chargement dépôts", e);
        if (e.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDepots();
  }, []);

  const fetchComparaisons = async (depot: Depot) => {
    setLoadingDetails(true);
    setSelectedDepot(depot);
    setSelectedComparaison(null);
    setSelectedAnalyse(null);
    try {
      const res = await axios.get(`${API}/comparaisons/depot/${depot.id}`, { headers: getHeaders() });
      const data = res.data;
      
      const comparaisonsWithAnalyses = await Promise.all(
        data.map(async (comp: any) => {
          const analysesRes = await axios.get(`${API}/comparaisons/${comp.id}/analyses`, { headers: getHeaders() });
          return {
            ...comp,
            analyses: analysesRes.data
          };
        })
      );
      
      setComparaisons(comparaisonsWithAnalyses);
    } catch (e) {
      console.error("Erreur chargement comparaisons", e);
      setComparaisons([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDepotClick = (depot: Depot) => {
    fetchComparaisons(depot);
  };

  const handleComparaisonClick = (comparaison: Comparaison, analyse: Analyse) => {
    setSelectedComparaison(comparaison);
    setSelectedAnalyse(analyse);
    setShowDetailModal(true);
  };

  const filteredDepots = depots.filter(depot =>
    depot.nom.toLowerCase().includes(search.toLowerCase()) ||
    depot.project_url.toLowerCase().includes(search.toLowerCase())
  );

  const colorScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const getResultatBadge = (resultat: string) => {
    switch (resultat) {
      case "merge_autorise":
        return { bg: "#ecfdf5", color: "#10b981", icon: "✅", label: "Merge autorisé" };
      case "merge_bloque":
        return { bg: "#fef2f2", color: "#ef4444", icon: "🚫", label: "Merge bloqué" };
      case "aucun_changement":
        return { bg: "#fef3c7", color: "#f59e0b", icon: "○", label: "Aucun changement" };
      default:
        return { bg: D.tag, color: D.muted, icon: "⏳", label: "En cours" };
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex" }}>
        
        {/* Sidebar des dépôts */}
        <div style={{ width: 320, background: D.card, borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
          <div style={{ padding: 24, borderBottom: `1px solid ${D.border}` }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: D.text, marginBottom: 4 }}>📁 Mes dépôts</h2>
            <p style={{ fontSize: 12, color: D.faint }}>Sélectionnez un dépôt pour voir ses comparaisons</p>
          </div>
          <div style={{ padding: 16, borderBottom: `1px solid ${D.border}` }}>
            <input
              type="text"
              placeholder="🔍 Rechercher un dépôt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, outline: "none", background: D.bg, color: D.text }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: D.faint }}>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  border: `2px solid ${D.border}`,
                  borderTop: `2px solid #6366f1`,
                  borderRadius: "50%", 
                  animation: "spin 0.6s linear infinite", 
                  margin: "0 auto 12px" 
                }} />
                Chargement...
              </div>
            ) : filteredDepots.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: D.faint }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <div>Aucun dépôt trouvé</div>
              </div>
            ) : (
              filteredDepots.map(depot => (
                <div
                  key={depot.id}
                  onClick={() => handleDepotClick(depot)}
                  style={{
                    padding: "14px 16px",
                    margin: "4px 8px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    border: `1px solid ${selectedDepot?.id === depot.id ? "#6366f1" : "transparent"}`,
                    background: selectedDepot?.id === depot.id ? "rgba(99,102,241,0.12)" : "transparent"
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4 }}>{depot.nom}</div>
                  <div style={{ fontSize: 10, color: D.faint, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{depot.project_url}</div>
                  <div style={{ fontSize: 10, color: D.faint, marginTop: 6 }}>{new Date(depot.created_at).toLocaleDateString()}</div>
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
              <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", marginBottom: 4 }}>Historique des comparaisons</h1>
              <p style={{ fontSize: 13, color: D.faint }}>
                {selectedDepot ? `Comparaisons pour ${selectedDepot.nom}` : "Sélectionnez un dépôt dans la barre latérale"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ThemeToggle />
              <button onClick={() => router.push("/dashboard")} style={{ background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>
                ← Tableau de bord
              </button>
            </div>
          </div>

          {selectedDepot && (
            <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 32px", background: D.card, borderBottom: `1px solid ${D.border}` }}>
                <div style={{ background: D.bg, borderRadius: 16, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#6366f1", marginBottom: 4 }}>{comparaisons.length}</div>
                  <div style={{ fontSize: 12, color: D.faint }}>Comparaisons</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>
                    {comparaisons.filter(c => c.analyses?.some(a => a.score_qualite >= 75)).length}
                  </div>
                  <div style={{ fontSize: 12, color: D.faint }}>Score ≥ 75%</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>
                    {comparaisons.filter(c => c.analyses?.some(a => a.score_qualite >= 50 && a.score_qualite < 75)).length}
                  </div>
                  <div style={{ fontSize: 12, color: D.faint }}>Score 50-74%</div>
                </div>
                <div style={{ background: D.bg, borderRadius: 16, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>
                    {comparaisons.filter(c => c.analyses?.some(a => a.score_qualite < 50)).length}
                  </div>
                  <div style={{ fontSize: 12, color: D.faint }}>Score &lt; 50%</div>
                </div>
              </div>

              {/* Filtres */}
              <div style={{ display: "flex", gap: 12, padding: "16px 32px", background: D.card, borderBottom: `1px solid ${D.border}`, flexWrap: "wrap", alignItems: "center" }}>
                <select value={filterResultat} onChange={e => setFilterResultat(e.target.value)} style={{ padding: "8px 16px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, background: D.card, color: D.text, cursor: "pointer" }}>
                  <option value="tous">Tous les résultats</option>
                  <option value="merge_autorise">✅ Merge autorisé</option>
                  <option value="merge_bloque">🚫 Merge bloqué</option>
                  <option value="aucun_changement">○ Aucun changement</option>
                </select>
              </div>

              {/* Table des comparaisons */}
              <div style={{ margin: "24px 32px", background: D.card, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "auto" }}>
                {loadingDetails ? (
                  <div style={{ textAlign: "center", padding: 60, color: D.faint }}>
                    <div style={{ 
                      width: 20, 
                      height: 20, 
                      border: `2px solid ${D.border}`,
                      borderTop: `2px solid #6366f1`,
                      borderRadius: "50%", 
                      animation: "spin 0.6s linear infinite", 
                      margin: "0 auto 12px" 
                    }} />
                    Chargement...
                  </div>
                ) : comparaisons.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 60, color: D.faint }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                    <div>Aucune comparaison trouvée pour ce dépôt</div>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Date", "Branches", "Commits", "Qualité", "Sécurité", "Performance", "Résultat", "MR"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparaisons.map(comp => {
                        const latestAnalyse = comp.analyses?.[0];
                        if (!latestAnalyse) return null;
                        const resultat = getResultatBadge(latestAnalyse.resultat_statut);
                        return (
                          <tr key={comp.id} onClick={() => handleComparaisonClick(comp, latestAnalyse)} style={{ cursor: "pointer", borderBottom: `1px solid ${D.border}` }}>
                            <td style={{ padding: "14px 20px", fontFamily: "monospace", fontSize: 12, color: D.muted }}>{new Date(comp.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: "14px 20px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 500, background: D.tag, color: "#6366f1" }}>
                                {comp.from_branch} → {comp.to_branch}
                              </span>
                            </td>
                            <td style={{ padding: "14px 20px", color: D.muted }}>{comp.commits_count} commit(s)</td>
                            {[latestAnalyse.score_qualite, latestAnalyse.score_securite, latestAnalyse.score_performance].map((s, idx) => (
                              <td key={idx} style={{ padding: "14px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 600, fontFamily: "monospace", color: colorScore(s) }}>{s || "—"}</span>
                                  <div style={{ width: 60, height: 4, background: D.border, borderRadius: 2, overflow: "hidden" }}>
                                    <div style={{ width: `${s || 0}%`, height: 4, borderRadius: 2, background: colorScore(s || 0) }} />
                                  </div>
                                </div>
                              </td>
                            ))}
                            <td style={{ padding: "14px 20px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 500, background: resultat.bg, color: resultat.color }}>
                                {resultat.icon} {resultat.label}
                              </span>
                            </td>
                            <td style={{ padding: "14px 20px" }}>
                              {latestAnalyse.mr_created && latestAnalyse.mr_url ? (
                                <a href={latestAnalyse.mr_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#6366f1", textDecoration: "none", fontSize: 12 }}>
                                  🔀 Voir MR
                                </a>
                              ) : (
                                <span style={{ color: D.faint, fontSize: 11 }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {!selectedDepot && !loading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: D.faint }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
                <div>Sélectionnez un dépôt dans la barre latérale</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Détail */}
      {showDetailModal && selectedComparaison && selectedAnalyse && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowDetailModal(false)}>
          <div style={{ background: D.modalBg, borderRadius: 24, width: "90%", maxWidth: 600, maxHeight: "80vh", overflowY: "auto", animation: "slideUp 0.3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${D.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text }}>📊 Détail de l'analyse</h3>
              <button onClick={() => setShowDetailModal(false)} style={{ background: D.btnSec, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: D.muted }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", marginBottom: 6 }}>Date</div>
                <div style={{ fontSize: 14, color: D.text }}>{new Date(selectedAnalyse.created_at).toLocaleString()}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", marginBottom: 6 }}>Branches comparées</div>
                <div style={{ fontSize: 14, color: D.text }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 12, background: D.tag, color: "#6366f1" }}>
                    {selectedComparaison.from_branch} → {selectedComparaison.to_branch}
                  </span>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", marginBottom: 6 }}>Commits</div>
                <div style={{ fontSize: 14, color: D.text }}>{selectedComparaison.commits_count} commit(s)</div>
              </div>
              
              <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", marginBottom: 6 }}>Scores</div>
              <div style={{ display: "flex", gap: 16, margin: "16px 0" }}>
                {[
                  { label: "Qualité", val: selectedAnalyse.score_qualite },
                  { label: "Sécurité", val: selectedAnalyse.score_securite },
                  { label: "Performance", val: selectedAnalyse.score_performance },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: D.bg, borderRadius: 12, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: colorScore(s.val) }}>{s.val || "—"}</div>
                    <div style={{ fontSize: 11, color: D.faint }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {selectedAnalyse.vulnerabilites_count > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", marginBottom: 6 }}>Vulnérabilités détectées</div>
                  <div style={{ fontSize: 14, color: "#ef4444" }}>⚠️ {selectedAnalyse.vulnerabilites_count} vulnérabilité(s)</div>
                </div>
              )}

              {selectedAnalyse.mr_created && selectedAnalyse.mr_url && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", marginBottom: 6 }}>Merge Request associée</div>
                  <a href={selectedAnalyse.mr_url} target="_blank" rel="noreferrer" style={{ color: "#6366f1", textDecoration: "none" }}>
                    🔀 {selectedAnalyse.mr_title || "Voir la MR sur GitLab"} →
                  </a>
                </div>
              )}

              <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                <button onClick={() => router.push(`/analyse/rapport?analyse_id=${selectedAnalyse.id}`)} style={{ flex: 1, padding: "10px", background: D.btnPrimary, border: "none", borderRadius: 12, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  📄 Voir le rapport complet
                </button>
                <button onClick={() => setShowDetailModal(false)} style={{ flex: 1, padding: "10px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

