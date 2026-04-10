"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, ScorePill, StatusBadge, EmptyRow, Loader, ErrorState, SearchInput } from "../adminUtils";
import type { AnalyseDiff, UserItem } from "../adminUtils";

export default function AdminDiffsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [diffs, setDiffs]     = useState<AnalyseDiff[]>([]);
  const [search, setSearch]   = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const usersRes = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      const all: AnalyseDiff[] = [];
      for (const u of usersRes.data as UserItem[]) {
        try {
          const dr = await axios.get(`${API}/depots/user/${u.id}`, { headers: getHeaders() });
          for (const d of dr.data) {
            try {
              const cr = await axios.get(`${API}/comparaisons/depot/${d.id}`, { headers: getHeaders() });
              for (const c of cr.data) {
                try {
                  const ar = await axios.get(`${API}/comparaisons/${c.id}/analyses`, { headers: getHeaders() });
                  for (const a of ar.data) {
                    all.push({ id:a.id, projet_nom:d.nom, user_email:u.email, from_branch:c.from_branch, to_branch:c.to_branch, score_qualite:a.score_qualite||0, score_securite:a.score_securite||0, resultat_statut:a.resultat_statut||a.statut, created_at:a.created_at||"" });
                  }
                } catch {}
              }
            } catch {}
          }
        } catch {}
      }
      setDiffs(all);
    } catch { setError("Erreur de chargement."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = diffs.filter(d =>
    d.projet_nom?.toLowerCase().includes(search.toLowerCase()) ||
    d.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    d.from_branch?.toLowerCase().includes(search.toLowerCase()) ||
    d.to_branch?.toLowerCase().includes(search.toLowerCase())
  );

  const autorise  = diffs.filter(d=>d.resultat_statut==="merge_autorise").length;
  const bloque    = diffs.filter(d=>d.resultat_statut==="merge_bloque").length;
  const force     = diffs.filter(d=>d.resultat_statut==="merge_autorise_force").length;

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {loading ? <Loader message="Chargement des analyses diff..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <PageHeader icon="⇄" title="Analyses Diff" count={filtered.length} sub="Comparaisons de branches analysées par l'IA" onRefresh={load} />

          <div style={{ padding:"24px 36px", flex:1 }}>
            {/* DECISION CARDS */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:24 }}>
              {[
                { label:"Total",         value:diffs.length, color:"#5b63f5" },
                { label:"Autorisé",      value:autorise,     color:"#22c55e" },
                { label:"Bloqué",        value:bloque,       color:"#f87171" },
                { label:"Forcé",         value:force,        color:"#f59e0b" },
                { label:"Taux accord",   value:diffs.length ? `${Math.round((autorise+force)/diffs.length*100)}%` : "—", color:"#60a5fa" },
              ].map(m=>(
                <div key={m.label} style={{ background:`${m.color}10`, border:`1px solid ${m.color}28`, borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:22, fontWeight:800, color:m.color }}>{m.value}</div>
                  <div style={{ fontSize:10, color:"#a8b0d0", fontFamily:"'JetBrains Mono',monospace", marginTop:3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Projet, email ou branche..." />
            </div>

            <DataTable>
              <thead><tr>
                <TH>ID</TH><TH>Projet</TH><TH>Utilisateur</TH>
                <TH>Branche source</TH><TH>Branche cible</TH>
                <TH center>Qualité</TH><TH center>Sécurité</TH>
                <TH center>Décision IA</TH><TH>Date</TH>
              </tr></thead>
              <tbody>
                {filtered.map((d,i)=>(
                  <tr key={d.id} style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.015)", animation:"fadeIn 0.25s ease backwards", animationDelay:`${i*0.03}s` }}>
                    <TD><span style={{ color:"#3a4060", fontSize:10 }}>#{d.id}</span></TD>
                    <TD><b style={{ color:"#f1f3fc" }}>📁 {d.projet_nom||"—"}</b></TD>
                    <TD><span style={{ color:"#818cf8", fontSize:11 }}>{d.user_email||"—"}</span></TD>
                    <TD>
                      <code style={{ background:"rgba(245,158,11,0.12)", color:"#f59e0b", padding:"2px 8px", borderRadius:6, fontSize:10, border:"1px solid rgba(245,158,11,0.2)" }}>
                        {d.from_branch||"—"}
                      </code>
                    </TD>
                    <TD>
                      <code style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa", padding:"2px 8px", borderRadius:6, fontSize:10, border:"1px solid rgba(96,165,250,0.2)" }}>
                        {d.to_branch||"—"}
                      </code>
                    </TD>
                    <TD center><ScorePill score={d.score_qualite} /></TD>
                    <TD center><ScorePill score={d.score_securite} /></TD>
                    <TD center><StatusBadge status={d.resultat_statut} /></TD>
                    <TD><span style={{ color:"#5a6080", fontSize:11 }}>{d.created_at?.split("T")[0]||d.created_at?.split(" ")[0]||"—"}</span></TD>
                  </tr>
                ))}
                {filtered.length===0 && <EmptyRow cols={9} message="Aucune analyse diff disponible" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
