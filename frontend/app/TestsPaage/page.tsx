// frontend/app/tests/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface Test {
  id               : number;
  analyse_id       : number;
  depot_analyse_id : number;
  langage          : string;
  framework        : string;
  nom_fichier      : string;
  nb_tests         : number;
  nb_lots          : number;
  statut           : string;
  branche_cible    : string;
  created_at       : string;
  contenu         ?: string;
}

export default function TestsPage() {
  const router = useRouter();

  const [tests,        setTests]        = useState<Test[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterLang,   setFilterLang]   = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [testDetail,   setTestDetail]   = useState<Test | null>(null);
  const [loadingDetail,setLoadingDetail]= useState(false);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/tests/`, { headers: getHeaders() });
        setTests(res.data);
      } catch { setTests([]); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const voirContenu = async (test: Test) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/tests/${test.id}`, { headers: getHeaders() });
      setTestDetail(res.data);
    } catch { setTestDetail({ ...test, contenu: "Erreur de chargement" }); }
    finally { setLoadingDetail(false); }
  };

  const supprimerTest = async (id: number) => {
    if (!confirm("Supprimer ce test ?")) return;
    await axios.delete(`${API}/tests/${id}`, { headers: getHeaders() });
    setTests(prev => prev.filter(t => t.id !== id));
    if (testDetail?.id === id) setTestDetail(null);
  };

  const langages = ["tous", ...Array.from(new Set(tests.map(t => t.langage).filter(Boolean)))];

  const filtered = tests.filter(t => {
    const matchSearch = t.nom_fichier?.toLowerCase().includes(search.toLowerCase())
                     || t.langage?.toLowerCase().includes(search.toLowerCase())
                     || t.framework?.toLowerCase().includes(search.toLowerCase());
    const matchLang   = filterLang   === "tous" || t.langage   === filterLang;
    const matchStatut = filterStatut === "tous" || t.statut    === filterStatut;
    return matchSearch && matchLang && matchStatut;
  });

  const statutConfig = (s: string) => {
    if (s === "pousse")  return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0", icon: "✓", label: "Poussé" };
    if (s === "genere")  return { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe", icon: "○", label: "Généré" };
    return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca", icon: "✕", label: "Échoué" };
  };

  const langageConfig = (l: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      java:       { bg: "#fef3c7", text: "#b45309" },
      python:     { bg: "#dbeafe", text: "#1e40af" },
      typescript: { bg: "#cffafe", text: "#0e7490" },
      javascript: { bg: "#fef9c3", text: "#a16207" },
      php:        { bg: "#ede9fe", text: "#6b21a5" },
      go:         { bg: "#e0f2fe", text: "#0c4a6e" },
      csharp:     { bg: "#e0e7ff", text: "#3730a3" },
    };
    return colors[l] || { bg: "#f1f5f9", text: "#475569" };
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

        /* Topbar */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 20px;
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
        .stats-badge {
          background: #f1f5f9;
          border-radius: 30px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 24px 32px;
        }
        .stat-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 18px 20px;
          transition: all 0.2s;
        }
        .stat-card:hover {
          border-color: #e2e8f0;
          transform: translateY(-2px);
        }
        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-icon {
          font-size: 20px;
          margin-bottom: 8px;
        }

        /* Filters */
        .filters {
          display: flex;
          gap: 12px;
          padding: 16px 32px;
          background: white;
          border-top: 1px solid #eef2ff;
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
          transition: all 0.2s;
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
          padding: 16px 20px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: #fefefe;
          border-bottom: 1px solid #f1f5f9;
        }
        td {
          padding: 16px 20px;
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
        .table-row.selected {
          background: #eef2ff;
        }

        /* Badges */
        .lang-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
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
        .file-name {
          font-family: monospace;
          font-size: 13px;
          font-weight: 500;
          color: #6366f1;
        }
        .nb-tests {
          font-weight: 700;
          font-size: 16px;
          font-family: monospace;
          color: #0f172a;
        }
        .btn-voir {
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 11px;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .btn-voir:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .btn-del {
          background: transparent;
          border: 1px solid #fee2e2;
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
          color: #ef4444;
          transition: all 0.2s;
        }
        .btn-del:hover {
          background: #fef2f2;
          border-color: #fecaca;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
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

        /* Panel détail */
        .detail-panel {
          position: fixed;
          right: 0;
          top: 0;
          width: 520px;
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
          font-family: monospace;
          margin-bottom: 4px;
        }
        .panel-sub {
          font-size: 11px;
          color: #64748b;
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
        .panel-close:hover {
          background: #e2e8f0;
        }
        .panel-meta {
          padding: 16px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .meta-chip {
          background: #f1f5f9;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          color: #475569;
        }
        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .code-block {
          background: #f8fafc;
          border: 1px solid #eef2ff;
          border-radius: 12px;
          padding: 20px;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #1e293b;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-x: auto;
        }
        .code-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
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
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .detail-panel { width: 100%; }
        }
      `}</style>

      <div className="page">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <button className="back-btn" onClick={() => router.push("/dashboard")}>
              ← Tableau de bord
            </button>
            <div className="title-section">
              <h1>Tests unitaires générés</h1>
              <p>Générés automatiquement par l'IA pour tous vos projets</p>
            </div>
          </div>
          <div className="stats-badge">{tests.length} test(s) en base</div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🧪</div>
            <div className="stat-value">{tests.length}</div>
            <div className="stat-label">Total générés</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚀</div>
            <div className="stat-value" style={{ color: "#10b981" }}>{tests.filter(t => t.statut === "pousse").length}</div>
            <div className="stat-label">Poussés sur GitLab</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value" style={{ color: "#f59e0b" }}>{tests.reduce((a, t) => a + (t.nb_tests || 0), 0)}</div>
            <div className="stat-label">Tests unitaires</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🌐</div>
            <div className="stat-value" style={{ color: "#6366f1" }}>{Array.from(new Set(tests.map(t => t.langage).filter(Boolean))).length}</div>
            <div className="stat-label">Langages couverts</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="filters">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Rechercher par fichier, langage, framework..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="filter-select" value={filterLang} onChange={e => setFilterLang(e.target.value)}>
            {langages.map(l => (
              <option key={l} value={l}>{l === "tous" ? "Tous les langages" : l}</option>
            ))}
          </select>
          <select className="filter-select" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
            <option value="tous">Tous les statuts</option>
            <option value="pousse">Poussé</option>
            <option value="genere">Généré</option>
            <option value="echoue">Échoué</option>
          </select>
          <span className="result-count">{filtered.length} résultat(s)</span>
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              Chargement des tests...
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧪</div>
              <div>
                {tests.length === 0
                  ? "Aucun test généré — lance une analyse d'abord"
                  : "Aucun résultat pour cette recherche"}
              </div>
            </div>
          ) : (
             <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fichier de test</th>
                  <th>Langage</th>
                  <th>Framework</th>
                  <th>Nb tests</th>
                  <th>Branche</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const status = statutConfig(t.statut);
                  const lang = langageConfig(t.langage);
                  return (
                    <tr key={t.id} className={`table-row ${testDetail?.id === t.id ? "selected" : ""}`} onClick={() => voirContenu(t)}>
                      <td style={{ fontFamily: "monospace", color: "#64748b" }}>#{t.id}</td>
                      <td><span className="file-name">{t.nom_fichier || "—"}</span></td>
                      <td>
                        {t.langage && (
                          <span className="lang-badge" style={{ background: lang.bg, color: lang.text }}>
                            {t.langage}
                          </span>
                        )}
                      </td>
                      <td style={{ color: "#64748b", fontSize: 12 }}>{t.framework || "—"}</td>
                      <td><span className="nb-tests">{t.nb_tests || "—"}</span></td>
                      <td style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.branche_cible || "—"}
                      </td>
                      <td>
                        <span className="status-badge" style={{ background: status.bg, color: status.text }}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-voir" onClick={() => voirContenu(t)}>Voir</button>
                          <button className="btn-del" onClick={() => supprimerTest(t.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Overlay et Panel latéral */}
        <div className={`panel-overlay ${testDetail ? "open" : ""}`} onClick={() => setTestDetail(null)} />
        <div className={`detail-panel ${testDetail ? "open" : ""}`}>
          {testDetail && (
            <>
              <div className="panel-header">
                <div>
                  <div className="panel-title">{testDetail.nom_fichier}</div>
                  <div className="panel-sub">
                    {testDetail.langage} · {testDetail.framework} · {new Date(testDetail.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <button className="panel-close" onClick={() => setTestDetail(null)}>✕</button>
              </div>
              <div className="panel-meta">
                <span className="meta-chip">{testDetail.nb_tests} test{(testDetail.nb_tests ?? 0) > 1 ? "s" : ""}</span>
                <span className="meta-chip">{testDetail.nb_lots} lot(s) LLM</span>
                <span className="meta-chip">{testDetail.branche_cible || "branche inconnue"}</span>
                <span className="meta-chip" style={{ background: statutConfig(testDetail.statut).bg, color: statutConfig(testDetail.statut).text }}>
                  {statutConfig(testDetail.statut).icon} {statutConfig(testDetail.statut).label}
                </span>
              </div>
              <div className="panel-content">
                <div className="code-label">📄 Contenu du fichier de test</div>
                {loadingDetail ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div className="spinner" />
                  </div>
                ) : (
                  <pre className="code-block">
                    {testDetail.contenu || "Contenu non disponible"}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}