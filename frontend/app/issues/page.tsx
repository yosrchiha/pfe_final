// frontend/app/issues/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

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

  // États
  const [projets, setProjets] = useState<Projet[]>([]);
  const [projetSelectionne, setProjetSelectionne] = useState<Projet | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSeverite, setFilterSeverite] = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
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

  // Charger les projets de l'utilisateur
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

  // Charger les issues d'un projet
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

  // Sélectionner un projet
  const selectionnerProjet = (projet: Projet) => {
    setProjetSelectionne(projet);
    setSelectedIssue(null);
    fetchIssues(projet.id);
  };

  // Synchroniser le statut d'une issue
  const syncStatus = async (id: number) => {
    try {
      const res = await axios.patch(`${API}/issues/${id}/sync`, {}, { headers: getHeaders() });
      setIssues(prev => prev.map(issue => 
        issue.id === id ? { ...issue, statut: res.data.statut } : issue
      ));
      // Mettre à jour les stats
      fetchIssues(projetSelectionne!.id);
    } catch (e) {
      alert("Erreur synchronisation");
    }
  };

  // Filtrage des issues
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
    switch(s) {
      case "CRITIQUE": return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", icon: "🔴", label: "Critique" };
      case "HAUTE":    return { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5", icon: "🟠", label: "Haute" };
      case "MOYENNE":  return { bg: "#fffbeb", text: "#b45309", border: "#fef3c7", icon: "🟡", label: "Moyenne" };
      default:         return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", icon: "🟢", label: "Faible" };
    }
  };

  const statutConfig = (s: string) => {
    if (s === "opened") return { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe", icon: "○", label: "Ouverte" };
    return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0", icon: "✓", label: "Fermée" };
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

        /* Sidebar projets */
        .projets-sidebar {
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
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .sidebar-header p {
          font-size: 12px;
          color: #64748b;
        }
        .projets-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .projet-item {
          padding: 14px 16px;
          margin: 4px 8px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .projet-item:hover {
          background: #f8fafc;
          border-color: #eef2ff;
        }
        .projet-item.active {
          background: #eef2ff;
          border-color: #c7d2fe;
        }
        .projet-nom {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .projet-url {
          font-size: 10px;
          color: #64748b;
          font-family: monospace;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .projet-meta {
          display: flex;
          gap: 6px;
        }
        .projet-badge {
          font-size: 10px;
          padding: 2px 8px;
          background: #f1f5f9;
          border-radius: 12px;
          color: #475569;
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
          display: flex;
          align-items: center;
          gap: 6px;
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
          margin: 0 0 4px 0;
        }
        .title-section p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        /* Stats grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 12px;
          padding: 20px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
        }
        .stat-card {
          background: #f8fafc;
          border-radius: 16px;
          padding: 12px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 10px;
          color: #64748b;
          font-weight: 500;
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
        .search-wrapper {
          position: relative;
          flex: 1;
          min-width: 260px;
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
        .filter-select {
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          background: white;
          color: #475569;
          cursor: pointer;
        }
        .result-count {
          font-size: 13px;
          color: #64748b;
          background: #f1f5f9;
          padding: 5px 12px;
          border-radius: 20px;
        }

        /* Cards grid */
        .cards-grid {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 20px;
        }
        .issue-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.2s;
          cursor: pointer;
          border-left: 4px solid;
        }
        .issue-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.05);
          border-color: #e2e8f0;
        }
        .issue-card.selected {
          border-color: #6366f1;
          background: #faf9fe;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .severity-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 500;
        }
        .card-title {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .card-location {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
          margin-bottom: 8px;
        }
        .card-description {
          font-size: 12px;
          color: #475569;
          background: #f8fafc;
          padding: 10px 12px;
          border-radius: 12px;
          margin: 12px 0;
          line-height: 1.5;
        }
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
        }
        .card-date {
          font-size: 10px;
          color: #94a3b8;
          font-family: monospace;
        }
        .sync-btn {
          background: transparent;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 11px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }
        .sync-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #94a3b8;
        }
        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.5;
        }

        /* Loading */
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

        /* Panel latéral détail */
        .detail-panel {
          position: fixed;
          right: 0;
          top: 0;
          width: 480px;
          height: 100vh;
          background: white;
          border-left: 1px solid #eef2ff;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          z-index: 20;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0,0,0,0.05);
        }
        .detail-panel.open {
          transform: translateX(0);
        }
        .panel-header {
          padding: 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .panel-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .panel-sub {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
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
        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .info-group {
          margin-bottom: 20px;
        }
        .info-label {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .info-value {
          font-size: 13px;
          color: #1e293b;
          word-break: break-word;
        }
        .info-link {
          color: #6366f1;
          text-decoration: none;
        }
        .code-block {
          background: #f8fafc;
          border: 1px solid #eef2ff;
          border-radius: 12px;
          padding: 14px;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
        }

        .panel-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.3);
          z-index: 15;
          display: none;
        }
        .panel-overlay.open {
          display: block;
        }

        @media (max-width: 900px) {
          .projets-sidebar { display: none; }
          .stats-grid { grid-template-columns: repeat(4, 1fr); }
          .cards-grid { grid-template-columns: 1fr; }
          .detail-panel { width: 100%; }
        }
      `}</style>

      <div className="page">
        {/* Sidebar des projets */}
        <div className="projets-sidebar">
          <div className="sidebar-header">
            <h2>Mes projets</h2>
            <p>Sélectionnez un projet pour voir ses issues</p>
          </div>
          <div className="projets-list">
            {loading ? (
              <div className="loading-state"><div className="spinner" /> Chargement...</div>
            ) : projets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <div>Aucun projet analysé</div>
                <button className="back-btn" style={{ marginTop: 16 }} onClick={() => router.push("/analyse")}>
                  Lancer une analyse
                </button>
              </div>
            ) : (
              projets.map(projet => (
                <div
                  key={projet.id}
                  className={`projet-item ${projetSelectionne?.id === projet.id ? "active" : ""}`}
                  onClick={() => selectionnerProjet(projet)}
                >
                  <div className="projet-nom">{projet.nom}</div>
                  <div className="projet-url">{projet.project_url}</div>
                  <div className="projet-meta">
                    <span className="projet-badge">{projet.branche}</span>
                    <span className="projet-badge">{new Date(projet.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="main-content">
          <div className="topbar">
            <div className="title-section">
              <h1>Issues GitLab</h1>
              <p>
                {projetSelectionne 
                  ? `Issues détectées pour ${projetSelectionne.nom}`
                  : "Sélectionnez un projet à gauche"}
              </p>
            </div>
            <button className="back-btn" onClick={() => router.push("/dashboard")}>
              ← Tableau de bord
            </button>
          </div>

          {projetSelectionne && (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-value" style={{ color: "#6366f1" }}>{stats.total}</div><div className="stat-label">Total</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#f59e0b" }}>{stats.ouvertes}</div><div className="stat-label">Ouvertes</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#10b981" }}>{stats.fermees}</div><div className="stat-label">Fermées</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#ef4444" }}>{stats.critiques}</div><div className="stat-label">Critiques</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#f97316" }}>{stats.hautes}</div><div className="stat-label">Hautes</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#eab308" }}>{stats.moyennes}</div><div className="stat-label">Moyennes</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#10b981" }}>{stats.faibles}</div><div className="stat-label">Faibles</div></div>
              </div>

              {/* Filtres */}
              <div className="filters">
                <div className="search-wrapper">
                  <span className="search-icon">🔍</span>
                  <input className="search-input" placeholder="Rechercher par titre, fichier..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="filter-select" value={filterSeverite} onChange={e => setFilterSeverite(e.target.value)}>
                  <option value="tous">Toutes sévérités</option>
                  <option value="CRITIQUE">🔴 Critique</option>
                  <option value="HAUTE">🟠 Haute</option>
                  <option value="MOYENNE">🟡 Moyenne</option>
                  <option value="FAIBLE">🟢 Faible</option>
                </select>
                <select className="filter-select" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                  <option value="tous">Tous statuts</option>
                  <option value="opened">○ Ouvertes</option>
                  <option value="closed">✓ Fermées</option>
                </select>
                <span className="result-count">{filtered.length} résultat(s)</span>
                <button className="sync-btn" onClick={() => fetchIssues(projetSelectionne.id)}>↻ Rafraîchir</button>
              </div>

              {/* Cards Grid */}
              <div className="cards-grid">
                {loadingIssues ? (
                  <div className="loading-state"><div className="spinner" /> Chargement des issues...</div>
                ) : filtered.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">◇</div>
                    <div>Aucune issue trouvée pour ce projet</div>
                  </div>
                ) : (
                  filtered.map(issue => {
                    const severity = severiteConfig(issue.severite);
                    const status = statutConfig(issue.statut);
                    return (
                      <div
                        key={issue.id}
                        className={`issue-card ${selectedIssue?.id === issue.id ? "selected" : ""}`}
                        onClick={() => setSelectedIssue(issue)}
                        style={{ borderLeftColor: severity.text }}
                      >
                        <div className="card-header">
                          <span className="severity-badge" style={{ background: severity.bg, color: severity.text }}>
                            {severity.icon} {severity.label}
                          </span>
                          <span className="status-badge" style={{ background: status.bg, color: status.text }}>
                            {status.icon} {status.label}
                          </span>
                        </div>
                        <div className="card-title">{issue.titre}</div>
                        <div className="card-location">📄 {issue.fichier} — ligne {issue.ligne}</div>
                        <div className="card-description">💡 {issue.description?.slice(0, 150)}...</div>
                        <div className="card-footer">
                          <span className="card-date">{new Date(issue.created_at).toLocaleDateString()}</span>
                          <button className="sync-btn" onClick={(e) => { e.stopPropagation(); syncStatus(issue.id); }}>↻ Sync</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {!projetSelectionne && !loading && (
            <div className="empty-state" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div>
                <div className="empty-icon">📁</div>
                <div>Sélectionnez un projet dans la barre latérale</div>
              </div>
            </div>
          )}
        </div>

        {/* Panel latéral détail */}
        <div className={`panel-overlay ${selectedIssue ? "open" : ""}`} onClick={() => setSelectedIssue(null)} />
        <div className={`detail-panel ${selectedIssue ? "open" : ""}`}>
          {selectedIssue && (
            <>
              <div className="panel-header">
                <div>
                  <div className="panel-title">{selectedIssue.titre}</div>
                  <div className="panel-sub">Issue #{selectedIssue.id} · {new Date(selectedIssue.created_at).toLocaleString()}</div>
                </div>
                <button className="panel-close" onClick={() => setSelectedIssue(null)}>✕</button>
              </div>
              <div className="panel-content">
                <div className="info-group">
                  <div className="info-label">Lien GitLab</div>
                  <a href={selectedIssue.issue_url} target="_blank" rel="noreferrer" className="info-link">{selectedIssue.issue_url}</a>
                </div>
                <div className="info-group">
                  <div className="info-label">Sévérité</div>
                  <span className="severity-badge" style={{ background: severiteConfig(selectedIssue.severite).bg, color: severiteConfig(selectedIssue.severite).text }}>
                    {severiteConfig(selectedIssue.severite).icon} {severiteConfig(selectedIssue.severite).label}
                  </span>
                </div>
                <div className="info-group">
                  <div className="info-label">Type</div>
                  <div className="info-value">{selectedIssue.type_vuln}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Localisation</div>
                  <div className="info-value" style={{ fontFamily: "monospace" }}>📄 {selectedIssue.fichier} — ligne {selectedIssue.ligne}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Description complète</div>
                  <div className="code-block">{selectedIssue.description}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Statut</div>
                  <span className="status-badge" style={{ background: statutConfig(selectedIssue.statut).bg, color: statutConfig(selectedIssue.statut).text }}>
                    {statutConfig(selectedIssue.statut).icon} {statutConfig(selectedIssue.statut).label}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}