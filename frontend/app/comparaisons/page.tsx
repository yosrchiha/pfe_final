"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

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

  // Charger tous les dépôts
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

  // Charger les comparaisons d'un dépôt
  const fetchComparaisons = async (depot: Depot) => {
    setLoadingDetails(true);
    setSelectedDepot(depot);
    setSelectedComparaison(null);
    setSelectedAnalyse(null);
    try {
      // Récupérer les comparaisons du dépôt via l'endpoint /comparaisons/depot/{depot_id}
      const res = await axios.get(`${API}/comparaisons/depot/${depot.id}`, { headers: getHeaders() });
      const data = res.data;
      
      // Pour chaque comparaison, récupérer les analyses associées
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
        return { bg: "#f1f5f9", color: "#64748b", icon: "⏳", label: "En cours" };
    }
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
          display: flex;
        }

        /* Sidebar */
        .sidebar {
          width: 320px;
          background: white;
          border-right: 1px solid #eef2ff;
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
        }
        .sidebar-header {
          padding: 24px;
          border-bottom: 1px solid #f1f5f9;
        }
        .sidebar-header h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .sidebar-header p {
          font-size: 12px;
          color: #64748b;
        }
        .search-box {
          padding: 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .search-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
        }
        .search-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .depots-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .depot-item {
          padding: 14px 16px;
          margin: 4px 8px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .depot-item:hover {
          background: #f8fafc;
          border-color: #eef2ff;
        }
        .depot-item.active {
          background: #eef2ff;
          border-color: #c7d2fe;
        }
        .depot-nom {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .depot-url {
          font-size: 10px;
          color: #64748b;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .depot-date {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 6px;
        }

        /* Main content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
        }
        .back-btn {
          background: #f1f5f9;
          border: none;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .title-section h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .title-section p {
          font-size: 13px;
          color: #64748b;
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 20px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
        }
        .stat-card {
          background: #f8fafc;
          border-radius: 16px;
          padding: 16px;
          text-align: center;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 12px;
          color: #64748b;
        }

        /* Filters */
        .filters {
          display: flex;
          gap: 12px;
          padding: 16px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
          flex-wrap: wrap;
          align-items: center;
        }
        .filter-select {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }

        /* Table */
        .table-container {
          margin: 24px 32px;
          background: white;
          border-radius: 20px;
          border: 1px solid #eef2ff;
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
        .score-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .score-value {
          font-weight: 600;
          font-family: monospace;
        }
        .score-bar {
          width: 60px;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }
        .score-bar-fill {
          height: 4px;
          border-radius: 2px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 500;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px;
          color: #64748b;
        }
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal {
          background: white;
          border-radius: 24px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .modal-close {
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 18px;
        }
        .modal-content {
          padding: 24px;
        }
        .detail-section {
          margin-bottom: 20px;
        }
        .detail-label {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .detail-value {
          font-size: 14px;
          color: #1e293b;
        }
        .scores-row {
          display: flex;
          gap: 16px;
          margin: 16px 0;
        }
        .score-item {
          flex: 1;
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          text-align: center;
        }
        .score-item-value {
          font-size: 24px;
          font-weight: 700;
        }
        .mr-link {
          color: #6366f1;
          text-decoration: none;
          word-break: break-all;
        }
        .mr-link:hover {
          text-decoration: underline;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .sidebar { display: none; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="page">
        {/* Sidebar des dépôts */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>📁 Mes dépôts</h2>
            <p>Sélectionnez un dépôt pour voir ses comparaisons</p>
          </div>
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Rechercher un dépôt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="depots-list">
            {loading ? (
              <div className="loading-state"><div className="spinner" /> Chargement...</div>
            ) : filteredDepots.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div>Aucun dépôt trouvé</div>
                <button className="back-btn" style={{ marginTop: 16 }} onClick={() => router.push("/analyse")}>
                  + Lancer une analyse
                </button>
              </div>
            ) : (
              filteredDepots.map(depot => (
                <div
                  key={depot.id}
                  className={`depot-item ${selectedDepot?.id === depot.id ? "active" : ""}`}
                  onClick={() => handleDepotClick(depot)}
                >
                  <div className="depot-nom">{depot.nom}</div>
                  <div className="depot-url">{depot.project_url}</div>
                  <div className="depot-date">{new Date(depot.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="main-content">
          <div className="topbar">
            <div className="title-section">
              <h1>Historique des comparaisons</h1>
              <p>
                {selectedDepot 
                  ? `Comparaisons pour ${selectedDepot.nom}`
                  : "Sélectionnez un dépôt dans la barre latérale"}
              </p>
            </div>
            <button className="back-btn" onClick={() => router.push("/dashboard")}>
              ← Tableau de bord
            </button>
          </div>

          {selectedDepot && (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "#6366f1" }}>{comparaisons.length}</div>
                  <div className="stat-label">Comparaisons</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "#10b981" }}>
                    {comparaisons.filter(c => c.analyses?.some(a => a.score_qualite >= 75)).length}
                  </div>
                  <div className="stat-label">Score ≥ 75%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "#f59e0b" }}>
                    {comparaisons.filter(c => c.analyses?.some(a => a.score_qualite >= 50 && a.score_qualite < 75)).length}
                  </div>
                  <div className="stat-label">Score 50-74%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "#ef4444" }}>
                    {comparaisons.filter(c => c.analyses?.some(a => a.score_qualite < 50)).length}
                  </div>
                  <div className="stat-label">Score &lt; 50%</div>
                </div>
              </div>

              {/* Filtres */}
              <div className="filters">
                <select className="filter-select" value={filterResultat} onChange={e => setFilterResultat(e.target.value)}>
                  <option value="tous">Tous les résultats</option>
                  <option value="merge_autorise">✅ Merge autorisé</option>
                  <option value="merge_bloque">🚫 Merge bloqué</option>
                  <option value="aucun_changement">○ Aucun changement</option>
                </select>
              </div>

              {/* Table des comparaisons */}
              <div className="table-container">
                {loadingDetails ? (
                  <div className="loading-state"><div className="spinner" /> Chargement...</div>
                ) : comparaisons.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <div>Aucune comparaison trouvée pour ce dépôt</div>
                    <button className="back-btn" style={{ marginTop: 16 }} onClick={() => router.push("/add-repository")}>
                      + Comparer des branches
                    </button>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Branches</th>
                        <th>Commits</th>
                        <th>Qualité</th>
                        <th>Sécurité</th>
                        <th>Performance</th>
                        <th>Résultat</th>
                        <th>MR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparaisons.map(comp => {
                        // Prendre la dernière analyse de chaque comparaison
                        const latestAnalyse = comp.analyses?.[0];
                        if (!latestAnalyse) return null;
                        
                        const resultat = getResultatBadge(latestAnalyse.resultat_statut);
                        
                        return (
                          <tr 
                            key={comp.id} 
                            className="table-row" 
                            onClick={() => handleComparaisonClick(comp, latestAnalyse)}
                          >
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                              {new Date(comp.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              <span className="badge" style={{ background: "#eef2ff", color: "#6366f1" }}>
                                {comp.from_branch} → {comp.to_branch}
                              </span>
                            </td>
                            <td>{comp.commits_count} commit(s)</td>
                            <td>
                              <div className="score-cell">
                                <span className="score-value" style={{ color: colorScore(latestAnalyse.score_qualite) }}>
                                  {latestAnalyse.score_qualite || "—"}
                                </span>
                                <div className="score-bar">
                                  <div className="score-bar-fill" style={{ width: `${latestAnalyse.score_qualite || 0}%`, background: colorScore(latestAnalyse.score_qualite || 0) }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="score-cell">
                                <span className="score-value" style={{ color: colorScore(latestAnalyse.score_securite) }}>
                                  {latestAnalyse.score_securite || "—"}
                                </span>
                                <div className="score-bar">
                                  <div className="score-bar-fill" style={{ width: `${latestAnalyse.score_securite || 0}%`, background: colorScore(latestAnalyse.score_securite || 0) }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="score-cell">
                                <span className="score-value" style={{ color: colorScore(latestAnalyse.score_performance) }}>
                                  {latestAnalyse.score_performance || "—"}
                                </span>
                                <div className="score-bar">
                                  <div className="score-bar-fill" style={{ width: `${latestAnalyse.score_performance || 0}%`, background: colorScore(latestAnalyse.score_performance || 0) }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge" style={{ background: resultat.bg, color: resultat.color }}>
                                {resultat.icon} {resultat.label}
                              </span>
                            </td>
                            <td>
                              {latestAnalyse.mr_created ? (
                                <a 
                                  href={latestAnalyse.mr_url || "#"} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="mr-link"
                                  onClick={e => e.stopPropagation()}
                                >
                                  🔀 Voir MR
                                </a>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>
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
            <div className="empty-state" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div>
                <div className="empty-icon">📁</div>
                <div>Sélectionnez un dépôt dans la barre latérale</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Détail */}
      {showDetailModal && selectedComparaison && selectedAnalyse && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Détail de l'analyse</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="detail-section">
                <div className="detail-label">Date</div>
                <div className="detail-value">{new Date(selectedAnalyse.created_at).toLocaleString()}</div>
              </div>
              <div className="detail-section">
                <div className="detail-label">Branches comparées</div>
                <div className="detail-value">
                  <span className="badge" style={{ background: "#eef2ff", color: "#6366f1" }}>
                    {selectedComparaison.from_branch} → {selectedComparaison.to_branch}
                  </span>
                </div>
              </div>
              <div className="detail-section">
                <div className="detail-label">Commits</div>
                <div className="detail-value">{selectedComparaison.commits_count} commit(s)</div>
              </div>
              
              <div className="detail-label">Scores</div>
              <div className="scores-row">
                <div className="score-item">
                  <div className="score-item-value" style={{ color: colorScore(selectedAnalyse.score_qualite) }}>
                    {selectedAnalyse.score_qualite || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Qualité</div>
                </div>
                <div className="score-item">
                  <div className="score-item-value" style={{ color: colorScore(selectedAnalyse.score_securite) }}>
                    {selectedAnalyse.score_securite || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Sécurité</div>
                </div>
                <div className="score-item">
                  <div className="score-item-value" style={{ color: colorScore(selectedAnalyse.score_performance) }}>
                    {selectedAnalyse.score_performance || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Performance</div>
                </div>
              </div>

              {selectedAnalyse.vulnerabilites_count > 0 && (
                <div className="detail-section">
                  <div className="detail-label">Vulnérabilités détectées</div>
                  <div className="detail-value" style={{ color: "#ef4444" }}>
                    ⚠️ {selectedAnalyse.vulnerabilites_count} vulnérabilité(s)
                  </div>
                </div>
              )}

              {selectedAnalyse.mr_created && selectedAnalyse.mr_url && (
                <div className="detail-section">
                  <div className="detail-label">Merge Request associée</div>
                  <a href={selectedAnalyse.mr_url} target="_blank" rel="noreferrer" className="mr-link">
                    🔀 {selectedAnalyse.mr_title || "Voir la MR sur GitLab"} →
                  </a>
                </div>
              )}

              <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                <button
                  className="back-btn"
                  onClick={() => router.push(`/analyse/rapport?analyse_id=${selectedAnalyse.id}`)}
                  style={{ flex: 1 }}
                >
                  📄 Voir le rapport complet
                </button>
                <button className="back-btn" onClick={() => setShowDetailModal(false)}>
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