// ══════════════════════════════════════════════════════════════════════════════
// TESTS PAGE
// ══════════════════════════════════════════════════════════════════════════════
"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, StatusBadge, EmptyRow, Loader, ErrorState, SearchInput } from "../adminUtils";
import type { TestGenere, UserItem } from "../adminUtils";

export default function AdminTestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tests, setTests]     = useState<TestGenere[]>([]);
  const [search, setSearch]   = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const usersRes = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      const all: TestGenere[] = [];
      for (const u of usersRes.data as UserItem[]) {
        try {
          const dr = await axios.get(`${API}/analyses/depots-user/${u.id}`, { headers: getHeaders() });
          for (const d of dr.data) {
            try {
              const tr = await axios.get(`${API}/tests/depot/${d.id}`, { headers: getHeaders() });
              for (const t of tr.data) {
                all.push({ id:t.id, projet_nom:d.nom, user_email:u.email, langage:t.langage||"—", framework:t.framework||"—", nb_tests:t.nb_tests||0, statut:t.statut, created_at:t.created_at?.split("T")[0]||"" });
              }
            } catch {}
          }
        } catch {}
      }
      setTests(all);
    } catch { setError("Erreur de chargement."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = tests.filter(t =>
    t.projet_nom?.toLowerCase().includes(search.toLowerCase()) ||
    t.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    t.langage?.toLowerCase().includes(search.toLowerCase())
  );

  const totalTests = tests.reduce((s,t)=>s+t.nb_tests,0);

  const LANG_COLORS: Record<string,string> = {
    python:"#3b82f6", javascript:"#f59e0b", typescript:"#60a5fa",
    java:"#ef4444", go:"#22c55e", php:"#8b5cf6", ruby:"#ec4899",
  };

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {loading ? <Loader message="Chargement des tests..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <PageHeader icon="◎" title="Tests Générés" count={filtered.length} sub="Tests unitaires produits par l'IA" onRefresh={load} />

          <div style={{ padding:"24px 36px", flex:1 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:24 }}>
              {[
                { label:"Générations",   value:tests.length,  color:"#5b63f5" },
                { label:"Tests totaux",  value:totalTests,    color:"#22c55e" },
                { label:"Réussis",       value:tests.filter(t=>t.statut==="genere"||t.statut==="termine").length, color:"#60a5fa" },
                { label:"Moy. par gen.", value:tests.length?Math.round(totalTests/tests.length):"—", color:"#f59e0b" },
              ].map(m=>(
                <div key={m.label} style={{ background:`${m.color}10`, border:`1px solid ${m.color}28`, borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:22, fontWeight:800, color:m.color }}>{m.value}</div>
                  <div style={{ fontSize:10, color:"#a8b0d0", fontFamily:"'JetBrains Mono',monospace", marginTop:3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Projet, email ou langage..." />
            </div>

            <DataTable>
              <thead><tr>
                <TH>ID</TH><TH>Projet</TH><TH>Utilisateur</TH><TH>Langage</TH>
                <TH>Framework</TH><TH center>Nb tests</TH><TH center>Statut</TH><TH>Date</TH>
              </tr></thead>
              <tbody>
                {filtered.map((t,i)=>{
                  const lc = LANG_COLORS[t.langage?.toLowerCase()] || "#818cf8";
                  return (
                    <tr key={t.id} style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.015)", animation:"fadeIn 0.25s ease backwards", animationDelay:`${i*0.03}s` }}>
                      <TD><span style={{ color:"#3a4060", fontSize:10 }}>#{t.id}</span></TD>
                      <TD><b style={{ color:"#f1f3fc" }}>📁 {t.projet_nom}</b></TD>
                      <TD><span style={{ color:"#818cf8", fontSize:11 }}>{t.user_email}</span></TD>
                      <TD>
                        <span style={{ background:`${lc}18`, color:lc, padding:"3px 10px", borderRadius:20, fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, border:`1px solid ${lc}30` }}>
                          {t.langage}
                        </span>
                      </TD>
                      <TD><code style={{ background:"rgba(129,140,248,0.1)", color:"#818cf8", padding:"2px 7px", borderRadius:6, fontSize:10 }}>{t.framework}</code></TD>
                      <TD center>
                        <b style={{ color:"#8b5cf6", fontSize:16, fontFamily:"'Syne',sans-serif" }}>{t.nb_tests}</b>
                      </TD>
                      <TD center><StatusBadge status={t.statut} /></TD>
                      <TD><span style={{ color:"#5a6080", fontSize:11 }}>{t.created_at}</span></TD>
                    </tr>
                  );
                })}
                {filtered.length===0 && <EmptyRow cols={8} message="Aucun test généré" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}


