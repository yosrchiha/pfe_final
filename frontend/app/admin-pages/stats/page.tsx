"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import AdminLayout from "../AdminLayout";

const API = "http://localhost:8001";

// ── TYPES ──────────────────────────────────────────────────────────
interface ParJour   { date: string; simples: number; diff: number; }
interface ParProjet { projet: string; simples: number; diff: number; total: number; }
interface MRProjet  { projet: string; tests: number; autoMerge: number; force: number; total: number; }
interface AllStats {
  totalSimples:  number; totalDiff:  number; totalMR: number;
  mrTests:       number; mrAuto:     number; mrForce: number;
  mergeAutorise: number; mergeBloque: number; aucunChgt: number;
  totalUsers:    number; activeUsers: number; totalDepots: number;
  parJour:       ParJour[];
  parProjet:     ParProjet[];
  mrParProjet:   MRProjet[];
}

const EMPTY: AllStats = {
  totalSimples:0, totalDiff:0, totalMR:0,
  mrTests:0, mrAuto:0, mrForce:0,
  mergeAutorise:0, mergeBloque:0, aucunChgt:0,
  totalUsers:0, activeUsers:0, totalDepots:0,
  parJour:[], parProjet:[], mrParProjet:[],
};

const COLORS = {
  indigo: "#6366f1", green: "#10b981", amber: "#f59e0b",
  red: "#ef4444", purple: "#8b5cf6", pink: "#ec4899",
  cyan: "#06b6d4", slate: "#64748b",
};

// ── TOOLTIP CUSTOM ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f1117", border: "1px solid #1e2538",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: "3px 0", fontSize: 12, color: p.color, fontFamily: "'JetBrains Mono',monospace" }}>
          {p.name}: <b>{p.value}</b>
        </p>
      ))}
    </div>
  );
}

