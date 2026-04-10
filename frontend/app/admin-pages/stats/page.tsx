"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, Loader, ErrorState, ScorePill } from "../adminUtils";
import type { Stats, Analyse, AnalyseDiff, UserItem, TestGenere } from "../adminUtils";

// ── GRAPHIQUES AVEC CHART.JS ──────────────────────────────────────
import {
  Chart, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, LineElement, PointElement,
  DoughnutController, BarController, LineController
} from "chart.js";

Chart.register(
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  DoughnutController, BarController, LineController
);

// Composant Donut Chart
function DonutChart({ data, labels, colors, centerLabel }: {
  data: number[]; labels: string[]; colors: string[]; centerLabel: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + "20"), borderColor: colors, borderWidth: 2 }] },
      options: { cutout: "70%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1e293b" } } }
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <div style={{ position: "relative", width: "100%", height: 180 }}>
      <canvas ref={ref} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f3fc", fontFamily: "'Syne',sans-serif" }}>{total}</div>
        <div style={{ fontSize: 9, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace" }}>{centerLabel}</div>
      </div>
    </div>
  );
}

// Composant Bar Chart
function BarChartComponent({ labels, data, color, label }: { labels: string[]; data: number[]; color: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: "bar",
      data: { labels, datasets: [{ label, data, backgroundColor: color + "20", borderColor: color, borderWidth: 2, borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1e293b" } }, scales: { x: { ticks: { color: "#a8b0d0", font: { size: 9 } } }, y: { ticks: { color: "#a8b0d0", stepSize: 1 } } } }
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <div style={{ height: 220 }}><canvas ref={ref} /></div>;
}

// Composant Line Chart
function LineChartComponent({ labels, data, color, label }: { labels: string[]; data: number[]; color: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: "line",
      data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: color + "10", borderWidth: 2, pointRadius: 3, pointBackgroundColor: color, fill: true, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { backgroundColor: "#1e293b" } }, scales: { x: { ticks: { color: "#a8b0d0", font: { size: 9 }, maxRotation: 45 } }, y: { ticks: { color: "#a8b0d0" } } } }
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <div style={{ height: 260 }}><canvas ref={ref} /></div>;
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [analyses, setAnalyses] = useState<Analyse[]>([]);
  const [diffs, setDiffs] = useState<AnalyseDiff[]>([]);
  const [tests, setTests] = useState<TestGenere[]>([]);

  // Données pour les graphiques
  const [evolutionParJour, setEvolutionParJour] = useState<{ date: string; analyses: number; diffs: number }[]>([]);
  const [langagesData, setLangagesData] = useState<{ langage: string; count: number }[]>([]);
  const [vulnSeveriteData, setVulnSeveriteData] = useState<{ severity: string; count: number }[]>([]);
  const [activiteParHeure, setActiviteParHeure] = useState<{ hour: string; count: number }[]>([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [sRes, uRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: getHeaders() }),
        axios.get(`${API}/admin/users`, { headers: getHeaders() }),
      ]);
      setStats(sRes.data);
      setUsers(uRes.data);

      const allA: Analyse[] = [];
      const allD: AnalyseDiff[] = [];
      const allT: TestGenere[] = [];
      const evolutionMap: Record<string, { analyses: number; diffs: number }> = {};
      const langagesMap: Record<string, number> = {};
      const vulnMap: Record<string, number> = { CRITIQUE: 0, HAUTE: 0, MOYENNE: 0, FAIBLE: 0 };
      const heureMap: Record<number, number> = {};

      for (const u of uRes.data as UserItem[]) {
        try {
          const dr = await axios.get(`${API}/analyses/depots-user/${u.id}`, { headers: getHeaders() });
          for (const d of dr.data) {
            try {
              const ar = await axios.get(`${API}/analyses/depot/${d.id}`, { headers: getHeaders() });
              for (const a of ar.data) {
                const date = new Date(a.created_at).toISOString().split("T")[0];
                if (!evolutionMap[date]) evolutionMap[date] = { analyses: 0, diffs: 0 };
                evolutionMap[date].analyses++;
                allA.push({ ...a, depot_nom: d.nom, user_email: u.email, nb_vulns: a.vulnerabilites?.length || 0 });

                const heure = new Date(a.created_at).getHours();
                heureMap[heure] = (heureMap[heure] || 0) + 1;

                if (a.vulnerabilites) {
                  for (const v of a.vulnerabilites) {
                    if (vulnMap[v.severite] !== undefined) vulnMap[v.severite]++;
                  }
                }
              }
            } catch { }
            const lang = detecterLangage(d.nom);
            langagesMap[lang] = (langagesMap[lang] || 0) + 1;
          }
        } catch { }

        try {
          const dr2 = await axios.get(`${API}/depots/user/${u.id}`, { headers: getHeaders() });
          for (const d of dr2.data) {
            try {
              const cr = await axios.get(`${API}/comparaisons/depot/${d.id}`, { headers: getHeaders() });
              for (const c of cr.data) {
                try {
                  const ar = await axios.get(`${API}/comparaisons/${c.id}/analyses`, { headers: getHeaders() });
                  for (const a of ar.data) {
                    const date = new Date(a.created_at).toISOString().split("T")[0];
                    if (!evolutionMap[date]) evolutionMap[date] = { analyses: 0, diffs: 0 };
                    evolutionMap[date].diffs++;
                    allD.push({ ...a, projet_nom: d.nom, user_email: u.email, from_branch: c.from_branch, to_branch: c.to_branch, resultat_statut: a.resultat_statut || a.statut });

                    const heure = new Date(a.created_at).getHours();
                    heureMap[heure] = (heureMap[heure] || 0) + 1;
                  }
                } catch { }
              }
            } catch { }
            const lang = detecterLangage(d.nom);
            langagesMap[lang] = (langagesMap[lang] || 0) + 1;
          }
        } catch { }
      }

      const evolution = Object.entries(evolutionMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
      setEvolutionParJour(evolution);
      setLangagesData(Object.entries(langagesMap).map(([langage, count]) => ({ langage, count })).sort((a, b) => b.count - a.count).slice(0, 6));
      setVulnSeveriteData(Object.entries(vulnMap).map(([severity, count]) => ({ severity, count })));
      setActiviteParHeure(Object.entries(heureMap).map(([hour, count]) => ({ hour: `${hour}h`, count })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)));

      setAnalyses(allA);
      setDiffs(allD);
      setTests(allT);
    } catch (err) {
      setError("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  const detecterLangage = (nom: string): string => {
    const n = nom.toLowerCase();
    if (n.includes("python")) return "Python";
    if (n.includes("typescript") || n.includes("ts")) return "TypeScript";
    if (n.includes("javascript") || n.includes("js")) return "JavaScript";
    if (n.includes("java")) return "Java";
    if (n.includes("go")) return "Go";
    if (n.includes("rust")) return "Rust";
    if (n.includes("php")) return "PHP";
    if (n.includes("c#") || n.includes("csharp") || n.includes(".net")) return "C#";
    return "Autre";
  };

  useEffect(() => { load(); }, []);

  if (loading) return <AdminLayout><Loader message="Calcul des statistiques..." /></AdminLayout>;
  if (error) return <AdminLayout><ErrorState message={error} onRetry={load} /></AdminLayout>;

  const avgQ = analyses.length ? Math.round(analyses.reduce((s, a) => s + (a.score_qualite || 0), 0) / analyses.length) : 0;
  const avgS = analyses.length ? Math.round(analyses.reduce((s, a) => s + (a.score_securite || 0), 0) / analyses.length) : 0;
  const avgP = analyses.length ? Math.round(analyses.reduce((s, a) => s + (a.score_performance || 0), 0) / analyses.length) : 0;
  const totalVulns = analyses.reduce((s, a) => s + (a.nb_vulns || 0), 0);
  const totalTests = tests.reduce((s, t) => s + (t.nb_tests || 0), 0);
  const totalDiffs = diffs.length;
  const mergeAutorise = diffs.filter(d => d.resultat_statut === "merge_autorise" || d.resultat_statut === "merge_autorise_force").length;
  const mergeBloque = diffs.filter(d => d.resultat_statut === "merge_bloque").length;
  const tauxMerge = totalDiffs ? Math.round((mergeAutorise / totalDiffs) * 100) : 0;

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: none; } }
        .stat-card { animation: fadeInUp 0.4s ease backwards; }
      `}</style>
      <div style={{ flex: 1, background: "#07090f", overflowY: "auto" }}>
        <PageHeader icon="◈" title="Tableau de bord analytique" sub="Métriques globales, tendances et insights" onRefresh={load} />

        <div style={{ padding: "24px 32px" }}>

          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Utilisateurs", value: stats?.total_users || 0, icon: "👥", color: "#5b63f5", sub: `${stats?.active_users || 0} actifs` },
              { label: "Dépôts", value: stats?.total_depots || 0, icon: "📁", color: "#60a5fa", sub: `${stats?.total_depots || 0} total` },
              { label: "Analyses IA", value: analyses.length + totalDiffs, icon: "🤖", color: "#22c55e", sub: `${analyses.length} simples / ${totalDiffs} diff` },
              { label: "Score Qualité", value: `${avgQ}%`, icon: "📊", color: "#5b63f5", sub: `moyenne générale` },
              { label: "Vulnérabilités", value: totalVulns, icon: "⚠️", color: "#f87171", sub: `détectées` },
              { label: "Tests générés", value: totalTests, icon: "🧪", color: "#8b5cf6", sub: `par l'IA` },
              { label: "Taux merge", value: `${tauxMerge}%`, icon: "🔄", color: "#ec4899", sub: `${mergeAutorise}/${totalDiffs} autorisés` },
              { label: "MR créées", value: stats?.total_mr || 0, icon: "🔀", color: "#f59e0b", sub: `par l'IA` },
            ].map((k, i) => (
              <div key={k.label} className="stat-card" style={{ animationDelay: `${i * 0.03}s`, background: "#0a0c14", border: `1px solid ${k.color}22`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{k.icon}</span>
                  <span style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: "'Syne',sans-serif" }}>{k.value}</span>
                </div>
                <div style={{ fontSize: 11, color: "#a8b0d0", fontFamily: "'JetBrains Mono',monospace" }}>{k.label}</div>
                <div style={{ fontSize: 9, color: "#5a6080", marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* LIGNE 1 : Évolution des analyses (graphique principal) */}
          <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 16, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f3fc", fontFamily: "'Syne',sans-serif" }}>📈 Évolution des analyses</h2>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace" }}>30 derniers jours • Analyses simples vs Diff</p>
              </div>
            </div>
            {evolutionParJour.length > 0 ? (
              <LineChartComponent
                labels={evolutionParJour.map(e => e.date.slice(5))}
                data={evolutionParJour.map(e => e.analyses + e.diffs)}
                color="#5b63f5"
                label="Total analyses"
              />
            ) : <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#5a6080" }}>Aucune donnée</div>}
          </div>

          {/* LIGNE 2 : 3 graphiques (Décisions Diff + Langages + Activité horaire) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>

            {/* Décisions Diff IA */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 16 }}>⚖️ Décisions Diff IA</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Merge autorisé", value: diffs.filter(d => d.resultat_statut === "merge_autorise").length, color: "#22c55e" },
                  { label: "Merge forcé", value: diffs.filter(d => d.resultat_statut === "merge_autorise_force").length, color: "#f59e0b" },
                  { label: "Merge bloqué", value: diffs.filter(d => d.resultat_statut === "merge_bloque").length, color: "#f87171" },
                  { label: "Aucun changement", value: diffs.filter(d => d.resultat_statut === "aucun_changement").length, color: "#6b7280" },
                ].map(d => (
                  <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: `${d.color}0a`, borderRadius: 8, border: `1px solid ${d.color}15` }}>
                    <span style={{ color: d.color, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{d.label}</span>
                    <b style={{ color: d.color, fontSize: 18 }}>{d.value}</b>
                  </div>
                ))}
              </div>
              {totalDiffs === 0 && <p style={{ color: "#3a4060", fontSize: 11, textAlign: "center", marginTop: 12 }}>Aucune analyse diff</p>}
            </div>

            {/* Top langages */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 16 }}>💻 Langages dominants</p>
              {langagesData.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {langagesData.map((lang, i) => (
                    <div key={lang.langage}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#a8b0d0" }}>{lang.langage}</span>
                        <span style={{ fontSize: 11, color: "#818cf8" }}>{lang.count}</span>
                      </div>
                      <div style={{ height: 4, background: "#1e2235", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(lang.count / (langagesData[0]?.count || 1)) * 100}%`, height: "100%", background: ["#5b63f5", "#22c55e", "#f59e0b", "#f87171", "#8b5cf6", "#ec4899"][i % 6], borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#3a4060", fontSize: 11, textAlign: "center" }}>Aucune donnée</p>}
            </div>

            {/* Activité par heure */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 16 }}>⏰ Heures de pointe</p>
              {activiteParHeure.length > 0 ? (
                <BarChartComponent
                  labels={activiteParHeure.map(h => h.hour)}
                  data={activiteParHeure.map(h => h.count)}
                  color="#8b5cf6"
                  label="Analyses"
                />
              ) : <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#5a6080" }}>Aucune donnée</div>}
            </div>
          </div>

          {/* LIGNE 3 : Scores moyens + Top utilisateurs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

            {/* Scores moyens avec gauges */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 20 }}>🎯 Scores moyens (0-100)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: "Qualité", score: avgQ, color: "#5b63f5", icon: "📊" },
                  { label: "Sécurité", score: avgS, color: "#22c55e", icon: "🔒" },
                  { label: "Performance", score: avgP, color: "#f59e0b", icon: "⚡" },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#a8b0d0", fontFamily: "'JetBrains Mono',monospace" }}>{s.icon} {s.label}</span>
                      <ScorePill score={s.score} />
                    </div>
                    <div style={{ height: 6, background: "#1e2235", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${s.score}%`, height: "100%", background: s.color, borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top utilisateurs */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 16 }}>🏆 Top contributeurs</p>
              {(() => {
                const userStats = users.map(u => ({
                  email: u.email,
                  analyses: analyses.filter(a => a.user_email === u.email).length,
                  diffs: diffs.filter(d => d.user_email === u.email).length,
                  total: analyses.filter(a => a.user_email === u.email).length + diffs.filter(d => d.user_email === u.email).length
                })).sort((a, b) => b.total - a.total).slice(0, 5);
                const maxTotal = Math.max(...userStats.map(u => u.total), 1);
                return userStats.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {userStats.map((u, i) => (
                      <div key={u.email}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "#3a4060", fontSize: 10, width: 20 }}>#{i + 1}</span>
                            <span style={{ fontSize: 11, color: "#a8b0d0", fontFamily: "'JetBrains Mono',monospace" }}>{u.email.split("@")[0]}</span>
                          </div>
                          <span style={{ fontSize: 11, color: "#818cf8" }}>{u.total}</span>
                        </div>
                        <div style={{ height: 4, background: "#1e2235", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${(u.total / maxTotal) * 100}%`, height: "100%", background: "#5b63f5", borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: "#3a4060", fontSize: 11, textAlign: "center" }}>Aucune donnée</p>;
              })()}
            </div>
          </div>

          {/* LIGNE 4 : Vulnérabilités par sévérité + Répartition des MR */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Vulnérabilités par sévérité */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 16 }}>⚠️ Vulnérabilités par sévérité</p>
              {vulnSeveriteData.some(v => v.count > 0) ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {vulnSeveriteData.map(v => (
                    <div key={v.severity} style={{ flex: 1, textAlign: "center", padding: "12px 8px", background: `#${v.severity === "CRITIQUE" ? "ef4444" : v.severity === "HAUTE" ? "f59e0b" : v.severity === "MOYENNE" ? "eab308" : "10b981"}10`, borderRadius: 10 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: v.severity === "CRITIQUE" ? "#f87171" : v.severity === "HAUTE" ? "#f59e0b" : v.severity === "MOYENNE" ? "#eab308" : "#10b981" }}>{v.count}</div>
                      <div style={{ fontSize: 9, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace" }}>{v.severity}</div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#3a4060", fontSize: 11, textAlign: "center", padding: 40 }}>✅ Aucune vulnérabilité détectée</p>}
            </div>

            {/* Répartition des MR */}
            <div style={{ background: "#0a0c14", border: "1px solid #1e2235", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc", marginBottom: 16 }}>🔀 Types de Merge Requests</p>
              {(() => {
                const mrTests = tests.length;
                const mrAuto = diffs.filter(d => d.resultat_statut === "merge_autorise").length;
                const mrForce = diffs.filter(d => d.resultat_statut === "merge_autorise_force").length;
                const totalMR = mrTests + mrAuto + mrForce;
                if (totalMR === 0) return <p style={{ color: "#3a4060", fontSize: 11, textAlign: "center", padding: 40 }}>Aucune MR créée</p>;
                return (
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1, textAlign: "center", padding: "12px 8px", background: "#5b63f510", borderRadius: 10 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#5b63f5" }}>{mrTests}</div>
                      <div style={{ fontSize: 9, color: "#5a6080" }}>🧪 Tests</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", padding: "12px 8px", background: "#22c55e10", borderRadius: 10 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{mrAuto}</div>
                      <div style={{ fontSize: 9, color: "#5a6080" }}>⚡ Auto</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", padding: "12px 8px", background: "#f59e0b10", borderRadius: 10 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{mrForce}</div>
                      <div style={{ fontSize: 9, color: "#5a6080" }}>⚠️ Force</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}