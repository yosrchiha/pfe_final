"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

// ── Types ────────────────────────────────────────────────
interface DepotAnalyse {
  id          : number;
  nom         : string;
  project_url : string;
  branche     : string;
  created_at  : string;
}

interface Analyse {
  id                : number;
  branche           : string;
  score_qualite     : number;
  score_securite    : number;
  score_performance : number;
  vulnerabilites    : any[];
  recommandations   : any[];
  statut            : string;
  created_at        : string;
}

const API = "http://127.0.0.1:8000";

export default function DepotsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  // Palettes dynamiques
  const D = {
    bg:         theme.bg,
    card:       theme.bgSecondary,
    border:     theme.border,
    text:       theme.text,
    muted:      theme.textMuted,
    faint:      theme.textFaint,
    tag:        isDark ? "#1e2538" : "#f1f5f9",
    tagText:    isDark ? "#94a3b8" : "#475569",
    btnPrimary: isDark ? "#6366f1" : "#0f172a",
    btnSec:     isDark ? "#1e2538" : "#f1f5f9",
    rowHover:   isDark ? "#1a2030" : "#fef9f5",
    modalBg:    isDark ? "#141921" : "white",
  };

  // États
  const [depots,  setDepots]  = useState<DepotAnalyse[]>([]);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  // Modal analyse / relancer
  const [modalDepot,   setModalDepot]   = useState<DepotAnalyse | null>(null);
  const [modalToken,   setModalToken]   = useState("");
  const [modalError,   setModalError]   = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMode,    setModalMode]    = useState<"analyse" | "relancer">("analyse");

  // Modal MODIFIER
  const [editDepot,      setEditDepot]      = useState<DepotAnalyse | null>(null);
  const [editNom,        setEditNom]        = useState("");
  const [editUrl,        setEditUrl]        = useState("");
  const [editBranche,    setEditBranche]    = useState("");
  const [editLoading,    setEditLoading]    = useState(false);
  const [editError,      setEditError]      = useState("");
  const [editHasWarning, setEditHasWarning] = useState(false);
  const [editConfirmed,  setEditConfirmed]  = useState(false);

  // Modal SUPPRIMER
  const [deleteDepot,   setDeleteDepot]   = useState<DepotAnalyse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Vue analyses
  const [vueAnalyse,    setVueAnalyse]    = useState(false);
  const [analyses,      setAnalyses]      = useState<Analyse[]>([]);
  const [depotVu,       setDepotVu]       = useState<DepotAnalyse | null>(null);
  const [analyseDetail, setAnalyseDetail] = useState<Analyse | null>(null);
  const [loadingA,      setLoadingA]      = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Chargement initial
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
        const userId = me.data.id;
        const res = await axios.get(`${API}/analyses/depots-user/${userId}`);
        setDepots(res.data);
      } catch { setDepots([]); }
      finally { setLoading(false); }
    };
    fetch();
    window.addEventListener("focus", fetch);
    return () => window.removeEventListener("focus", fetch);
  }, []);

  const filtered = depots.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    d.project_url.toLowerCase().includes(search.toLowerCase())
  );

  // Ouvrir modal modifier
  const ouvrirEdit = (depot: DepotAnalyse) => {
    setEditDepot(depot);
    setEditNom(depot.nom);
    setEditUrl(depot.project_url);
    setEditBranche(depot.branche);
    setEditError("");
    setEditHasWarning(false);
    setEditConfirmed(false);
  };

  const urlChanged    = editDepot ? editUrl.trim()     !== editDepot.project_url : false;
  const brancheChanged = editDepot ? editBranche.trim() !== editDepot.branche      : false;
  const isCritical    = urlChanged || brancheChanged;

  // Valider modification
  const validerEdit = async () => {
    if (!editDepot) return;
    if (!editNom.trim()) { setEditError("Le nom est requis."); return; }
    if (!editUrl.trim()) { setEditError("L'URL est requise."); return; }
    if (!editBranche.trim()) { setEditError("La branche est requise."); return; }

    if (isCritical && !editConfirmed) {
      setEditHasWarning(true);
      return;
    }

    setEditLoading(true);
    setEditError("");
    try {
      await axios.put(
        `${API}/analyses/depots/${editDepot.id}`,
        { nom: editNom.trim(), project_url: editUrl.trim(), branche: editBranche.trim() },
        { headers: getHeaders() }
      );

      setDepots(prev => prev.map(d =>
        d.id === editDepot.id
          ? { ...d, nom: editNom.trim(), project_url: editUrl.trim(), branche: editBranche.trim() }
          : d
      ));

      setEditDepot(null);
      showToast("Dépôt modifié avec succès.");

      if (isCritical) {
        const res = await axios.get(`${API}/analyses/depots-user/${editDepot.id}`);
        // Rafraîchir
      }

    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setEditError(typeof detail === "string" ? detail : "Erreur lors de la modification.");
    } finally {
      setEditLoading(false);
    }
  };

  // Supprimer dépôt
  const confirmerSupprimer = async () => {
    if (!deleteDepot) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/analyses/depots/${deleteDepot.id}`, { headers: getHeaders() });
      setDepots(prev => prev.filter(d => d.id !== deleteDepot.id));
      setDeleteDepot(null);
      showToast("Dépôt et toutes ses analyses supprimés.");
    } catch (e: any) {
      showToast("Erreur lors de la suppression.", false);
      setDeleteDepot(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Modal analyse / relancer
  const ouvrirModalAnalyse = (depot: DepotAnalyse) => {
    setModalDepot(depot);
    setModalToken("");
    setModalError("");
    setModalMode("analyse");
  };

  const ouvrirModalRelancer = (depot: DepotAnalyse) => {
    setModalDepot(depot);
    setModalToken("");
    setModalError("");
    setModalMode("relancer");
  };

  const validerToken = async () => {
    if (!modalToken.trim()) {
      setModalError("Le token GitLab est requis");
      return;
    }
    setModalLoading(true);
    setModalError("");

    try {
      if (modalMode === "relancer") {
        await axios.post(`${API}/analyses/lancer`, {
          nom_projet    : modalDepot!.nom,
          gitlab_token  : modalToken,
          project_url   : modalDepot!.project_url,
          branche       : modalDepot!.branche,
          owasp_enabled : true,
          auto_tests    : false,
          auto_mr       : false,
          seuil_qualite : 60,
        }, { headers: getHeaders() });
      }

      setLoadingA(true);
      const res = await axios.get(`${API}/analyses/depot/${modalDepot!.id}`);
      setAnalyses(res.data);
      setDepotVu(modalDepot);
      setModalDepot(null);
      setVueAnalyse(true);
      setAnalyseDetail(null);

    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setModalError(typeof detail === "string" ? detail : "Token invalide ou projet introuvable");
    } finally {
      setModalLoading(false);
      setLoadingA(false);
    }
  };

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

  // Style du spinner
  const spinnerStyle = {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: D.border,
    borderTopColor: "#6366f1",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
    margin: "0 auto 12px"
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .row-hover:hover td { background: ${D.rowHover} !important; }
        .action-btn { transition: all 0.15s; }
        .action-btn:hover { opacity: 0.8; transform: translateY(-1px); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, transition: "background 0.3s, color 0.3s" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 40px" }}>

          {/* HEADER avec ThemeToggle */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", margin: 0 }}>
                {analyseDetail
                  ? "Détail de l'analyse"
                  : vueAnalyse
                  ? `Analyses • ${depotVu?.nom}`
                  : "Mes projets"}
              </h1>
              <p style={{ fontSize: 14, color: D.faint, margin: 0 }}>
                {analyseDetail
                  ? `Analyse du ${analyseDetail.created_at ? new Date(analyseDetail.created_at).toLocaleDateString("fr-FR") : ""}`
                  : vueAnalyse
                  ? `${analyses.length} analyse(s) réalisée(s)`
                  : "Projets analysés par l'intelligence artificielle"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ThemeToggle />
              {!vueAnalyse && !analyseDetail && (
                <button
                  onClick={() => router.push("/analyse")}
                  style={{ background: D.btnPrimary, color: "white", border: "none", padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                >
                  + Nouvelle analyse
                </button>
              )}
            </div>
          </div>

          {/* STATS (uniquement en vue liste) */}
          {!vueAnalyse && !analyseDetail && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "20px 24px" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#6366f1", marginBottom: 4 }}>{depots.length}</div>
                <div style={{ fontSize: 13, color: D.faint, fontWeight: 500 }}>Projets analysés</div>
              </div>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "20px 24px" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>{[...new Set(depots.map(d => d.branche))].length}</div>
                <div style={{ fontSize: 13, color: D.faint, fontWeight: 500 }}>Branches</div>
              </div>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "20px 24px" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>✓</div>
                <div style={{ fontSize: 13, color: D.faint, fontWeight: 500 }}>Analysé par IA</div>
              </div>
            </div>
          )}

          {/* SEARCH (uniquement en vue liste) */}
          {!vueAnalyse && !analyseDetail && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: D.faint, fontSize: 16 }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un projet..."
                  style={{ width: "100%", padding: "10px 16px 10px 42px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, background: D.card, color: D.text, outline: "none" }}
                />
              </div>
              <span style={{ fontSize: 13, color: D.faint }}>{filtered.length} projet{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {/* VUE 1 — LISTE DES PROJETS */}
          {!vueAnalyse && !analyseDetail && (
            <>
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={spinnerStyle} />
                  <div style={{ color: D.faint }}>Chargement...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📁</div>
                  <div style={{ color: D.faint, fontSize: 14 }}>
                    {depots.length === 0 ? "Aucun projet analysé — lance ta première analyse !" : "Aucun résultat pour cette recherche"}
                  </div>
                  {depots.length === 0 && (
                    <button onClick={() => router.push("/analyse")} style={{ marginTop: 16, background: D.btnPrimary, color: "white", border: "none", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      + Lancer une analyse
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Nom</th>
                        <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>URL</th>
                        <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Branche</th>
                        <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Date</th>
                        <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Statut</th>
                        <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => (
                        <tr key={d.id} className="row-hover" style={{ borderBottom: `1px solid ${D.border}` }}>
                          <td style={{ padding: "16px 20px", fontWeight: 600, color: D.text }}>{d.nom}</td>
                          <td style={{ padding: "16px 20px", fontSize: 12, color: "#6366f1", fontFamily: "monospace" }}>{d.project_url}</td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: D.tag, color: D.tagText }}>{d.branche}</span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: D.tag, color: D.tagText }}>{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#10b981" }}>
                              <span style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%" }} />
                              analysé
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button className="action-btn"
                                onClick={() => ouvrirModalAnalyse(d)}
                                style={{ background: "transparent", border: `1px solid ${D.border}`, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#6366f1", fontWeight: 500 }}>
                                📊 Analyses
                              </button>
                              <button className="action-btn"
                                onClick={() => ouvrirModalRelancer(d)}
                                style={{ background: "transparent", border: `1px solid ${D.border}`, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#f59e0b", fontWeight: 500 }}>
                                ↻ Relancer
                              </button>
                              <button className="action-btn"
                                onClick={() => ouvrirEdit(d)}
                                style={{ background: "transparent", border: `1px solid ${D.border}`, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", color: D.muted, fontWeight: 500 }}>
                                ✏️ Modifier
                              </button>
                              <button className="action-btn"
                                onClick={() => setDeleteDepot(d)}
                                style={{ background: "transparent", border: `1px solid ${D.border}`, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#ef4444", fontWeight: 500 }}>
                                🗑 Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* VUE 2 — ANALYSES D'UN PROJET */}
          {vueAnalyse && !analyseDetail && (
            <>
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setVueAnalyse(false)} style={{ background: D.btnSec, border: `1px solid ${D.border}`, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>
                  ← Retour aux projets
                </button>
              </div>
              {loadingA ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={spinnerStyle} />
                  <div style={{ color: D.faint }}>Chargement des analyses...</div>
                </div>
              ) : analyses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🔍</div>
                  <div style={{ color: D.faint }}>Aucune analyse pour ce projet</div>
                  <button onClick={() => ouvrirModalRelancer(depotVu!)} style={{ marginTop: 16, background: D.btnPrimary, color: "white", border: "none", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Lancer une analyse
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20, marginTop: 20 }}>
                  {analyses.map(a => {
                    const vulnCount = a.vulnerabilites?.length || 0;
                    return (
                      <div key={a.id} onClick={() => setAnalyseDetail(a)} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 20, cursor: "pointer", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                          <span style={{ fontSize: 12, color: D.faint }}>{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>{a.statut === "termine" ? "Terminé" : "En cours"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                          {[
                            { label: "Qualité", val: a.score_qualite },
                            { label: "Sécurité", val: a.score_securite },
                            { label: "Performance", val: a.score_performance },
                          ].map(s => (
                            <div key={s.label} style={{ flex: 1, background: D.bg, borderRadius: 12, padding: 12, textAlign: "center" }}>
                              <div style={{ fontSize: 20, fontWeight: 700, color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                              <div style={{ fontSize: 10, color: D.faint, marginTop: 4 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: vulnCount === 0 ? "#10b981" : "#ef4444" }}>
                          {vulnCount === 0 ? "✓ Code propre" : `⚠ ${vulnCount} vulnérabilité(s)`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* VUE 3 — DÉTAIL D'UNE ANALYSE */}
          {analyseDetail && (
            <>
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setAnalyseDetail(null)} style={{ background: D.btnSec, border: `1px solid ${D.border}`, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>
                  ← Retour aux analyses
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                  { label: "Qualité", val: analyseDetail.score_qualite },
                  { label: "Sécurité", val: analyseDetail.score_securite },
                  { label: "Performance", val: analyseDetail.score_performance },
                ].map(s => (
                  <div key={s.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24, textAlign: "center" }}>
                    <div style={{ fontSize: 48, fontWeight: 700, color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                    <div style={{ fontSize: 12, color: D.faint, marginTop: 8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {analyseDetail.vulnerabilites?.length > 0 && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 600, color: D.text, margin: "24px 0 16px" }}>⚠️ Vulnérabilités ({analyseDetail.vulnerabilites.length})</div>
                  {analyseDetail.vulnerabilites.map((v: any, i: number) => (
                    <div key={i} style={{ background: D.bg, borderLeft: `3px solid ${colorSeverite(v.severite)}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${colorSeverite(v.severite)}15`, color: colorSeverite(v.severite), display: "inline-block", marginBottom: 8 }}>
                        {v.severite}
                      </span>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: D.text }}>{v.type}</div>
                      <div style={{ fontSize: 12, color: D.faint, fontFamily: "monospace", marginBottom: 8 }}>📄 {v.fichier} — ligne {v.ligne}</div>
                      <div style={{ fontSize: 13, background: D.card, padding: 10, borderRadius: 10, color: D.text }}>💡 {v.suggestion}</div>
                    </div>
                  ))}
                </>
              )}

              {analyseDetail.recommandations?.length > 0 && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 600, color: D.text, margin: "24px 0 16px" }}>💡 Recommandations ({analyseDetail.recommandations.length})</div>
                  {analyseDetail.recommandations.map((r: any, i: number) => (
                    <div key={i} style={{ background: D.bg, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, color: "#10b981", marginBottom: 6 }}>{r.titre}</div>
                      <div style={{ color: D.muted }}>{r.description}</div>
                    </div>
                  ))}
                </>
              )}

              {(!analyseDetail.vulnerabilites || analyseDetail.vulnerabilites.length === 0) && (
                <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(16,185,129,0.08)", borderRadius: 20 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                  <div style={{ color: "#10b981" }}>Aucune vulnérabilité détectée — Code propre !</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          MODAL — MODIFIER DÉPÔT
      ═══════════════════════════════════════ */}
      {editDepot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={() => setEditDepot(null)}>
          <div style={{ background: D.modalBg, borderRadius: 24, maxWidth: 500, width: "100%", padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: D.text, marginBottom: 4 }}>✏️ Modifier le dépôt</div>
            <div style={{ fontSize: 12, color: D.faint, marginBottom: 20, fontFamily: "monospace" }}>{editDepot.project_url}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nom du projet</label>
              <input style={{ width: "100%", padding: "11px 14px", border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, background: D.card, color: D.text, outline: "none" }} value={editNom} onChange={e => setEditNom(e.target.value)} placeholder="Nom du projet" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                URL du projet
                {urlChanged && <span style={{ marginLeft: 8, fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "1px 7px", borderRadius: 10, fontWeight: 600, textTransform: "none" }}>modifié</span>}
              </label>
              <input style={{ width: "100%", padding: "11px 14px", border: `1px solid ${urlChanged ? "#f59e0b" : D.border}`, borderRadius: 10, fontSize: 13, background: D.card, color: D.text, outline: "none" }} value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="namespace/projet" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Branche
                {brancheChanged && <span style={{ marginLeft: 8, fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "1px 7px", borderRadius: 10, fontWeight: 600, textTransform: "none" }}>modifié</span>}
              </label>
              <input style={{ width: "100%", padding: "11px 14px", border: `1px solid ${brancheChanged ? "#f59e0b" : D.border}`, borderRadius: 10, fontSize: 13, background: D.card, color: D.text, outline: "none" }} value={editBranche} onChange={e => setEditBranche(e.target.value)} placeholder="main" />
            </div>

            {isCritical && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>⚠️ Attention — modification importante</div>
                <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6, marginBottom: 10 }}>
                  {urlChanged && brancheChanged ? "L'URL et la branche ont changé." : urlChanged ? "L'URL du projet a changé." : "La branche a changé."}
                  {" "}Les analyses existantes de ce dépôt font référence à l'ancienne configuration.
                  Elles resteront accessibles mais ne correspondront plus à ce dépôt.
                  <strong> Il est recommandé de relancer une nouvelle analyse après cette modification.</strong>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                  <input type="checkbox" checked={editConfirmed} onChange={e => setEditConfirmed(e.target.checked)} style={{ width: 15, height: 15, accentColor: "#f59e0b", cursor: "pointer" }} />
                  Je comprends et je confirme la modification
                </label>
              </div>
            )}

            {editError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "9px 12px", fontSize: 12, color: "#ef4444", marginBottom: 14 }}>
                ⚠️ {editError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ flex: 1, padding: "10px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }} onClick={() => setEditDepot(null)}>Annuler</button>
              <button disabled={editLoading || (isCritical && !editConfirmed)} onClick={validerEdit} style={{ flex: 2, padding: "11px", background: (isCritical && !editConfirmed) ? "#94a3b8" : D.btnPrimary, border: "none", borderRadius: 11, color: "white", fontSize: 14, fontWeight: 600, cursor: (isCritical && !editConfirmed) ? "not-allowed" : "pointer", opacity: editLoading ? 0.7 : 1 }}>
                {editLoading ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: 8 }} /> Enregistrement...</> : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL — SUPPRIMER DÉPÔT
      ═══════════════════════════════════════ */}
      {deleteDepot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={() => setDeleteDepot(null)}>
          <div style={{ background: D.modalBg, borderRadius: 24, maxWidth: 440, width: "100%", padding: 28, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>🗑️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: D.text, marginBottom: 8 }}>Supprimer ce dépôt ?</div>
            <div style={{ fontSize: 13, color: D.muted, marginBottom: 6 }}>
              <strong style={{ color: D.text }}>{deleteDepot.nom}</strong>
            </div>
            <div style={{ fontSize: 12, color: D.faint, marginBottom: 6, fontFamily: "monospace" }}>{deleteDepot.project_url}</div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "11px 14px", margin: "14px 0 20px", fontSize: 12, color: "#b91c1c", lineHeight: 1.6 }}>
              ⚠️ Cette action est <strong>irréversible</strong>. Toutes les analyses, tests générés,
              issues et merge requests liés à ce dépôt seront également supprimés.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ flex: 1, padding: "11px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 11, fontSize: 14, fontWeight: 500, cursor: "pointer", color: D.muted }} onClick={() => setDeleteDepot(null)}>Annuler</button>
              <button disabled={deleteLoading} onClick={confirmerSupprimer} style={{ flex: 1, padding: "11px", background: "#ef4444", border: "none", borderRadius: 11, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: deleteLoading ? 0.7 : 1 }}>
                {deleteLoading ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: 8 }} /> Suppression...</> : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL — TOKEN (analyse / relancer)
      ═══════════════════════════════════════ */}
      {modalDepot && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={() => setModalDepot(null)}>
          <div style={{ background: D.modalBg, borderRadius: 24, maxWidth: 480, width: "100%", padding: 28, boxShadow: "0 20px 35px -12px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 700, color: D.text, marginBottom: 4 }}>
              {modalMode === "relancer" ? "Relancer l'analyse" : "Accéder aux analyses"}
            </div>
            <div style={{ fontSize: 13, color: D.faint, marginBottom: 20 }}>{modalDepot.nom} · {modalDepot.project_url}</div>

            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 6, display: "block" }}>Token GitLab</label>
            <input
              type="password"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={modalToken}
              onChange={e => setModalToken(e.target.value)}
              onKeyDown={e => e.key === "Enter" && validerToken()}
              style={{ width: "100%", padding: "12px 14px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, fontFamily: "monospace", background: D.card, color: D.text, outline: "none", marginBottom: 8 }}
              autoFocus
            />
            <div style={{ fontSize: 11, color: D.faint, marginBottom: 20 }}>GitLab → Settings → Access Tokens (scopes: api, read_repository)</div>

            {modalError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#ef4444", marginBottom: 20 }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setModalDepot(null)} style={{ flex: 1, padding: 10, background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer", color: D.muted }}>Annuler</button>
              <button onClick={validerToken} disabled={modalLoading} style={{ flex: 2, padding: 10, background: D.btnPrimary, border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: modalLoading ? 0.6 : 1 }}>
                {modalLoading ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: 8 }} /> Validation...</> : (modalMode === "relancer" ? "Lancer l'analyse" : "Valider")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 2000,
          background: toast.ok ? D.btnPrimary : "#ef4444",
          color: "white", borderRadius: 12, padding: "13px 20px",
          fontSize: 13, fontWeight: 500, boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: 8, animation: "fadeIn 0.2s ease",
        }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </>
  );
}