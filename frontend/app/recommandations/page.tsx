// frontend/app/recommandations/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://localhost:8001";

interface Recommandation {
  id: number;
  analyse_id: number;
  titre: string;
  description: string;
  priorite: string;
  categorie: string;
  appliquee: boolean;
  appliquee_le: string | null;
  fichier: string | null;
  ligne: number | null;
  created_at: string;
}

export default function RecommandationsPage() {
  const router = useRouter();
  const [recos, setRecos] = useState<Recommandation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriorite, setFilterPriorite] = useState("tous");
  const [filterCategorie, setFilterCategorie] = useState("tous");
  const [filterAppliquee, setFilterAppliquee] = useState("tous");
  const [search, setSearch] = useState("");

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    fetchRecommandations();
  }, []);

  const fetchRecommandations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/recommandations/`, { headers: getHeaders() });
      setRecos(res.data);
    } catch (e) {
      console.error("Erreur chargement recommandations", e);
    } finally {
      setLoading(false);
    }
  };

  const appliquerReco = async (id: number) => {
    try {
      const res = await axios.patch(`${API}/recommandations/${id}/apply`, {}, { headers: getHeaders() });
      setRecos(prev => prev.map(r => 
        r.id === id ? { ...r, appliquee: true, appliquee_le: res.data.appliquee_le } : r
      ));
    } catch (e) {
      alert("Erreur lors de l'application");
    }
  };

  const filtered = recos.filter(r => {
    const matchSearch = r.titre.toLowerCase().includes(search.toLowerCase()) ||
                        r.description.toLowerCase().includes(search.toLowerCase());
    const matchPriorite = filterPriorite === "tous" || r.priorite === filterPriorite;
    const matchCategorie = filterCategorie === "tous" || r.categorie === filterCategorie;
    const matchAppliquee = filterAppliquee === "tous" || 
                          (filterAppliquee === "appliquees" && r.appliquee) ||
                          (filterAppliquee === "non_appliquees" && !r.appliquee);
    return matchSearch && matchPriorite && matchCategorie && matchAppliquee;
  });

  const stats = {
    total: recos.length,
    appliquees: recos.filter(r => r.appliquee).length,
    non_appliquees: recos.filter(r => !r.appliquee).length,
    critiques: recos.filter(r => r.priorite === "CRITIQUE").length,
    hautes: recos.filter(r => r.priorite === "HAUTE").length,
  };

  const prioriteColor = (p: string) => {
    if (p === "CRITIQUE") return { bg: "#fef2f2", text: "#ef4444", border: "#fee2e2" };
    if (p === "HAUTE") return { bg: "#fff7ed", text: "#f97316", border: "#ffedd5" };
    if (p === "MOYENNE") return { bg: "#fffbeb", text: "#eab308", border: "#fef3c7" };
    return { bg: "#ecfdf5", text: "#10b981", border: "#bbf7d0" };
  };

  const categorieIcon = (c: string) => {
    const icons: Record<string, string> = {
      qualite: "📊",
      securite: "🔒",
      performance: "⚡",
      documentation: "📝",
      bonnes_pratiques: "✨"
    };
    return icons[c] || "💡";
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
          cursor: pointer;
          color: #475569;
        }
        .back-btn:hover {
          background: #e2e8f0;
        }
        .title-section h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .title-section p {
          font-size: 13px;
          color: #64748b;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          padding: 24px 32px;
        }
        .stat-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 16px;
          padding: 16px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
        }
        .stat-label {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }

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
        }
        .search-input {
          width: 100%;
          padding: 10px 16px 10px 42px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
        }
        .search-input:focus {
          outline: none;
          border-color: #6366f1;
        }
        .filter-select {
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }
        .result-count {
          font-size: 13px;
          color: #64748b;
          background: #f1f5f9;
          padding: 5px 12px;
          border-radius: 20px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
          padding: 24px 32px;
        }
        .reco-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.2s;
        }
        .reco-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.05);
        }
        .reco-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .priorite-badge {
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
        }
        .categorie-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          background: #f1f5f9;
          color: #475569;
        }
        .reco-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .reco-description {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .reco-meta {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
          margin-bottom: 16px;
          display: flex;
          gap: 12px;
        }
        .reco-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        .btn-apply {
          padding: 8px 20px;
          background: #6366f1;
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-apply:hover {
          background: #4f46e5;
        }
        .btn-applied {
          padding: 8px 20px;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          color: #10b981;
          font-size: 12px;
          font-weight: 500;
          cursor: default;
        }
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #94a3b8;
        }
        .loading-state {
          text-align: center;
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
          display: inline-block;
          margin-right: 8px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="page">
        <div className="topbar">
          <div className="title-section">
            <h1>💡 Recommandations IA</h1>
            <p>Suggestions d'amélioration générées par l'intelligence artificielle</p>
          </div>
          <button className="back-btn" onClick={() => router.push("/dashboard")}>← Tableau de bord</button>
        </div>

        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value" style={{ color: "#6366f1" }}>{stats.total}</div><div className="stat-label">Total</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: "#10b981" }}>{stats.appliquees}</div><div className="stat-label">Appliquées</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: "#f59e0b" }}>{stats.non_appliquees}</div><div className="stat-label">À appliquer</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: "#ef4444" }}>{stats.critiques}</div><div className="stat-label">Critiques</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: "#f97316" }}>{stats.hautes}</div><div className="stat-label">Hautes</div></div>
        </div>

        <div className="filters">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)}>
            <option value="tous">Toutes priorités</option>
            <option value="CRITIQUE">🔴 Critique</option>
            <option value="HAUTE">🟠 Haute</option>
            <option value="MOYENNE">🟡 Moyenne</option>
            <option value="FAIBLE">🟢 Faible</option>
          </select>
          <select className="filter-select" value={filterCategorie} onChange={e => setFilterCategorie(e.target.value)}>
            <option value="tous">Toutes catégories</option>
            <option value="qualite">📊 Qualité</option>
            <option value="securite">🔒 Sécurité</option>
            <option value="performance">⚡ Performance</option>
            <option value="documentation">📝 Documentation</option>
            <option value="bonnes_pratiques">✨ Bonnes pratiques</option>
          </select>
          <select className="filter-select" value={filterAppliquee} onChange={e => setFilterAppliquee(e.target.value)}>
            <option value="tous">Tous statuts</option>
            <option value="non_appliquees">À appliquer</option>
            <option value="appliquees">Appliquées</option>
          </select>
          <span className="result-count">{filtered.length} résultat(s)</span>
        </div>

        <div className="cards-grid">
          {loading ? (
            <div className="loading-state"><div className="spinner" /> Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
              <div>Aucune recommandation trouvée</div>
            </div>
          ) : (
            filtered.map(reco => {
              const p = prioriteColor(reco.priorite);
              return (
                <div key={reco.id} className="reco-card">
                  <div className="reco-header">
                    <span className="priorite-badge" style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}` }}>
                      {reco.priorite}
                    </span>
                    <span className="categorie-badge">
                      {categorieIcon(reco.categorie)} {reco.categorie}
                    </span>
                  </div>
                  <div className="reco-title">{reco.titre}</div>
                  <div className="reco-description">{reco.description}</div>
                  <div className="reco-meta">
                    {reco.fichier && <span>📄 {reco.fichier}{reco.ligne ? `:${reco.ligne}` : ''}</span>}
                    <span>📅 {new Date(reco.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="reco-actions">
                    {reco.appliquee ? (
                      <span className="btn-applied">✓ Appliquée le {new Date(reco.appliquee_le!).toLocaleDateString()}</span>
                    ) : (
                      <button className="btn-apply" onClick={() => appliquerReco(reco.id)}>
                        ✓ Marquer comme appliquée
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
