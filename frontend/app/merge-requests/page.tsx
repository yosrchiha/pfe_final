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

interface MergeRequest {
  id: number;
  analyse_id?: number;
  analyse_diff_id?: number;
  test_id?: number | null;
  depot_analyse_id?: number;
  depot_id?: number;
  mr_id_gitlab: number;
  mr_iid_gitlab?: number;
  mr_url: string;
  titre: string;
  title?: string;
  description: string | null;
  branche_source: string;
  source_branch?: string;
  branche_cible: string;
  target_branch?: string;
  statut: string;
  state?: string;
  type_mr: string;
  labels: string | null;
  created_at: string;
  updated_at?: string | null;
  projet_nom?: string;
  analyse_score_qualite?: number | null;
  analyse_score_securite?: number | null;
  analyse_score_performance?: number | null;
  analyse_resultat_statut?: string | null;
}

export default function MergeRequestsPage() {
  const router = useRouter();

  const [projets, setProjets] = useState<Projet[]>([]);
  const [projetSelectionne, setProjetSelectionne] = useState<Projet | null>(null);
  const [mrs, setMrs] = useState<MergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMrs, setLoadingMrs] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [selectedMr, setSelectedMr] = useState<MergeRequest | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    opened: 0,
    merged: 0,
    closed: 0,
    tests: 0,
    auto_merge: 0,
    diff: 0,
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
        if (!token) {
          router.push("/login");
          return;
        }
        const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
        const userId = me.data.id;
        const res = await axios.get(`${API}/analyses/depots-user/${userId}`, { headers: getHeaders() });
        setProjets(res.data);
        if (res.data.length > 0) {
          setProjetSelectionne(res.data[0]);
          fetchAllMergeRequests(res.data[0].id);
        }
      } catch (e: any) {
        console.error("Erreur chargement projets", e);
        if (e.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user_id");
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProjets();
  }, []);

  // Charger toutes les MR d'un projet (tests + diff)
  const fetchAllMergeRequests = async (projetId: number) => {
    setLoadingMrs(true);
    try {
      // Récupérer les MR de tests (ancien endpoint)
      let testsMrs: MergeRequest[] = [];
      try {
        const resTests = await axios.get(`${API}/merge-requests/depot/${projetId}`, { headers: getHeaders() });
        testsMrs = resTests.data;
      } catch (e) {
        console.log("Aucune MR de tests trouvée", e);
      }

      // Récupérer les MR de diff (nouvel endpoint)
      let diffMrs: MergeRequest[] = [];
      try {
        const resDiff = await axios.get(`${API}/merge-requests-diff/depot/${projetId}`, { headers: getHeaders() });
        diffMrs = resDiff.data;
      } catch (e) {
        console.log("Aucune MR de diff trouvée", e);
      }

      // Fusionner et normaliser les données
      const allMrs = [...testsMrs, ...diffMrs].map(mr => ({
        ...mr,
        // Normalisation des champs pour l'affichage
        titre: mr.titre || mr.title || "",
        branche_source: mr.branche_source || mr.source_branch || "",
        branche_cible: mr.branche_cible || mr.target_branch || "",
        statut: mr.statut || mr.state || "opened",
        mr_id_gitlab: mr.mr_id_gitlab || mr.mr_iid_gitlab || 0,
      }));

      // Trier par date (du plus récent au plus ancien)
      allMrs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setMrs(allMrs);

      setStats({
        total: allMrs.length,
        opened: allMrs.filter((m: MergeRequest) => m.statut === "opened").length,
        merged: allMrs.filter((m: MergeRequest) => m.statut === "merged").length,
        closed: allMrs.filter((m: MergeRequest) => m.statut === "closed").length,
        tests: allMrs.filter((m: MergeRequest) => m.type_mr === "tests").length,
        auto_merge: allMrs.filter((m: MergeRequest) => m.type_mr === "auto_merge" || m.type_mr === "auto").length,
        diff: allMrs.filter((m: MergeRequest) => m.type_mr === "diff" || m.type_mr === "force").length,
      });

    } catch (e) {
      console.error("Erreur chargement MR", e);
      setMrs([]);
    } finally {
      setLoadingMrs(false);
    }
  };

  const selectionnerProjet = (projet: Projet) => {
    setProjetSelectionne(projet);
    setSelectedMr(null);
    fetchAllMergeRequests(projet.id);
  };

  const syncStatus = async (id: number, isDiff: boolean = false) => {
    try {
      const endpoint = isDiff 
        ? `${API}/merge-requests-diff/${id}/sync`
        : `${API}/merge-requests/${id}/sync`;
      
      const res = await axios.put(endpoint, {}, { headers: getHeaders() });
      
      // Mettre à jour le statut localement
      setMrs(prev => prev.map(mr => 
        mr.id === id ? { ...mr, statut: res.data.statut } : mr
      ));
      
      // Rafraîchir la liste
      if (projetSelectionne) {
        fetchAllMergeRequests(projetSelectionne.id);
      }
    } catch (e) {
      alert("Erreur synchronisation");
    }
  };

  const filtered = mrs.filter(mr => {
    const matchSearch = mr.titre?.toLowerCase().includes(search.toLowerCase()) ||
      mr.branche_source?.toLowerCase().includes(search.toLowerCase()) ||
      mr.branche_cible?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "tous" || mr.type_mr === filterType;
    const matchStatut = filterStatut === "tous" || mr.statut === filterStatut;
    return matchSearch && matchType && matchStatut;
  });

  const statutConfig = (s: string) => {
    if (s === "merged") return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0", icon: "✓", label: "Fusionnée" };
    if (s === "opened") return { bg: "#fef3c7", text: "#b45309", border: "#fde68a", icon: "○", label: "Ouverte" };
    return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca", icon: "✕", label: "Fermée" };
  };

  const typeConfig = (t: string) => {
    if (t === "tests") {
      return { icon: "🧪", label: "Tests unitaires", color: "#6366f1", bg: "#eef2ff", desc: "Tests générés automatiquement par l'IA" };
    }
    if (t === "auto_merge" || t === "auto") {
      return { icon: "⚡", label: "Auto-merge IA", color: "#f59e0b", bg: "#fffbeb", desc: "Fusion automatique après analyse IA" };
    }
    if (t === "diff") {
      return { icon: "📊", label: "Analyse diff", color: "#10b981", bg: "#ecfdf5", desc: "Analyse des différences entre branches" };
    }
    if (t === "force") {
      return { icon: "⚠️", label: "MR forcée", color: "#ef4444", bg: "#fef2f2", desc: "MR créée malgré des vulnérabilités" };
    }
    return { icon: "📌", label: "Merge Request", color: "#64748b", bg: "#f1f5f9", desc: "Merge Request standard" };
  };

  const isDiffMR = (mr: MergeRequest) => {
    return mr.type_mr === "diff" || mr.type_mr === "force" || mr.analyse_diff_id !== undefined;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        .page { min-height: 100vh; background: #f8fafc; font-family: 'Inter', sans-serif; color: #1e293b; display: flex; }
        .projets-sidebar { width: 320px; background: white; border-right: 1px solid #eef2ff; display: flex; flex-direction: column; height: 100vh; position: sticky; top: 0; }
        .sidebar-header { padding: 24px; border-bottom: 1px solid #f1f5f9; }
        .sidebar-header h2 { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
        .sidebar-header p { font-size: 12px; color: #64748b; }
        .projets-list { flex: 1; overflow-y: auto; padding: 8px; }
        .projet-item { padding: 14px 16px; margin: 4px 8px; border-radius: 12px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
        .projet-item:hover { background: #f8fafc; border-color: #eef2ff; }
        .projet-item.active { background: #eef2ff; border-color: #c7d2fe; }
        .projet-nom { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
        .projet-url { font-size: 10px; color: #64748b; font-family: monospace; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .projet-meta { display: flex; gap: 6px; }
        .projet-badge { font-size: 10px; padding: 2px 8px; background: #f1f5f9; border-radius: 12px; color: #475569; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 20px 32px; background: white; border-bottom: 1px solid #eef2ff; }
        .back-btn { background: #f1f5f9; border: none; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; color: #475569; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .back-btn:hover { background: #e2e8f0; color: #0f172a; }
        .title-section h1 { font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin: 0 0 4px 0; }
        .title-section p { font-size: 13px; color: #64748b; margin: 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 12px; padding: 20px 32px; background: white; border-bottom: 1px solid #eef2ff; }
        .stat-card { background: #f8fafc; border-radius: 16px; padding: 12px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { font-size: 10px; color: #64748b; font-weight: 500; }
        .filters { display: flex; gap: 12px; padding: 16px 32px; background: white; border-bottom: 1px solid #eef2ff; flex-wrap: wrap; align-items: center; }
        .search-wrapper { position: relative; flex: 1; min-width: 260px; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px; }
        .search-input { width: 100%; padding: 10px 16px 10px 42px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; background: white; }
        .search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .filter-select { padding: 10px 16px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 13px; background: white; color: #475569; cursor: pointer; }
        .result-count { font-size: 13px; color: #64748b; background: #f1f5f9; padding: 5px 12px; border-radius: 20px; }
        .table-container { margin: 24px 32px; background: white; border-radius: 20px; border: 1px solid #eef2ff; overflow: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 14px 20px; font-size: 12px; font-weight: 600; color: #64748b; background: #fefefe; border-bottom: 1px solid #f1f5f9; }
        td { padding: 14px 20px; font-size: 13px; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
        .table-row { cursor: pointer; transition: background 0.15s; }
        .table-row:hover { background: #faf9fe; }
        .table-row.selected { background: #eef2ff; }
        .type-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 30px; font-size: 11px; font-weight: 500; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 30px; font-size: 11px; font-weight: 500; }
        .mr-link { color: #6366f1; text-decoration: none; font-weight: 500; }
        .mr-link:hover { text-decoration: underline; }
        .sync-btn { background: transparent; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 12px; font-size: 11px; cursor: pointer; color: #64748b; transition: all 0.2s; }
        .sync-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
        .empty-state { text-align: center; padding: 60px 20px; color: #94a3b8; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: #64748b; }
        .spinner { width: 20px; height: 20px; border: 2px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .detail-panel { position: fixed; right: 0; top: 0; width: 420px; height: 100vh; background: white; border-left: 1px solid #eef2ff; transform: translateX(100%); transition: transform 0.3s ease; z-index: 20; display: flex; flex-direction: column; box-shadow: -4px 0 20px rgba(0,0,0,0.05); }
        .detail-panel.open { transform: translateX(0); }
        .panel-header { padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
        .panel-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .panel-sub { font-size: 11px; color: #64748b; font-family: monospace; }
        .panel-close { background: #f1f5f9; border: none; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; font-size: 16px; color: #64748b; }
        .panel-close:hover { background: #e2e8f0; }
        .panel-content { flex: 1; overflow-y: auto; padding: 24px; }
        .info-group { margin-bottom: 20px; }
        .info-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .info-value { font-size: 13px; color: #1e293b; word-break: break-word; }
        .info-link { color: #6366f1; text-decoration: none; }
        .panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 15; display: none; }
        .panel-overlay.open { display: block; }
        @media (max-width: 900px) { .projets-sidebar { display: none; } .stats-grid { grid-template-columns: repeat(4, 1fr); } .detail-panel { width: 100%; } }
      `}</style>

      <div className="page">
        {/* Sidebar des projets */}
        <div className="projets-sidebar">
          <div className="sidebar-header">
            <h2>Mes projets</h2>
            <p>Sélectionnez un projet pour voir ses Merge Requests</p>
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
              <h1>Merge Requests</h1>
              <p>
                {projetSelectionne ? `Merge Requests pour ${projetSelectionne.nom}` : "Sélectionnez un projet à gauche"}
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
                <div className="stat-card"><div className="stat-value" style={{ color: "#f59e0b" }}>{stats.opened}</div><div className="stat-label">Ouvertes</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#10b981" }}>{stats.merged}</div><div className="stat-label">Fusionnés</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#ef4444" }}>{stats.closed}</div><div className="stat-label">Fermées</div></div>
                <div className="stat-card"><div className="stat-value">{stats.tests}</div><div className="stat-label">🧪 Tests</div></div>
                <div className="stat-card"><div className="stat-value">{stats.auto_merge}</div><div className="stat-label">⚡ Auto-merge</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: "#10b981" }}>{stats.diff}</div><div className="stat-label">📊 Diff analyse</div></div>
              </div>

              {/* Filtres */}
              <div className="filters">
                <div className="search-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    className="search-input"
                    placeholder="Rechercher par titre, branche..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="tous">Tous les types</option>
                  <option value="tests">🧪 Tests unitaires</option>
                  <option value="auto_merge">⚡ Auto-merge</option>
                  <option value="diff">📊 Diff analyse</option>
                  <option value="force">⚠️ MR forcée</option>
                </select>
                <select className="filter-select" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                  <option value="tous">Tous les statuts</option>
                  <option value="opened">🟡 Ouvertes</option>
                  <option value="merged">🟢 Fusionnées</option>
                  <option value="closed">🔴 Fermées</option>
                </select>
                <span className="result-count">{filtered.length} résultat(s)</span>
                <button className="sync-btn" onClick={() => fetchAllMergeRequests(projetSelectionne.id)}>↻ Rafraîchir</button>
              </div>

              {/* Table */}
              <div className="table-container">
                {loadingMrs ? (
                  <div className="loading-state"><div className="spinner" /> Chargement...</div>
                ) : filtered.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔀</div>
                    <div>Aucune Merge Request trouvée pour ce projet</div>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th><th>Titre</th><th>Source → Cible</th><th>Statut</th><th>Date</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(mr => {
                        const type = typeConfig(mr.type_mr);
                        const status = statutConfig(mr.statut);
                        const isDiff = isDiffMR(mr);
                        return (
                          <tr key={mr.id} className={`table-row ${selectedMr?.id === mr.id ? "selected" : ""}`} onClick={() => setSelectedMr(mr)}>
                            <td>
                              <span className="type-badge" style={{ background: type.bg, color: type.color }}>
                                {type.icon} {type.label}
                              </span>
                            </td>
                            <td>
                              <a href={mr.mr_url} target="_blank" rel="noreferrer" className="mr-link" onClick={e => e.stopPropagation()}>
                                {mr.titre?.slice(0, 60)}...
                              </a>
                            </td>
                            <td style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>
                              {mr.branche_source} → {mr.branche_cible}
                            </td>
                            <td>
                              <span className="status-badge" style={{ background: status.bg, color: status.text }}>
                                {status.icon} {status.label}
                              </span>
                            </td>
                            <td style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                              {new Date(mr.created_at).toLocaleDateString()}
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <button className="sync-btn" onClick={() => syncStatus(mr.id, isDiff)} title="Synchroniser avec GitLab">
                                ↻ Sync
                              </button>
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

          {!projetSelectionne && !loading && (
            <div className="empty-state" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div>
                <div className="empty-icon">📁</div>
                <div>Sélectionnez un projet dans la barre latérale</div>
              </div>
            </div>
          )}
        </div>

        {/* Overlay et Panel latéral */}
        <div className={`panel-overlay ${selectedMr ? "open" : ""}`} onClick={() => setSelectedMr(null)} />
        <div className={`detail-panel ${selectedMr ? "open" : ""}`}>
          {selectedMr && (
            <>
              <div className="panel-header">
                <div>
                  <div className="panel-title">{selectedMr.titre?.slice(0, 70)}</div>
                  <div className="panel-sub">MR #{selectedMr.mr_id_gitlab} · {new Date(selectedMr.created_at).toLocaleString()}</div>
                </div>
                <button className="panel-close" onClick={() => setSelectedMr(null)}>✕</button>
              </div>
              <div className="panel-content">
                <div className="info-group">
                  <div className="info-label">Lien GitLab</div>
                  <a href={selectedMr.mr_url} target="_blank" rel="noreferrer" className="info-link">
                    {selectedMr.mr_url}
                  </a>
                </div>
                <div className="info-group">
                  <div className="info-label">Branches</div>
                  <div className="info-value" style={{ fontFamily: "monospace" }}>{selectedMr.branche_source} → {selectedMr.branche_cible}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Type</div>
                  <div className="info-value">{typeConfig(selectedMr.type_mr).icon} {typeConfig(selectedMr.type_mr).label}</div>
                  <div className="info-value" style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{typeConfig(selectedMr.type_mr).desc}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Statut</div>
                  <span className="status-badge" style={{ background: statutConfig(selectedMr.statut).bg, color: statutConfig(selectedMr.statut).text }}>
                    {statutConfig(selectedMr.statut).icon} {statutConfig(selectedMr.statut).label}
                  </span>
                </div>
                <div className="info-group">
                  <div className="info-label">Labels</div>
                  <div className="info-value">{selectedMr.labels || "—"}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Analyse associée</div>
                  <div className="info-value">
                    ID #{selectedMr.analyse_id || selectedMr.analyse_diff_id}
                    {selectedMr.analyse_score_qualite && (
                      <span style={{ marginLeft: 12, fontSize: 11, color: "#10b981" }}>
                        Score: {selectedMr.analyse_score_qualite}/100
                      </span>
                    )}
                  </div>
                </div>
                {selectedMr.test_id && (
                  <div className="info-group">
                    <div className="info-label">Test associé</div>
                    <div className="info-value">ID #{selectedMr.test_id}</div>
                  </div>
                )}
                {selectedMr.description && (
                  <div className="info-group">
                    <div className="info-label">Description</div>
                    <div className="info-value" style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#475569" }}>
                      {selectedMr.description.slice(0, 400)}...
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}