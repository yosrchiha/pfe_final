"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

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
    inputBg: isDark ? "#0f1117" : "white",
    cardHover: isDark ? "#1a2030" : "#faf9fe",
    tooltipBg: isDark ? "#1a1c2a" : "white",
    tooltipBorder: isDark ? "#2a2f45" : "#e2e8f0",
    chartGrid: isDark ? "#2a2f45" : "#e2e8f0",
    chartText: isDark ? "#94a3b8" : "#64748b",
  };

  const [simplesParJour, setSimplesParJour] = useState<StatsParJour[]>([]);
  const [simplesParProjet, setSimplesParProjet] = useState<StatsParProjet[]>([]);
  const [totalSimples, setTotalSimples] = useState(0);
  const [totalProjetsSimples, setTotalProjetsSimples] = useState(0);
  
  const [diffParJour, setDiffParJour] = useState<StatsParJour[]>([]);
  const [diffParProjet, setDiffParProjet] = useState<StatsParProjet[]>([]);
  const [totalDiff, setTotalDiff] = useState(0);
  const [totalProjetsDiff, setTotalProjetsDiff] = useState(0);
  
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

      const mrProjetsMap: Record<string, { tests: number; autoMerge: number; force: number }> = {};
      let totalMRCount = 0;
      let totalMRTests = 0;
      let totalMRAutoMerge = 0;
      let totalMRForce = 0;

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

  if (loading) {
  return (
    <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center", color: D.faint }}>
      <div style={{ 
        width: 24, 
        height: 24, 
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderTopWidth: 2,
        borderLeftStyle: "solid",
        borderRightStyle: "solid",
        borderBottomStyle: "solid",
        borderTopStyle: "solid",
        borderLeftColor: D.border,
        borderRightColor: D.border,
        borderBottomColor: D.border,
        borderTopColor: "#6366f1",
        borderRadius: "50%", 
        animation: "spin 0.6s linear infinite", 
        marginRight: 12 
      }} />
      Chargement des statistiques...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: D.tooltipBg, border: `1px solid ${D.tooltipBorder}`, borderRadius: 12, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <p style={{ margin: 0, fontSize: 12, color: D.text }}>{label}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} style={{ margin: "4px 0 0", fontSize: 12, color: p.color }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: D.bg }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        
        {/* HEADER avec ThemeToggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: D.text, letterSpacing: "-0.02em" }}>📊 Statistiques détaillées</h1>
            <p style={{ color: D.faint, marginTop: 4 }}>Analyses simples | Analyses Diff | Merge Requests</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <ThemeToggle />
            <button onClick={() => router.push("/dashboard")} style={{ padding: "10px 20px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, color: D.muted, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              ← Retour
            </button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, marginBottom: 32 }}>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: "rgba(99,102,241,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20, color: "#6366f1" }}>📊</span>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: D.text }}>{totalSimples}</div>
                <div style={{ fontSize: 13, color: D.faint }}>Analyses simples</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: D.faint, marginTop: 8 }}>{totalProjetsSimples} projet(s)</div>
          </div>

          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: "rgba(16,185,129,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20, color: "#10b981" }}>🔄</span>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: D.text }}>{totalDiff}</div>
                <div style={{ fontSize: 13, color: D.faint }}>Analyses Diff</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: D.faint, marginTop: 8 }}>{totalProjetsDiff} projet(s)</div>
          </div>

          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: "rgba(139,92,246,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20, color: "#8b5cf6" }}>🔀</span>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: D.text }}>{totalMR}</div>
                <div style={{ fontSize: 13, color: D.faint }}>Merge Requests totales</div>
              </div>
            </div>
          </div>

          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", gap: 16, justifyContent: "space-between" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1" }}>{mrTests}</div>
                <div style={{ fontSize: 10, color: D.faint }}>🧪 Tests</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{mrAutoMerge}</div>
                <div style={{ fontSize: 10, color: D.faint }}>⚡ Auto</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>{mrForce}</div>
                <div style={{ fontSize: 10, color: D.faint }}>⚠️ Force</div>
              </div>
            </div>
          </div>
        </div>

        {/* GRAPHIQUE 1 : Analyses par jour */}
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: D.text, marginBottom: 8 }}>📈 Analyses par jour (30 derniers jours)</h2>
          <p style={{ fontSize: 13, color: D.faint, marginBottom: 24 }}>Comparaison entre analyses simples et analyses Diff</p>
          
          <ResponsiveContainer width="100%" height={350}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke={D.chartGrid} />
              <XAxis dataKey="date" stroke={D.chartText} fontSize={12} />
              <YAxis stroke={D.chartText} fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: D.text }} />
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
        </div>

        {/* GRAPHIQUE 2 : Top projets */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 32, marginBottom: 32 }}>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: D.text, marginBottom: 16 }}>📊 Top projets (analyses simples)</h2>
            {simplesParProjet.length === 0 ? (
              <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", color: D.faint }}>Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={simplesParProjet} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={D.chartGrid} />
                  <XAxis type="number" stroke={D.chartText} fontSize={12} />
                  <YAxis type="category" dataKey="projet" stroke={D.chartText} fontSize={12} width={150} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Analyses simples" fill="#6366f1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: D.text, marginBottom: 16 }}>📊 Top projets (analyses Diff)</h2>
            {diffParProjet.length === 0 ? (
              <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", color: D.faint }}>Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={diffParProjet} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={D.chartGrid} />
                  <XAxis type="number" stroke={D.chartText} fontSize={12} />
                  <YAxis type="category" dataKey="projet" stroke={D.chartText} fontSize={12} width={150} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Analyses Diff" fill="#10b981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GRAPHIQUE 3 : Merge Requests par projet */}
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: D.text, marginBottom: 8 }}>🔀 Merge Requests par projet</h2>
          <p style={{ fontSize: 13, color: D.faint, marginBottom: 24 }}>Répartition des MR (Tests / Auto-merge / Forcées)</p>
          
          {mrParProjet.length === 0 ? (
            <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: D.faint }}>Aucune Merge Request</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={mrParProjet}>
                <CartesianGrid strokeDasharray="3 3" stroke={D.chartGrid} />
                <XAxis dataKey="projet" stroke={D.chartText} fontSize={12} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke={D.chartText} fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: D.text }} />
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