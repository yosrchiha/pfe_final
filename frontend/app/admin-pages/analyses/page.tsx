"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, ScorePill, StatusBadge, EmptyRow, Loader, ErrorState, SearchInput } from "../adminUtils";
import type { Analyse, UserItem } from "../adminUtils";

export default function AdminAnalysesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [analyses, setAnalyses] = useState<Analyse[]>([]);
  const [search, setSearch]   = useState("");
  const [filterStatut, setFilterStatut] = useState("all");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const usersRes = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      const all: Analyse[] = [];
      for (const u of usersRes.data as UserItem[]) {
        try {
          const dr = await axios.get(`${API}/analyses/depots-user/${u.id}`, { headers: getHeaders() });
          for (const d of dr.data) {
            try {
              const ar = await axios.get(`${API}/analyses/depot/${d.id}`, { headers: getHeaders() });
              for (const a of ar.data) {
                all.push({
                  id: a.id, depot_id: d.id, depot_nom: d.nom, user_email: u.email,
                  branche: a.branche || "—", score_qualite: a.score_qualite || 0,
                  score_securite: a.score_securite || 0, score_performance: a.score_performance || 0,
                  statut: a.statut, created_at: a.created_at?.split("T")[0] || "",
                  nb_vulns: a.vulnerabilites?.length || 0,
                });
              }
            } catch {}
          }
        } catch {}
      }
      setAnalyses(all);
    } catch { setError("Erreur de chargement."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = analyses.filter(a =>
    (filterStatut === "all" || a.statut === filterStatut) &&
    (a.depot_nom.toLowerCase().includes(search.toLowerCase()) ||
     a.user_email.toLowerCase().includes(search.toLowerCase()))
  );

  const avgQualite  = analyses.length ? Math.round(analyses.reduce((s,a)=>s+a.score_qualite,0)/analyses.length) : 0;
  const avgSecurite = analyses.length ? Math.round(analyses.reduce((s,a)=>s+a.score_securite,0)/analyses.length) : 0;
  const terminees   = analyses.filter(a=>a.statut==="termine").length;

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {loading ? <Loader message="Chargement des analyses..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <PageHeader icon="◉" title="Analyses IA" count={filtered.length} sub="Résultats d'analyse de branche complète" onRefresh={load} />

          <div style={{ padding:"24px 36px", flex:1 }}>
            {/* METRICS */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:24 }}>
              {[
                { label:"Total analyses", value:analyses.length,       color:"#5b63f5" },
                { label:"Terminées",      value:terminees,             color:"#22c55e" },
                { label:"En erreur",      value:analyses.filter(a=>a.statut==="erreur").length, color:"#f87171" },
                { label:"Qualité moy.",   value:`${avgQualite}/100`,   color:"#60a5fa" },
                { label:"Sécurité moy.",  value:`${avgSecurite}/100`,  color:"#f59e0b" },
                { label:"Total vulns",    value:analyses.reduce((s,a)=>s+a.nb_vulns,0), color:"#ec4899" },
              ].map(m=>(
                <div key={m.label} style={{ background:`${m.color}10`, border:`1px solid ${m.color}28`, borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:22, fontWeight:800, color:m.color }}>{m.value}</div>
                  <div style={{ fontSize:10, color:"#a8b0d0", fontFamily:"'JetBrains Mono',monospace", marginTop:3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* FILTERS */}
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", justifyContent:"space-between" }}>
              <div style={{ display:"flex", gap:6 }}>
                {["all","termine","en_cours","erreur"].map(s=>(
                  <button key={s} onClick={()=>setFilterStatut(s)} style={{
                    padding:"6px 14px", border:`1px solid ${filterStatut===s?"rgba(91,99,245,0.4)":"#1e2235"}`,
                    background:filterStatut===s?"rgba(91,99,245,0.12)":"transparent",
                    borderRadius:8, color:filterStatut===s?"#818cf8":"#5a6080",
                    fontSize:11, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                  }}>
                    {s==="all"?"Tous":s==="termine"?"Terminées":s==="en_cours"?"En cours":"Erreurs"}
                  </button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Dépôt ou email..." />
            </div>

            <DataTable>
              <thead><tr>
                <TH>ID</TH><TH>Dépôt</TH><TH>Utilisateur</TH><TH>Branche</TH>
                <TH center>Qualité</TH><TH center>Sécurité</TH><TH center>Perf.</TH>
                <TH center>Vulns</TH><TH center>Statut</TH><TH>Date</TH>
              </tr></thead>
              <tbody>
                {filtered.map((a,i)=>(
                  <tr key={a.id} style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.015)", animation:"fadeIn 0.25s ease backwards", animationDelay:`${i*0.03}s` }}>
                    <TD><span style={{ color:"#3a4060", fontSize:10 }}>#{a.id}</span></TD>
                    <TD><b style={{ color:"#f1f3fc" }}>📁 {a.depot_nom}</b></TD>
                    <TD><span style={{ color:"#818cf8", fontSize:11 }}>{a.user_email}</span></TD>
                    <TD><code style={{ background:"rgba(91,99,245,0.1)", color:"#818cf8", padding:"2px 7px", borderRadius:6, fontSize:10 }}>{a.branche}</code></TD>
                    <TD center><ScorePill score={a.score_qualite} /></TD>
                    <TD center><ScorePill score={a.score_securite} /></TD>
                    <TD center><ScorePill score={a.score_performance} /></TD>
                    <TD center>
                      <span style={{ background:a.nb_vulns>5?"rgba(248,113,113,0.12)":a.nb_vulns>0?"rgba(245,158,11,0.12)":"rgba(34,197,94,0.12)", color:a.nb_vulns>5?"#f87171":a.nb_vulns>0?"#f59e0b":"#22c55e", fontWeight:700, padding:"2px 10px", borderRadius:20, fontSize:11, fontFamily:"'JetBrains Mono',monospace", border:`1px solid ${a.nb_vulns>5?"rgba(248,113,113,0.2)":a.nb_vulns>0?"rgba(245,158,11,0.2)":"rgba(34,197,94,0.2)"}` }}>
                        {a.nb_vulns}
                      </span>
                    </TD>
                    <TD center><StatusBadge status={a.statut} /></TD>
                    <TD><span style={{ color:"#5a6080", fontSize:11 }}>{a.created_at}</span></TD>
                  </tr>
                ))}
                {filtered.length===0 && <EmptyRow cols={10} message="Aucune analyse trouvée" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
