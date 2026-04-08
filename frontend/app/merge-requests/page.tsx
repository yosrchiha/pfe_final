"use client";

import { useEffect, useState } from "react";
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
  depot_nom?: string;
}

export default function MergeRequestsPage() {
  const router = useRouter();

  const [projets, setProjets] = useState<Projet[]>([]);
  const [projetFiltre, setProjetFiltre] = useState<number | "all">("all");
  const [mrs, setMrs] = useState<MergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [selectedMr, setSelectedMr] = useState<MergeRequest | null>(null);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  // Charger tous les projets de l'utilisateur
  const fetchProjets = async () => {
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
    } catch (e: any) {
      if (e.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    }
  };

  // Charger TOUTES les MR de TOUS les dépôts
  const fetchAllMergeRequests = async () => {
    setLoading(true);
    try {
      let allMrs: MergeRequest[] = [];

      // 1. Récupérer tous les dépôts
      const token = localStorage.getItem("token");
      const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
      const userId = me.data.id;
      const depotsRes = await axios.get(`${API}/analyses/depots-user/${userId}`, { headers: getHeaders() });
      const depots = depotsRes.data;

      // 2. Pour chaque dépôt, récupérer ses MR
      for (const depot of depots) {
        // MR de tests
        try {
          const resTests = await axios.get(`${API}/merge-requests/depot/${depot.id}`, { headers: getHeaders() });
          const testsMrs = resTests.data.map((mr: any) => ({
            ...mr,
            depot_nom: depot.nom,
            depot_id: depot.id,
            titre: mr.titre || "",
            branche_source: mr.branche_source || "",
            branche_cible: mr.branche_cible || "",
            statut: mr.statut || "opened",
          }));
          allMrs = [...allMrs, ...testsMrs];
        } catch (e) {
          console.log(`Aucune MR de tests pour ${depot.nom}`);
        }

        // MR de diff
        try {
          const resDiff = await axios.get(`${API}/merge-requests-diff/depot/${depot.id}`, { headers: getHeaders() });
          const diffMrs = resDiff.data.map((mr: any) => ({
            ...mr,
            depot_nom: depot.nom,
            depot_id: depot.id,
            titre: mr.title || "",
            branche_source: mr.source_branch || "",
            branche_cible: mr.target_branch || "",
            statut: mr.state || "opened",
            type_mr: mr.type_mr === "auto" ? "auto_merge" : mr.type_mr,
          }));
          allMrs = [...allMrs, ...diffMrs];
        } catch (e) {
          console.log(`Aucune MR de diff pour ${depot.nom}`);
        }
      }

      // Trier par date (plus récent d'abord)
      allMrs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setMrs(allMrs);
    } catch (e) {
      console.error("Erreur chargement MR", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjets();
    fetchAllMergeRequests();
  }, []);

  const syncStatus = async (mr: MergeRequest) => {
    try {
      const isDiff = mr.type_mr === "auto_merge" || mr.type_mr === "diff" || mr.type_mr === "force";
      const endpoint = isDiff
        ? `${API}/merge-requests-diff/${mr.id}/sync`
        : `${API}/merge-requests/${mr.id}/sync`;

      await axios.put(endpoint, {}, { headers: getHeaders() });
      
      // Rafraîchir la liste
      await fetchAllMergeRequests();
    } catch (e) {
      alert("Erreur lors de la synchronisation");
    }
  };

  // Filtres
  const filteredMrs = mrs.filter(mr => {
    const matchProjet = projetFiltre === "all" || mr.depot_id === projetFiltre || mr.depot_analyse_id === projetFiltre;
    const matchSearch = mr.titre?.toLowerCase().includes(search.toLowerCase()) ||
      mr.branche_source?.toLowerCase().includes(search.toLowerCase()) ||
      mr.branche_cible?.toLowerCase().includes(search.toLowerCase()) ||
      mr.depot_nom?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || mr.type_mr === filterType;
    const matchStatut = filterStatut === "all" || mr.statut === filterStatut;
    return matchProjet && matchSearch && matchType && matchStatut;
  });

  // Stats
  const stats = {
    total: filteredMrs.length,
    opened: filteredMrs.filter(m => m.statut === "opened").length,
    merged: filteredMrs.filter(m => m.statut === "merged").length,
    closed: filteredMrs.filter(m => m.statut === "closed").length,
    tests: filteredMrs.filter(m => m.type_mr === "tests").length,
    auto_merge: filteredMrs.filter(m => m.type_mr === "auto_merge").length,
    diff: filteredMrs.filter(m => m.type_mr === "diff").length,
    force: filteredMrs.filter(m => m.type_mr === "force").length,
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "tests":
        return { icon: "🧪", label: "Tests", color: "#6366f1", bg: "#eef2ff" };
      case "auto_merge":
        return { icon: "⚡", label: "Auto-merge", color: "#f59e0b", bg: "#fffbeb" };
      case "diff":
        return { icon: "📊", label: "Diff analyse", color: "#10b981", bg: "#ecfdf5" };
      case "force":
        return { icon: "⚠️", label: "Forcée", color: "#ef4444", bg: "#fef2f2" };
      default:
        return { icon: "🔀", label: "MR", color: "#64748b", bg: "#f1f5f9" };
    }
  };

  const getStatutConfig = (statut: string) => {
    switch (statut) {
      case "opened":
        return { icon: "🟡", label: "Ouverte", color: "#b45309", bg: "#fef3c7" };
      case "merged":
        return { icon: "✅", label: "Fusionnée", color: "#15803d", bg: "#dcfce7" };
      default:
        return { icon: "🔴", label: "Fermée", color: "#b91c1c", bg: "#fee2e2" };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Merge Requests</h1>
            <p className="text-sm text-gray-500 mt-1">Toutes les MR générées par l'IA</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            ← Retour
          </button>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-6">
          <div className="text-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div className="text-2xl font-bold text-amber-600">{stats.opened}</div>
            <div className="text-xs text-gray-500">Ouvertes</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
            <div className="text-2xl font-bold text-green-600">{stats.merged}</div>
            <div className="text-xs text-gray-500">Fusionnées</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
            <div className="text-2xl font-bold text-red-600">{stats.closed}</div>
            <div className="text-xs text-gray-500">Fermées</div>
          </div>
          <div className="text-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="text-2xl font-bold text-indigo-600">{stats.tests}</div>
            <div className="text-xs text-gray-500">🧪 Tests</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div className="text-2xl font-bold text-amber-600">{stats.auto_merge}</div>
            <div className="text-xs text-gray-500">⚡ Auto</div>
          </div>
          <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="text-2xl font-bold text-emerald-600">{stats.diff}</div>
            <div className="text-xs text-gray-500">📊 Diff</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
            <div className="text-2xl font-bold text-red-600">{stats.force}</div>
            <div className="text-xs text-gray-500">⚠️ Force</div>
          </div>
        </div>

        {/* FILTRES */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Filtre projet */}
            <select
              value={projetFiltre}
              onChange={e => setProjetFiltre(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            >
              <option value="all">📁 Tous les projets</option>
              {projets.map(p => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>

            {/* Filtre type */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            >
              <option value="all">🏷️ Tous les types</option>
              <option value="tests">🧪 Tests</option>
              <option value="auto_merge">⚡ Auto-merge</option>
              <option value="diff">📊 Diff analyse</option>
              <option value="force">⚠️ MR forcée</option>
            </select>

            {/* Filtre statut */}
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            >
              <option value="all">🔄 Tous les statuts</option>
              <option value="opened">🟡 Ouvertes</option>
              <option value="merged">✅ Fusionnées</option>
              <option value="closed">🔴 Fermées</option>
            </select>

            {/* Recherche */}
            <input
              type="text"
              placeholder="🔍 Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />

            {/* Rafraîchir */}
            <button
              onClick={fetchAllMergeRequests}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
            >
              ↻ Rafraîchir
            </button>
          </div>
        </div>

        {/* TABLEAU DES MR */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : filteredMrs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <div className="text-4xl mb-3">🔀</div>
            <p className="text-gray-500">Aucune Merge Request trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Projet</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Titre</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Source → Cible</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMrs.map(mr => {
                  const type = getTypeConfig(mr.type_mr);
                  const statut = getStatutConfig(mr.statut);
                  return (
                    <tr
                      key={mr.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition ${
                        selectedMr?.id === mr.id ? "bg-indigo-50" : ""
                      }`}
                      onClick={() => setSelectedMr(mr)}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900 text-sm">{mr.depot_nom || "—"}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: type.bg, color: type.color }}>
                          {type.icon} {type.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={mr.mr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          onClick={e => e.stopPropagation()}
                        >
                          {mr.titre?.slice(0, 60) || "Sans titre"}
                        </a>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{mr.branche_source || "?"}</code>
                        <span className="mx-1 text-gray-400">→</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{mr.branche_cible || "?"}</code>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: statut.bg, color: statut.color }}>
                          {statut.icon} {statut.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {new Date(mr.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => syncStatus(mr)}
                          className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
                          title="Synchroniser avec GitLab"
                        >
                          ↻ Sync
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL DÉTAILS */}
        {selectedMr && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMr(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{selectedMr.titre?.slice(0, 80)}</h3>
                  <p className="text-xs text-gray-500 mt-1">MR #{selectedMr.mr_id_gitlab} · {new Date(selectedMr.created_at).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedMr(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Lien GitLab</div>
                  <a href={selectedMr.mr_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm break-all">
                    {selectedMr.mr_url}
                  </a>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Branches</div>
                  <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg block font-mono">
                    {selectedMr.branche_source || "?"} → {selectedMr.branche_cible || "?"}
                  </code>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Type / Statut</div>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: getTypeConfig(selectedMr.type_mr).bg, color: getTypeConfig(selectedMr.type_mr).color }}>
                      {getTypeConfig(selectedMr.type_mr).icon} {getTypeConfig(selectedMr.type_mr).label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: getStatutConfig(selectedMr.statut).bg, color: getStatutConfig(selectedMr.statut).color }}>
                      {getStatutConfig(selectedMr.statut).icon} {getStatutConfig(selectedMr.statut).label}
                    </span>
                  </div>
                </div>
                {selectedMr.description && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Description</div>
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedMr.description}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => syncStatus(selectedMr)}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition"
                  >
                    ↻ Synchroniser
                  </button>
                  <button
                    onClick={() => setSelectedMr(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}