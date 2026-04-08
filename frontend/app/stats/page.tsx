"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const API = "http://127.0.0.1:8000";

interface StatsParJour {
  date: string;
  count: number;
}

interface StatsParProjet {
  projet: string;
  count: number;
}

interface StatsMRParProjet {
  projet: string;
  tests: number;
  autoMerge: number;
  force: number;
  total: number;
}

export default function StatsPage() {
  const router = useRouter();
  
  // Analyses SIMPLES
  const [simplesParJour, setSimplesParJour] = useState<StatsParJour[]>([]);
  const [simplesParProjet, setSimplesParProjet] = useState<StatsParProjet[]>([]);
  const [totalSimples, setTotalSimples] = useState(0);
  const [totalProjetsSimples, setTotalProjetsSimples] = useState(0);
  
  // Analyses DIFF
  const [diffParJour, setDiffParJour] = useState<StatsParJour[]>([]);
  const [diffParProjet, setDiffParProjet] = useState<StatsParProjet[]>([]);
  const [totalDiff, setTotalDiff] = useState(0);
  const [totalProjetsDiff, setTotalProjetsDiff] = useState(0);
  
  // Merge Requests
  const [mrParProjet, setMrParProjet] = useState<StatsMRParProjet[]>([]);
  const [totalMR, setTotalMR] = useState(0);
  const [mrTests, setMrTests] = useState(0);
  const [mrAutoMerge, setMrAutoMerge] = useState(0);
  const [mrForce, setMrForce] = useState(0);
  
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
      const userId = me.data.id;
      
      // ============================================================
      // PARTIE 1 : ANALYSES SIMPLES (depots_analyse + analyses)
      // ============================================================
      const depotsSimplesRes = await axios.get(`${API}/analyses/depots-user/${userId}`, { headers: getHeaders() });
      const depotsSimples = depotsSimplesRes.data;
      
      const simplesJoursMap: Record<string, number> = {};
      const simplesProjetsMap: Record<string, number> = {};
      let totalSimplesCount = 0;
      let totalSimplesProjets = 0;

      for (const depot of depotsSimples) {
        try {
          const analysesRes = await axios.get(`${API}/analyses/depot/${depot.id}`, { headers: getHeaders() });
          const analyses = analysesRes.data;
          
          if (analyses.length > 0) {
            totalSimplesProjets++;
            totalSimplesCount += analyses.length;
            simplesProjetsMap[depot.nom] = (simplesProjetsMap[depot.nom] || 0) + analyses.length;
            
            for (const analyse of analyses) {
              const date = new Date(analyse.created_at).toISOString().split('T')[0];
              simplesJoursMap[date] = (simplesJoursMap[date] || 0) + 1;
            }
          }
        } catch (e) {
          console.log(`Erreur pour dépôt simple ${depot.nom}:`, e);
        }
      }

      // ============================================================
      // PARTIE 2 : ANALYSES DIFF (depots + comparaisons + analyses_diff)
      // ============================================================
      const depotsDiffRes = await axios.get(`${API}/depots/user/${userId}`, { headers: getHeaders() });
      const depotsDiff = depotsDiffRes.data;
      
      const diffJoursMap: Record<string, number> = {};
      const diffProjetsMap: Record<string, number> = {};
      let totalDiffCount = 0;
      let totalDiffProjets = 0;

      for (const depot of depotsDiff) {
        try {
          const comparaisonsRes = await axios.get(`${API}/comparaisons/depot/${depot.id}`, { headers: getHeaders() });
          const comparaisons = comparaisonsRes.data;
          
          let nbAnalysesDiff = 0;
          
          for (const comparaison of comparaisons) {
            const analysesDiffRes = await axios.get(`${API}/comparaisons/${comparaison.id}/analyses`, { headers: getHeaders() });
            const analysesDiff = analysesDiffRes.data;
            nbAnalysesDiff += analysesDiff.length;
            
            for (const analyse of analysesDiff) {
              const date = new Date(analyse.created_at).toISOString().split('T')[0];
              diffJoursMap[date] = (diffJoursMap[date] || 0) + 1;
            }
          }
          
          if (nbAnalysesDiff > 0) {
            totalDiffProjets++;
            totalDiffCount += nbAnalysesDiff;
            diffProjetsMap[depot.nom] = (diffProjetsMap[depot.nom] || 0) + nbAnalysesDiff;
          }
        } catch (e) {
          console.log(`Erreur pour dépôt diff ${depot.nom}:`, e);
        }
      }

      // ============================================================
      // PARTIE 3 : MERGE REQUESTS (tests + auto_merge + force)
      // ============================================================
      const mrProjetsMap: Record<string, { tests: number; autoMerge: number; force: number }> = {};
      let totalMRCount = 0;
      let totalMRTests = 0;
      let totalMRAutoMerge = 0;
      let totalMRForce = 0;

      // Récupérer les MR de tests pour chaque dépôt simple
      for (const depot of depotsSimples) {
        try {
          const mrRes = await axios.get(`${API}/merge-requests/depot/${depot.id}`, { headers: getHeaders() });
          const mrs = mrRes.data;
          
          for (const mr of mrs) {
            totalMRCount++;
            
            if (mr.type_mr === "tests") {
              totalMRTests++;
              mrProjetsMap[depot.nom] = mrProjetsMap[depot.nom] || { tests: 0, autoMerge: 0, force: 0 };
              mrProjetsMap[depot.nom].tests++;
            } else if (mr.type_mr === "auto_merge") {
              totalMRAutoMerge++;
              mrProjetsMap[depot.nom] = mrProjetsMap[depot.nom] || { tests: 0, autoMerge: 0, force: 0 };
              mrProjetsMap[depot.nom].autoMerge++;
            } else if (mr.type_mr === "force") {
              totalMRForce++;
              mrProjetsMap[depot.nom] = mrProjetsMap[depot.nom] || { tests: 0, autoMerge: 0, force: 0 };
              mrProjetsMap[depot.nom].force++;
            }
          }
        } catch (e) {
          console.log(`Erreur MR pour ${depot.nom}:`, e);
        }
      }

      // Récupérer les MR de diff pour chaque dépôt diff
      for (const depot of depotsDiff) {
        try {
          const mrRes = await axios.get(`${API}/merge-requests-diff/depot/${depot.id}`, { headers: getHeaders() });
          const mrs = mrRes.data;
          
          for (const mr of mrs) {
            totalMRCount++;
            
            if (mr.type_mr === "auto") {
              totalMRAutoMerge++;
              mrProjetsMap[depot.nom] = mrProjetsMap[depot.nom] || { tests: 0, autoMerge: 0, force: 0 };
              mrProjetsMap[depot.nom].autoMerge++;
            } else if (mr.type_mr === "force") {
              totalMRForce++;
              mrProjetsMap[depot.nom] = mrProjetsMap[depot.nom] || { tests: 0, autoMerge: 0, force: 0 };
              mrProjetsMap[depot.nom].force++;
            }
          }
        } catch (e) {
          console.log(`Erreur MR diff pour ${depot.nom}:`, e);
        }
      }

      const mrProjetsData = Object.entries(mrProjetsMap)
        .map(([projet, data]) => ({
          projet,
          tests: data.tests,
          autoMerge: data.autoMerge,
          force: data.force,
          total: data.tests + data.autoMerge + data.force
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Transformation des données pour les graphiques
      const simplesJoursData = Object.entries(simplesJoursMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      const simplesProjetsData = Object.entries(simplesProjetsMap)
        .map(([projet, count]) => ({ projet, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const diffJoursData = Object.entries(diffJoursMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      const diffProjetsData = Object.entries(diffProjetsMap)
        .map(([projet, count]) => ({ projet, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setSimplesParJour(simplesJoursData);
      setSimplesParProjet(simplesProjetsData);
      setTotalSimples(totalSimplesCount);
      setTotalProjetsSimples(totalSimplesProjets);
      
      setDiffParJour(diffJoursData);
      setDiffParProjet(diffProjetsData);
      setTotalDiff(totalDiffCount);
      setTotalProjetsDiff(totalDiffProjets);
      
      setMrParProjet(mrProjetsData);
      setTotalMR(totalMRCount);
      setMrTests(totalMRTests);
      setMrAutoMerge(totalMRAutoMerge);
      setMrForce(totalMRForce);

    } catch (error) {
      console.error("Erreur chargement stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Statistiques détaillées</h1>
            <p className="text-gray-500 mt-1">Analyses simples | Analyses Diff | Merge Requests</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
          >
            ← Retour
          </button>
        </div>

        {/* LIGNE 1 : STATS CARDS - Analyses */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <span className="text-indigo-600 text-xl">📊</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalSimples}</div>
                <div className="text-sm text-gray-500">Analyses simples</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">{totalProjetsSimples} projet(s)</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 text-xl">🔄</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalDiff}</div>
                <div className="text-sm text-gray-500">Analyses Diff</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">{totalProjetsDiff} projet(s)</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-xl">🔀</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalMR}</div>
                <div className="text-sm text-gray-500">Merge Requests totales</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex gap-2 justify-between">
              <div className="text-center">
                <div className="text-xl font-bold text-indigo-600">{mrTests}</div>
                <div className="text-xs text-gray-500">🧪 Tests</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600">{mrAutoMerge}</div>
                <div className="text-xs text-gray-500">⚡ Auto</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-600">{mrForce}</div>
                <div className="text-xs text-gray-500">⚠️ Force</div>
              </div>
            </div>
          </div>
        </div>

        {/* GRAPHIQUE 1 : Analyses par jour (comparaison SIMPLES vs DIFF) */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">📈 Analyses par jour (30 derniers jours)</h2>
          <p className="text-sm text-gray-500 mb-6">Comparaison entre analyses simples et analyses Diff</p>
          
          {loading ? (
            <div className="h-80 flex items-center justify-center text-gray-400">Chargement...</div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  data={simplesParJour}
                  dataKey="count" 
                  name="Analyses simples"
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  data={diffParJour}
                  dataKey="count" 
                  name="Analyses Diff"
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* GRAPHIQUE 2 : Top projets (deux graphiques côte à côte) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">📊 Top projets (analyses simples)</h2>
            {loading ? (
              <div className="h-80 flex items-center justify-center text-gray-400">Chargement...</div>
            ) : simplesParProjet.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-400">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={simplesParProjet} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis type="category" dataKey="projet" stroke="#94a3b8" fontSize={12} width={150} />
                  <Tooltip />
                  <Bar dataKey="count" name="Analyses simples" fill="#6366f1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">📊 Top projets (analyses Diff)</h2>
            {loading ? (
              <div className="h-80 flex items-center justify-center text-gray-400">Chargement...</div>
            ) : diffParProjet.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-400">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={diffParProjet} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis type="category" dataKey="projet" stroke="#94a3b8" fontSize={12} width={150} />
                  <Tooltip />
                  <Bar dataKey="count" name="Analyses Diff" fill="#10b981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GRAPHIQUE 3 : Merge Requests par projet (barres empilées) */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">🔀 Merge Requests par projet</h2>
          <p className="text-sm text-gray-500 mb-6">Répartition des MR (Tests / Auto-merge / Forcées)</p>
          
          {loading ? (
            <div className="h-80 flex items-center justify-center text-gray-400">Chargement...</div>
          ) : mrParProjet.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-gray-400">Aucune Merge Request</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={mrParProjet}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="projet" stroke="#94a3b8" fontSize={12} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="tests" name="🧪 MR Tests" stackId="a" fill="#6366f1" radius={[4, 0, 0, 4]} />
                <Bar dataKey="autoMerge" name="⚡ MR Auto-merge" stackId="a" fill="#f59e0b" />
                <Bar dataKey="force" name="⚠️ MR Forcées" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}