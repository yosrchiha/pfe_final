"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, ActionBtn, SearchInput, EmptyRow, Loader, ErrorState, ScorePill, StatusBadge } from "../adminUtils";
import type { DepotItem, Analyse, UserItem } from "../adminUtils";

export default function AdminDepotsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [depots, setDepots]   = useState<DepotItem[]>([]);
  const [search, setSearch]   = useState("");
  const [toast, setToast]     = useState("");
  const [modal, setModal]     = useState<{ depot: DepotItem; analyses: Analyse[] } | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true); setError("");
    try {
      const usersRes = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      const allDepots: DepotItem[] = [];
      for (const user of usersRes.data as UserItem[]) {
        try {
          const r = await axios.get(`${API}/analyses/depots-user/${user.id}`, { headers: getHeaders() });
          for (const d of r.data) {
            let cnt = 0;
            try { const ar = await axios.get(`${API}/analyses/depot/${d.id}`, { headers: getHeaders() }); cnt = ar.data.length; } catch {}
            allDepots.push({ id: d.id, nom: d.nom, project_url: d.project_url, branche: d.branche, user_id: user.id, user_email: user.email, created_at: d.created_at?.split("T")[0] || "", analyses_count: cnt });
          }
        } catch {}
      }
      setDepots(allDepots);
    } catch (e: any) { setError("Erreur de chargement."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  async function deleteDepot(id: number) {
    try {
      await axios.delete(`${API}/admin/depots/${id}`, { headers: getHeaders() });
      setDepots(p => p.filter(d => d.id !== id));
      setModal(null);
      showToast("Dépôt supprimé.");
    } catch { showToast("Erreur lors de la suppression."); }
  }

  async function openModal(depot: DepotItem) {
    setLoadingModal(true);
    setModal({ depot, analyses: [] });
    try {
      const r = await axios.get(`${API}/analyses/depot/${depot.id}`, { headers: getHeaders() });
      setModal({ depot, analyses: r.data.map((a: any) => ({
        id: a.id, depot_id: depot.id, depot_nom: depot.nom, user_email: depot.user_email,
        branche: a.branche || "—", score_qualite: a.score_qualite || 0,
        score_securite: a.score_securite || 0, score_performance: a.score_performance || 0,
        statut: a.statut, created_at: a.created_at?.split("T")[0] || "",
        nb_vulns: a.vulnerabilites?.length || 0,
      })) });
    } catch {}
    setLoadingModal(false);
  }

  const filtered = depots.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    d.user_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
      {loading ? <Loader message="Chargement des dépôts..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <PageHeader icon="▣" title="Dépôts GitLab" count={filtered.length} sub="Tous les projets de la plateforme" onRefresh={load} />

          <div style={{ padding:"24px 36px", flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
              <div style={{ display:"flex", gap:10 }}>
                {[
                  { label:"Total dépôts", value:depots.length,  color:"#5b63f5" },
                  { label:"Total analyses", value:depots.reduce((s,d)=>s+d.analyses_count,0), color:"#22c55e" },
                ].map(p=>(
                  <div key={p.label} style={{ background:`${p.color}12`, border:`1px solid ${p.color}30`, borderRadius:9, padding:"7px 14px", display:"flex", gap:8, alignItems:"center" }}>
                    <b style={{ color:p.color, fontSize:18, fontWeight:800 }}>{p.value}</b>
                    <span style={{ color:"#a8b0d0", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.label}</span>
                  </div>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Dépôt ou email..." />
            </div>

            <DataTable>
              <thead><tr>
                <TH>ID</TH><TH>Nom du projet</TH><TH>URL</TH><TH>Branche</TH>
                <TH>Propriétaire</TH><TH center>Analyses</TH><TH>Date</TH><TH center>Actions</TH>
              </tr></thead>
              <tbody>
                {filtered.map((d,i)=>(
                  <tr key={d.id} style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.015)", animation:"fadeIn 0.25s ease backwards", animationDelay:`${i*0.03}s` }}>
                    <TD><span style={{ color:"#3a4060", fontSize:10 }}>#{d.id}</span></TD>
                    <TD><b style={{ color:"#f1f3fc" }}>📁 {d.nom}</b></TD>
                    <TD>
                      <code style={{ color:"#5a6080", fontSize:10, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", display:"block" }}>
                        {d.project_url}
                      </code>
                    </TD>
                    <TD>
                      <code style={{ background:"rgba(91,99,245,0.1)", color:"#818cf8", padding:"2px 8px", borderRadius:6, fontSize:10 }}>
                        {d.branche}
                      </code>
                    </TD>
                    <TD><span style={{ color:"#818cf8", fontSize:11 }}>{d.user_email}</span></TD>
                    <TD center>
                      <b style={{ color: d.analyses_count > 0 ? "#5b63f5" : "#3a4060", fontSize:14 }}>{d.analyses_count}</b>
                    </TD>
                    <TD><span style={{ color:"#5a6080", fontSize:11 }}>{d.created_at}</span></TD>
                    <TD center>
                      <div style={{ display:"flex", gap:5, justifyContent:"center" }}>
                        <ActionBtn onClick={()=>openModal(d)} color="blue">📊 Analyses</ActionBtn>
                        <ActionBtn onClick={()=>{ if(confirm("Supprimer ce dépôt ?")) deleteDepot(d.id); }} color="red">Supprimer</ActionBtn>
                      </div>
                    </TD>
                  </tr>
                ))}
                {filtered.length===0 && <EmptyRow cols={8} message="Aucun dépôt trouvé" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#0f1117", border:"1px solid #1e2235", borderRadius:20, maxWidth:900, width:"100%", maxHeight:"80vh", overflow:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.7)", animation:"fadeIn 0.2s ease" }}>
            <div style={{ padding:"22px 28px", borderBottom:"1px solid #1e2235", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#0f1117", zIndex:1 }}>
              <div>
                <p style={{ fontSize:11, color:"#5b63f5", fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>DÉPÔT · #{modal.depot.id}</p>
                <h3 style={{ fontSize:17, fontWeight:800, color:"#f1f3fc" }}>📁 {modal.depot.nom}</h3>
                <p style={{ fontSize:11, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace" }}>{modal.depot.user_email} · {modal.depot.branche}</p>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <ActionBtn onClick={()=>{ if(confirm("Supprimer ?")) deleteDepot(modal.depot.id); }} color="red">🗑 Supprimer</ActionBtn>
                <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#5a6080" }}>✕</button>
              </div>
            </div>
            <div style={{ padding:"22px 28px" }}>
              <p style={{ fontWeight:700, marginBottom:16, color:"#f1f3fc", fontSize:13 }}>
                Analyses ({loadingModal ? "..." : modal.analyses.length})
              </p>
              {loadingModal ? (
                <div style={{ textAlign:"center", padding:40, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>Chargement...</div>
              ) : (
                <DataTable>
                  <thead><tr><TH>ID</TH><TH>Date</TH><TH>Branche</TH><TH center>Qualité</TH><TH center>Sécurité</TH><TH center>Perf.</TH><TH center>Vulns</TH><TH center>Statut</TH></tr></thead>
                  <tbody>
                    {modal.analyses.map(a=>(
                      <tr key={a.id}>
                        <TD><span style={{ color:"#3a4060", fontSize:10 }}>#{a.id}</span></TD>
                        <TD><span style={{ fontSize:11, color:"#5a6080" }}>{a.created_at}</span></TD>
                        <TD><code style={{ color:"#818cf8", fontSize:10 }}>{a.branche}</code></TD>
                        <TD center><ScorePill score={a.score_qualite} /></TD>
                        <TD center><ScorePill score={a.score_securite} /></TD>
                        <TD center><ScorePill score={a.score_performance} /></TD>
                        <TD center><b style={{ color:a.nb_vulns>0?"#f87171":"#22c55e", fontSize:13 }}>{a.nb_vulns}</b></TD>
                        <TD center><StatusBadge status={a.statut} /></TD>
                      </tr>
                    ))}
                    {modal.analyses.length===0 && <EmptyRow cols={8} message="Aucune analyse pour ce dépôt" />}
                  </tbody>
                </DataTable>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:"#0f1117", border:"1px solid rgba(91,99,245,0.3)", borderRadius:10, padding:"12px 20px", color:"#818cf8", fontSize:12, fontFamily:"'JetBrains Mono',monospace", boxShadow:"0 8px 32px rgba(0,0,0,0.4)", zIndex:2000, animation:"fadeIn 0.2s ease" }}>✓ {toast}</div>
      )}
    </AdminLayout>
  );
}


