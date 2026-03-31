// frontend/app/depots/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

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

  // États
  const [depots,  setDepots]  = useState<DepotAnalyse[]>([]);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalDepot,   setModalDepot]   = useState<DepotAnalyse | null>(null);
  const [modalToken,   setModalToken]   = useState("");
  const [modalError,   setModalError]   = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMode,    setModalMode]    = useState<"analyse" | "relancer">("analyse");

  // Vue analyses
  const [vueAnalyse,    setVueAnalyse]    = useState(false);
  const [analyses,      setAnalyses]      = useState<Analyse[]>([]);
  const [depotVu,       setDepotVu]       = useState<DepotAnalyse | null>(null);
  const [analyseDetail, setAnalyseDetail] = useState<Analyse | null>(null);
  const [loadingA,      setLoadingA]      = useState(false);

  // ── Chargement initial ─────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const me = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
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

  const handleDelete = (id: number) => {
    if (!confirm("Supprimer ce projet de la liste ?")) return;
    setDepots(prev => prev.filter(d => d.id !== id));
  };

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
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
        }

        /* Container principal */
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 40px;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .title-section h1 {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0 0 4px 0;
        }
        .title-section p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }
        .btn-primary {
          background: #0f172a;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }
        .btn-secondary {
          background: white;
          border: 1px solid #e2e8f0;
          color: #475569;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        /* Stats cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px 24px;
          transition: all 0.2s;
        }
        .stat-card:hover {
          border-color: #e2e8f0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        /* Search bar */
        .search-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .search-wrapper {
          position: relative;
          flex: 1;
          max-width: 360px;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 16px;
        }
        .search-input {
          width: 100%;
          padding: 10px 16px 10px 42px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          background: white;
          transition: all 0.2s;
        }
        .search-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .result-count {
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
          padding: 16px 20px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: #fefefe;
          border-bottom: 1px solid #f1f5f9;
        }
        td {
          padding: 16px 20px;
          font-size: 14px;
          border-bottom: 1px solid #f8fafc;
          vertical-align: middle;
        }
        tr:hover td {
          background: #fef9f5;
        }
        .project-name {
          font-weight: 600;
          color: #0f172a;
        }
        .project-url {
          font-size: 12px;
          color: #6366f1;
          font-family: monospace;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }
        .badge-branch {
          background: #eef2ff;
          color: #4338ca;
        }
        .badge-date {
          background: #f1f5f9;
          color: #475569;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #10b981;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn-icon {
          background: transparent;
          border: 1px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }
        .btn-view {
          color: #6366f1;
          border-color: #e0e7ff;
        }
        .btn-view:hover {
          background: #eef2ff;
          border-color: #c7d2fe;
        }
        .btn-reload {
          color: #f59e0b;
          border-color: #fed7aa;
        }
        .btn-reload:hover {
          background: #fffbeb;
        }
        .btn-delete {
          color: #ef4444;
          border-color: #fee2e2;
        }
        .btn-delete:hover {
          background: #fef2f2;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        .empty-text {
          color: #64748b;
          font-size: 14px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal {
          background: white;
          border-radius: 24px;
          max-width: 480px;
          width: 100%;
          padding: 28px;
          box-shadow: 0 20px 35px -12px rgba(0,0,0,0.2);
        }
        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .modal-sub {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 20px;
        }
        .modal-label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 6px;
          display: block;
        }
        .modal-input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          font-family: monospace;
          margin-bottom: 8px;
        }
        .modal-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .modal-hint {
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 20px;
        }
        .modal-error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          color: #ef4444;
          margin-bottom: 20px;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
        }
        .modal-cancel {
          flex: 1;
          padding: 10px;
          background: #f1f5f9;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .modal-confirm {
          flex: 2;
          padding: 10px;
          background: #0f172a;
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .modal-confirm:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        /* Loading */
        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Analyses grid */
        .analyses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .analyse-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .analyse-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.05);
        }
        .analyse-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .analyse-date {
          font-size: 12px;
          color: #64748b;
        }
        .analyse-status {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          background: #ecfdf5;
          color: #10b981;
        }
        .scores-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .score-mini {
          flex: 1;
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          text-align: center;
        }
        .score-mini-value {
          font-size: 20px;
          font-weight: 700;
        }
        .score-mini-label {
          font-size: 10px;
          color: #64748b;
          margin-top: 4px;
        }
        .vuln-chip {
          font-size: 12px;
          font-weight: 500;
        }
        .vuln-chip.clean { color: #10b981; }
        .vuln-chip.warning { color: #ef4444; }

        /* Detail view */
        .detail-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }
        .detail-scores {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        .detail-score-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 24px;
          text-align: center;
        }
        .detail-score-value {
          font-size: 48px;
          font-weight: 700;
        }
        .detail-score-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 8px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 24px 0 16px;
        }
        .vuln-card {
          background: #fef9f5;
          border-left: 3px solid;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .vuln-severity {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          display: inline-block;
          margin-bottom: 8px;
        }
        .vuln-title {
          font-weight: 600;
          margin-bottom: 6px;
        }
        .vuln-location {
          font-size: 12px;
          color: #64748b;
          font-family: monospace;
          margin-bottom: 8px;
        }
        .vuln-suggestion {
          font-size: 13px;
          background: white;
          padding: 10px;
          border-radius: 10px;
          margin-top: 8px;
        }
        .reco-card {
          background: #f0fdf4;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .reco-title {
          font-weight: 600;
          color: #10b981;
          margin-bottom: 6px;
        }
      `}</style>

      <div className="page">
        <div className="container">

          {/* HEADER */}
          <div className="header">
            <div className="title-section">
              <h1>
                {analyseDetail
                  ? "Détail de l'analyse"
                  : vueAnalyse
                  ? `Analyses • ${depotVu?.nom}`
                  : "Mes projets"}
              </h1>
              <p>
                {analyseDetail
                  ? `Analyse du ${new Date(analyseDetail.created_at).toLocaleDateString("fr-FR")}`
                  : vueAnalyse
                  ? `${analyses.length} analyse(s) réalisée(s)`
                  : "Projets analysés par l'intelligence artificielle"}
              </p>
            </div>
            {!vueAnalyse && !analyseDetail && (
              <button className="btn-primary" onClick={() => router.push("/analyse")}>
                + Nouvelle analyse
              </button>
            )}
          </div>

          {/* STATS (uniquement en vue liste) */}
          {!vueAnalyse && !analyseDetail && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{depots.length}</div>
                <div className="stat-label">Projets analysés</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{[...new Set(depots.map(d => d.branche))].length}</div>
                <div className="stat-label">Branches</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">✓</div>
                <div className="stat-label">Analysé par IA</div>
              </div>
            </div>
          )}

          {/* SEARCH (uniquement en vue liste) */}
          {!vueAnalyse && !analyseDetail && (
            <div className="search-section">
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Rechercher un projet..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="result-count">
                {filtered.length} projet{filtered.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {/* VUE 1 — LISTE DES PROJETS */}
          {!vueAnalyse && !analyseDetail && (
            <>
              {loading ? (
                <div className="empty-state">
                  <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                  <div className="empty-text" style={{ marginTop: 12 }}>Chargement...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <div className="empty-text">
                    {depots.length === 0
                      ? "Aucun projet analysé — lance ta première analyse !"
                      : "Aucun résultat pour cette recherche"}
                  </div>
                  {depots.length === 0 && (
                    <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.push("/analyse")}>
                      + Lancer une analyse
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>URL</th>
                        <th>Branche</th>
                        <th>Date</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => (
                        <tr key={d.id}>
                          <td className="project-name">{d.nom}</td>
                          <td className="project-url">{d.project_url}</td>
                          <td><span className="badge badge-branch">{d.branche}</span></td>
                          <td><span className="badge badge-date">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span></td>
                          <td>
                            <span className="status-badge">
                              <span className="status-dot" />
                              analysé
                            </span>
                          </td>
                          <td>
                            <div className="actions">
                              <button className="btn-icon btn-view" onClick={() => ouvrirModalAnalyse(d)}>
                                Voir analyses
                              </button>
                              <button className="btn-icon btn-reload" onClick={() => ouvrirModalRelancer(d)}>
                                Relancer
                              </button>
                              <button className="btn-icon btn-delete" onClick={() => handleDelete(d.id)}>
                                Supprimer
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
              <div className="search-section">
                <button className="btn-secondary" onClick={() => setVueAnalyse(false)}>
                  ← Retour aux projets
                </button>
              </div>
              {loadingA ? (
                <div className="empty-state">
                  <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                  <div className="empty-text" style={{ marginTop: 12 }}>Chargement des analyses...</div>
                </div>
              ) : analyses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-text">Aucune analyse pour ce projet</div>
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => ouvrirModalRelancer(depotVu!)}>
                    Lancer une analyse
                  </button>
                </div>
              ) : (
                <div className="analyses-grid">
                  {analyses.map(a => {
                    const vulnCount = a.vulnerabilites?.length || 0;
                    return (
                      <div key={a.id} className="analyse-card" onClick={() => setAnalyseDetail(a)}>
                        <div className="analyse-header">
                          <span className="analyse-date">{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                          <span className="analyse-status">{a.statut === "termine" ? "Terminé" : "En cours"}</span>
                        </div>
                        <div className="scores-row">
                          {[
                            { label: "Qualité", val: a.score_qualite },
                            { label: "Sécurité", val: a.score_securite },
                            { label: "Performance", val: a.score_performance },
                          ].map(s => (
                            <div key={s.label} className="score-mini">
                              <div className="score-mini-value" style={{ color: colorScore(s.val) }}>
                                {s.val ?? "—"}
                              </div>
                              <div className="score-mini-label">{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className={`vuln-chip ${vulnCount === 0 ? "clean" : "warning"}`}>
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
              <div className="detail-header">
                <button className="btn-secondary" onClick={() => setAnalyseDetail(null)}>
                  ← Retour aux analyses
                </button>
              </div>

              <div className="detail-scores">
                {[
                  { label: "Qualité", val: analyseDetail.score_qualite },
                  { label: "Sécurité", val: analyseDetail.score_securite },
                  { label: "Performance", val: analyseDetail.score_performance },
                ].map(s => (
                  <div key={s.label} className="detail-score-card">
                    <div className="detail-score-value" style={{ color: colorScore(s.val) }}>
                      {s.val ?? "—"}
                    </div>
                    <div className="detail-score-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {analyseDetail.vulnerabilites?.length > 0 && (
                <>
                  <div className="section-title">⚠️ Vulnérabilités ({analyseDetail.vulnerabilites.length})</div>
                  {analyseDetail.vulnerabilites.map((v: any, i: number) => (
                    <div key={i} className="vuln-card" style={{ borderLeftColor: colorSeverite(v.severite) }}>
                      <span className="vuln-severity" style={{ background: `${colorSeverite(v.severite)}15`, color: colorSeverite(v.severite) }}>
                        {v.severite}
                      </span>
                      <div className="vuln-title">{v.type}</div>
                      <div className="vuln-location">📄 {v.fichier} — ligne {v.ligne}</div>
                      <div className="vuln-suggestion">💡 {v.suggestion}</div>
                    </div>
                  ))}
                </>
              )}

              {analyseDetail.recommandations?.length > 0 && (
                <>
                  <div className="section-title">💡 Recommandations ({analyseDetail.recommandations.length})</div>
                  {analyseDetail.recommandations.map((r: any, i: number) => (
                    <div key={i} className="reco-card">
                      <div className="reco-title">{r.titre}</div>
                      <div className="reco-desc">{r.description}</div>
                    </div>
                  ))}
                </>
              )}

              {(!analyseDetail.vulnerabilites || analyseDetail.vulnerabilites.length === 0) && (
                <div className="empty-state" style={{ background: "#f0fdf4", borderRadius: 20 }}>
                  <div className="empty-icon">✅</div>
                  <div className="empty-text">Aucune vulnérabilité détectée — Code propre !</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalDepot && (
        <div className="modal-overlay" onClick={() => setModalDepot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {modalMode === "relancer" ? "Relancer l'analyse" : "Accéder aux analyses"}
            </div>
            <div className="modal-sub">{modalDepot.nom} · {modalDepot.project_url}</div>

            <label className="modal-label">Token GitLab</label>
            <input
              className="modal-input"
              type="password"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={modalToken}
              onChange={e => setModalToken(e.target.value)}
              onKeyDown={e => e.key === "Enter" && validerToken()}
              autoFocus
            />
            <div className="modal-hint">
              GitLab → Settings → Access Tokens (scopes: api, read_repository)
            </div>

            {modalError && <div className="modal-error">⚠️ {modalError}</div>}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setModalDepot(null)}>Annuler</button>
              <button className="modal-confirm" onClick={validerToken} disabled={modalLoading}>
                {modalLoading ? <><span className="loading-spinner" /> Validation...</> : (modalMode === "relancer" ? "Lancer l'analyse" : "Valider")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}