// ── KPI CARD ───────────────────────────────────────────────────────
function KPI({ icon, value, label, color, sub }: { icon:string; value:any; label:string; color:string; sub?:string }) {
  return (
    <div style={{
      background: "#0a0c14", border: `1px solid ${color}22`,
      borderRadius: 14, padding: "18px 20px",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#a8b0d0", fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#3a4060", marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>{sub}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
export default function AdminStatsPage() {
  const router = useRouter();
  const [stats,   setStats]   = useState<AllStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const H = () => {
    const t = localStorage.getItem("token");
    return { Authorization: t ? `Bearer ${t}` : "" };
  };

  const safeGet = async (url: string): Promise<any[]> => {
    try {
      const r = await axios.get(url, { headers: H() });
      return Array.isArray(r.data) ? r.data : [];
    } catch { return []; }
  };

  const fetchStats = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }

      // ── 1. Stats rapides depuis /admin/stats ────────────────
      const globalRes = await axios.get(`${API}/admin/stats`, { headers: H() });
      const global = globalRes.data;

      // ── 2. Tous les utilisateurs ────────────────────────────
      const users = await safeGet(`${API}/admin/users`);

      // ── 3. Collecter tous les dépôts (simples + diff) ───────
      const allDepotsSimples: any[] = [];
      const allDepotsDiff: any[]    = [];

      for (const u of users) {
        const ds = await safeGet(`${API}/analyses/depots-user/${u.id}`);
        allDepotsSimples.push(...ds.map((d: any) => ({ ...d, user_email: u.email })));
        const dd = await safeGet(`${API}/depots/user/${u.id}`);
        allDepotsDiff.push(...dd.map((d: any) => ({ ...d, user_email: u.email })));
      }

      // ── 4. Analyses simples ─────────────────────────────────
      const joursMap:  Record<string, { simples: number; diff: number }> = {};
      const projetMap: Record<string, { simples: number; diff: number }> = {};
      let totalSimples = 0;

      const analyseRes = await Promise.allSettled(
        allDepotsSimples.map((d: any) => axios.get(`${API}/analyses/depot/${d.id}`, { headers: H() }))
      );
      analyseRes.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const analyses = r.value.data || [];
        const nom = allDepotsSimples[i].nom;
        totalSimples += analyses.length;
        if (!projetMap[nom]) projetMap[nom] = { simples: 0, diff: 0 };
        projetMap[nom].simples += analyses.length;
        analyses.forEach((a: any) => {
          const date = a.created_at?.split("T")[0] || "";
          if (!joursMap[date]) joursMap[date] = { simples: 0, diff: 0 };
          joursMap[date].simples++;
        });
      });

      // ── 5. Analyses diff ────────────────────────────────────
      let totalDiff = 0;
      let mergeAutorise = 0, mergeBloque = 0, aucunChgt = 0;

      const compRes = await Promise.allSettled(
        allDepotsDiff.map((d: any) => axios.get(`${API}/comparaisons/depot/${d.id}`, { headers: H() }))
      );
      const allComps: Array<{ comp: any; depot: any }> = [];
      compRes.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        (r.value.data || []).forEach((c: any) => allComps.push({ comp: c, depot: allDepotsDiff[i] }));
      });

      const diffRes = await Promise.allSettled(
        allComps.map(({ comp }) => axios.get(`${API}/comparaisons/${comp.id}/analyses`, { headers: H() }))
      );
      diffRes.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const analyses = r.value.data || [];
        const nom = allComps[i].depot.nom;
        totalDiff += analyses.length;
        if (!projetMap[nom]) projetMap[nom] = { simples: 0, diff: 0 };
        projetMap[nom].diff += analyses.length;
        analyses.forEach((a: any) => {
          const date = a.created_at?.split("T")[0] || "";
          if (!joursMap[date]) joursMap[date] = { simples: 0, diff: 0 };
          joursMap[date].diff++;
          const rs = a.resultat_statut || a.statut || "";
          if (rs === "merge_autorise" || rs === "merge_autorise_force") mergeAutorise++;
          else if (rs === "merge_bloque") mergeBloque++;
          else if (rs === "aucun_changement") aucunChgt++;
        });
      });

      // ── 6. Merge Requests ───────────────────────────────────
      let totalMR = 0, mrTests = 0, mrAuto = 0, mrForce = 0;
      const mrMap: Record<string, { tests: number; autoMerge: number; force: number }> = {};

      const mrRes = await Promise.allSettled(
        allDepotsSimples.map((d: any) => axios.get(`${API}/merge-requests/depot/${d.id}`, { headers: H() }))
      );
      mrRes.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const nom = allDepotsSimples[i].nom;
        if (!mrMap[nom]) mrMap[nom] = { tests: 0, autoMerge: 0, force: 0 };
        (r.value.data || []).forEach((mr: any) => {
          totalMR++;
          if (mr.type_mr === "tests")      { mrTests++; mrMap[nom].tests++; }
          else if (mr.type_mr === "auto_merge") { mrAuto++;  mrMap[nom].autoMerge++; }
          else if (mr.type_mr === "force") { mrForce++; mrMap[nom].force++; }
        });
      });

      const mrDiffRes = await Promise.allSettled(
        allDepotsDiff.map((d: any) => axios.get(`${API}/merge-requests-diff/depot/${d.id}`, { headers: H() }))
      );
      mrDiffRes.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const nom = allDepotsDiff[i].nom;
        if (!mrMap[nom]) mrMap[nom] = { tests: 0, autoMerge: 0, force: 0 };
        (r.value.data || []).forEach((mr: any) => {
          totalMR++;
          if (mr.type_mr === "auto" || mr.type_mr === "auto_merge") { mrAuto++; mrMap[nom].autoMerge++; }
          else if (mr.type_mr === "force") { mrForce++; mrMap[nom].force++; }
        });
      });

      // ── 7. Transformer pour les graphiques ──────────────────
      const parJour = Object.entries(joursMap)
        .map(([date, v]) => ({ date, simples: v.simples, diff: v.diff }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      const parProjet = Object.entries(projetMap)
        .map(([projet, v]) => ({ projet, simples: v.simples, diff: v.diff, total: v.simples + v.diff }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const mrParProjet = Object.entries(mrMap)
        .map(([projet, v]) => ({ projet, tests: v.tests, autoMerge: v.autoMerge, force: v.force, total: v.tests + v.autoMerge + v.force }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setStats({
        totalSimples, totalDiff, totalMR,
        mrTests, mrAuto, mrForce,
        mergeAutorise, mergeBloque, aucunChgt,
        totalUsers:   global.total_users  || 0,
        activeUsers:  global.active_users || 0,
        totalDepots:  global.total_depots || 0,
        parJour, parProjet, mrParProjet,
      });

    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) { router.push("/login"); return; }
      setError("Erreur de chargement des statistiques.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const tauxMerge = (stats.mergeAutorise + stats.mergeBloque) > 0
    ? Math.round((stats.mergeAutorise / (stats.mergeAutorise + stats.mergeBloque)) * 100) : 0;

  const pieData = [
    { name: "Merge autorisé", value: stats.mergeAutorise, color: COLORS.green  },
    { name: "Merge bloqué",   value: stats.mergeBloque,   color: COLORS.red    },
    { name: "Sans changement",value: stats.aucunChgt,      color: COLORS.slate  },
  ].filter(d => d.value > 0);

  // ── CSS ────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: #07090f; }
    ::-webkit-scrollbar-thumb { background: #1e2538; border-radius: 3px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  `;

  if (loading) {
    return (
      <AdminLayout>
        <style>{css}</style>
        <div style={{ flex:1, background:"#07090f", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
          <div style={{ width:34, height:34, border:"2px solid #1e2538", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
          <p style={{ color:"#5a6080", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>Calcul des statistiques globales...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div style={{ flex:1, background:"#07090f", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
          <p style={{ color:"#f87171", fontSize:13 }}>{error}</p>
          <button onClick={fetchStats} style={{ padding:"9px 22px", background:"rgba(91,99,245,0.14)", border:"1px solid rgba(91,99,245,0.3)", borderRadius:10, color:"#818cf8", fontWeight:600, cursor:"pointer" }}>Réessayer</button>
        </div>
      </AdminLayout>
    );
  }

  // Section wrapper
  const Section = ({ children, style = {} }: any) => (
    <div style={{ background:"#0a0c14", border:"1px solid #1e2538", borderRadius:16, padding:"22px 24px", ...style }}>
      {children}
    </div>
  );

  const SectionTitle = ({ icon, title, sub }: any) => (
    <div style={{ marginBottom:20 }}>
      <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:"#f1f3fc", fontFamily:"'Syne',sans-serif" }}>{icon} {title}</h2>
      {sub && <p style={{ margin:"4px 0 0", fontSize:11, color:"#3a4060", fontFamily:"'JetBrains Mono',monospace" }}>{sub}</p>}
    </div>
  );

  return (
    <AdminLayout>
      <style>{css}</style>
      <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>

        {/* HEADER */}
        <div style={{ padding:"24px 32px 20px", borderBottom:"1px solid #1e2235", background:"#0a0c14" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontSize:10, color:"#5b63f5", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:6 }}>ADMIN · GLOBAL</p>
              <h1 style={{ fontSize:22, fontWeight:800, color:"#f1f3fc", fontFamily:"'Syne',sans-serif", letterSpacing:"-0.02em" }}>Statistiques globales</h1>
              <p style={{ fontSize:11, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", marginTop:3 }}>Toutes les données de la plateforme · tous les utilisateurs</p>
            </div>
            <button onClick={fetchStats} style={{ padding:"9px 18px", background:"rgba(91,99,245,0.1)", border:"1px solid rgba(91,99,245,0.25)", borderRadius:10, color:"#818cf8", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, cursor:"pointer" }}>
              ↻ Actualiser
            </button>
          </div>
        </div>

        <div style={{ padding:"28px 32px", display:"flex", flexDirection:"column", gap:22 }}>

          {/* ── KPI ROW 1 — Plateforme ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12 }}>
            <KPI icon="👥" value={stats.totalUsers}   label="Utilisateurs"    color="#5b63f5"        sub={`${stats.activeUsers} actifs`} />
            <KPI icon="▣"  value={stats.totalDepots}  label="Dépôts GitLab"  color="#0ea5e9"        sub="tous utilisateurs" />
            <KPI icon="🔍" value={stats.totalSimples} label="Analyses simples" color={COLORS.indigo} sub="code complet" />
            <KPI icon="⇄"  value={stats.totalDiff}    label="Analyses diff"  color={COLORS.pink}    sub="entre branches" />
            <KPI icon="⊕"  value={stats.totalMR}      label="Merge Requests" color={COLORS.amber}   sub={`${stats.mrTests} tests · ${stats.mrAuto} auto`} />
            <KPI icon="✅" value={stats.mergeAutorise} label="Merges autorisés" color={COLORS.green} sub={`${tauxMerge}% taux`} />
            <KPI icon="🚫" value={stats.mergeBloque}  label="Merges bloqués" color={COLORS.red}     sub="vulns détectées" />
            <KPI icon="○"  value={stats.aucunChgt}    label="Sans changement" color={COLORS.slate}  sub="diff sans diff" />
          </div>

          {/* ── GRAPHIQUE 1 : Évolution par jour ── */}
          <Section>
            <SectionTitle icon="📈" title="Évolution des analyses (30 derniers jours)" sub="Analyses simples vs analyses diff — toute la plateforme" />
            {stats.parJour.length === 0 ? (
              <div style={{ height:300, display:"flex", alignItems:"center", justifyContent:"center", color:"#3a4060", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>Aucune donnée disponible</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.parJour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2538" />
                  <XAxis dataKey="date" stroke="#3a4060" fontSize={10} fontFamily="'JetBrains Mono',monospace"
                    tickFormatter={v => v.slice(5)} />
                  <YAxis stroke="#3a4060" fontSize={10} fontFamily="'JetBrains Mono',monospace" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color:"#5a6080", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }} />
                  <Line type="monotone" dataKey="simples" name="Analyses simples"
                    stroke={COLORS.indigo} strokeWidth={2} dot={{ fill:COLORS.indigo, r:3 }} />
                  <Line type="monotone" dataKey="diff" name="Analyses diff"
                    stroke={COLORS.pink} strokeWidth={2} dot={{ fill:COLORS.pink, r:3 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* ── GRAPHIQUE 2 + 3 : Top projets ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Section>
              <SectionTitle icon="📁" title="Top projets — analyses simples" sub="Volume d'analyses par dépôt" />
              {stats.parProjet.filter(p => p.simples > 0).length === 0 ? (
                <div style={{ height:280, display:"flex", alignItems:"center", justifyContent:"center", color:"#3a4060", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.parProjet.filter(p=>p.simples>0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2538" />
                    <XAxis type="number" stroke="#3a4060" fontSize={10} fontFamily="'JetBrains Mono',monospace" />
                    <YAxis type="category" dataKey="projet" stroke="#3a4060" fontSize={10}
                      fontFamily="'JetBrains Mono',monospace" width={120}
                      tickFormatter={v => v.length > 14 ? v.slice(0,14)+"…" : v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="simples" name="Analyses simples" fill={COLORS.indigo} radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>

            <Section>
              <SectionTitle icon="⇄" title="Top projets — analyses diff" sub="Volume de comparaisons par dépôt" />
              {stats.parProjet.filter(p => p.diff > 0).length === 0 ? (
                <div style={{ height:280, display:"flex", alignItems:"center", justifyContent:"center", color:"#3a4060", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.parProjet.filter(p=>p.diff>0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2538" />
                    <XAxis type="number" stroke="#3a4060" fontSize={10} fontFamily="'JetBrains Mono',monospace" />
                    <YAxis type="category" dataKey="projet" stroke="#3a4060" fontSize={10}
                      fontFamily="'JetBrains Mono',monospace" width={120}
                      tickFormatter={v => v.length > 14 ? v.slice(0,14)+"…" : v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="diff" name="Analyses diff" fill={COLORS.pink} radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ── GRAPHIQUE 4 : Décisions diff + Pie ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Section>
              <SectionTitle icon="⚡" title="Décisions des analyses diff" sub="Résultats IA pour toutes les comparaisons de branches" />
              {pieData.length === 0 ? (
                <div style={{ height:260, display:"flex", alignItems:"center", justifyContent:"center", color:"#3a4060", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>
                  Aucune analyse diff effectuée
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={90} innerRadius={50} paddingAngle={3}
                      label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                      labelLine={{ stroke:"#3a4060" }}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke={entry.color + "33"} strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Section>

            <Section>
              <SectionTitle icon="🔀" title="Types de Merge Requests" sub="Répartition par catégorie — toute la plateforme" />
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:8 }}>
                {[
                  { icon:"🧪", label:"MR Tests IA",    value:stats.mrTests, color:COLORS.purple, pct:stats.totalMR ? Math.round(stats.mrTests/stats.totalMR*100) : 0 },
                  { icon:"⚡", label:"MR Auto-merge",  value:stats.mrAuto,  color:COLORS.amber,  pct:stats.totalMR ? Math.round(stats.mrAuto /stats.totalMR*100) : 0 },
                  { icon:"⚠️",label:"MR Forcées",     value:stats.mrForce, color:COLORS.red,    pct:stats.totalMR ? Math.round(stats.mrForce/stats.totalMR*100) : 0 },
                ].map(item => (
                  <div key={item.label} style={{ padding:"13px 16px", background:`${item.color}0e`, border:`1px solid ${item.color}20`, borderRadius:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ fontSize:12, color:item.color, fontFamily:"'JetBrains Mono',monospace", display:"flex", alignItems:"center", gap:6 }}>
                        <span>{item.icon}</span>{item.label}
                      </span>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:10, color:item.color, fontFamily:"'JetBrains Mono',monospace" }}>{item.pct}%</span>
                        <span style={{ fontSize:24, fontWeight:800, color:item.color, fontFamily:"'JetBrains Mono',monospace" }}>{item.value}</span>
                      </div>
                    </div>
                    <div style={{ height:4, background:"#1e2538", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${item.pct}%`, background:item.color, borderRadius:2, transition:"width 0.7s ease" }}/>
                    </div>
                  </div>
                ))}
                {stats.totalMR === 0 && (
                  <p style={{ color:"#3a4060", fontSize:11, textAlign:"center", padding:"16px 0", fontFamily:"'JetBrains Mono',monospace" }}>Aucune Merge Request créée</p>
                )}
              </div>
            </Section>
          </div>

          {/* ── GRAPHIQUE 5 : MR par projet ── */}
          {stats.mrParProjet.length > 0 && (
            <Section>
              <SectionTitle icon="📊" title="Merge Requests par projet" sub="Tests IA (indigo) · Auto-merge (ambre) · Forcées (rouge)" />
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stats.mrParProjet}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2538" />
                  <XAxis dataKey="projet" stroke="#3a4060" fontSize={10} fontFamily="'JetBrains Mono',monospace"
                    angle={-35} textAnchor="end" height={70}
                    tickFormatter={v => v.length > 12 ? v.slice(0,12)+"…" : v} />
                  <YAxis stroke="#3a4060" fontSize={10} fontFamily="'JetBrains Mono',monospace" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color:"#5a6080", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }} />
                  <Bar dataKey="tests"     name="🧪 Tests IA"    stackId="a" fill={COLORS.indigo} radius={[0,0,0,0]} />
                  <Bar dataKey="autoMerge" name="⚡ Auto-merge"  stackId="a" fill={COLORS.amber}  />
                  <Bar dataKey="force"     name="⚠️ Forcées"    stackId="a" fill={COLORS.red}    radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* ── RÉCAPITULATIF ── */}
          <Section>
            <SectionTitle icon="📋" title="Récapitulatif global" sub="Vue d'ensemble de l'activité de la plateforme" />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
              {[
                { label:"Total analyses",        value: stats.totalSimples + stats.totalDiff,              color: COLORS.indigo },
                { label:"Projets actifs",          value: stats.parProjet.length,                           color: COLORS.cyan   },
                { label:"Projets avec simples",    value: stats.parProjet.filter(p=>p.simples>0).length,    color: COLORS.green  },
                { label:"Projets avec diff",       value: stats.parProjet.filter(p=>p.diff>0).length,       color: COLORS.pink   },
                { label:"Total MR créées",         value: stats.totalMR,                                    color: COLORS.amber  },
                { label:"Taux d'autorisation",     value: `${tauxMerge}%`,                                  color: tauxMerge>=70?COLORS.green:tauxMerge>=40?COLORS.amber:COLORS.red },
                { label:"Utilisateurs actifs",     value: `${stats.activeUsers}/${stats.totalUsers}`,        color: "#5b63f5"     },
                { label:"Dépôts / utilisateur",    value: stats.totalUsers ? (stats.totalDepots/stats.totalUsers).toFixed(1)+" moy" : "—", color: COLORS.cyan },
              ].map(s => (
                <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", background:"#07090f", borderRadius:9, border:"1px solid #1e2538" }}>
                  <span style={{ fontSize:11, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace" }}>{s.label}</span>
                  <b style={{ fontSize:16, color:s.color, fontFamily:"'JetBrains Mono',monospace" }}>{s.value}</b>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </AdminLayout>
  );
}
