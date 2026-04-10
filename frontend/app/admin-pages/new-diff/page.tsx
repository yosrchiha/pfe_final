"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, StatusBadge } from "../adminUtils";
import type { UserItem } from "../adminUtils";

export default function AdminNewDiffPage() {
  const [users, setUsers]     = useState<UserItem[]>([]);
  const [selUser, setSelUser] = useState("");
  const [depots, setDepots]   = useState<any[]>([]);
  const [selDepot, setSelDepot] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch]     = useState("");
  const [step, setStep]       = useState<"idle"|"running"|"done"|"error">("idle");
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState("");

  useEffect(() => {
    axios.get(`${API}/admin/users`, { headers: getHeaders() }).then(r => setUsers(r.data)).catch(()=>{});
  }, []);

  async function onUser(uid: string) {
    setSelUser(uid); setSelDepot(""); setBranches([]); setFromBranch(""); setToBranch(""); setResult(null); setError("");
    if (!uid) return;
    try {
      const r = await axios.get(`${API}/depots/user/${uid}`, { headers: getHeaders() });
      setDepots(r.data);
    } catch { setDepots([]); }
  }

  async function onDepot(did: string) {
    setSelDepot(did); setBranches([]); setFromBranch(""); setToBranch(""); setResult(null); setError("");
    if (!did) return;
    try {
      const r = await axios.get(`${API}/depots/${did}/branches`, { headers: getHeaders() });
      setBranches(r.data.branches || r.data || []);
    } catch { setBranches([]); }
  }

  async function runDiff() {
    if (!selDepot || !fromBranch || !toBranch) return;
    setStep("running"); setResult(null); setError("");
    try {
      // 1. créer comparaison
      const cmpRes = await axios.post(`${API}/comparaisons/`, { depot_id: parseInt(selDepot), from_branch: fromBranch, to_branch: toBranch }, { headers: getHeaders() });
      const cmpId = cmpRes.data.id;
      // 2. lancer analyse diff
      const aRes = await axios.post(`${API}/comparaisons/${cmpId}/analyser`, {}, { headers: getHeaders() });
      setResult({ ...aRes.data, cmpId });
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Erreur lors de l'analyse diff.");
      setStep("error");
    }
  }

  const scoreColor = (s: number) => s>=80?"#22c55e":s>=60?"#f59e0b":"#f87171";

  const BranchSelect = ({ label, value, onChange, exclude }: { label: string; value: string; onChange: (v:string)=>void; exclude?: string }) => (
    <div>
      <label style={{ display:"block", fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{label}</label>
      {branches.length > 0 ? (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {branches.filter(b=>b!==exclude).map(b=>(
            <button key={b} onClick={()=>onChange(b)} style={{ padding:"7px 14px", background:value===b?"rgba(91,99,245,0.14)":"transparent", border:`1px solid ${value===b?"rgba(91,99,245,0.4)":"#1e2235"}`, borderRadius:8, color:value===b?"#818cf8":"#5a6080", fontSize:12, fontFamily:"'JetBrains Mono',monospace", cursor:"pointer", fontWeight:600 }}>
              {b}
            </button>
          ))}
        </div>
      ) : (
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder="main, develop..." style={{ width:"100%", padding:"11px 14px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:10, color:"#f1f3fc", fontSize:12, fontFamily:"'JetBrains Mono',monospace", outline:"none" }} />
      )}
    </div>
  );

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>
        <PageHeader icon="⇌" title="Analyse Diff" sub="Comparer deux branches avec l'IA" />

        <div style={{ padding:"32px 36px", maxWidth:700 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

            {/* User */}
            <div>
              <label style={{ display:"block", fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Utilisateur</label>
              <select value={selUser} onChange={e=>onUser(e.target.value)} style={{ width:"100%", padding:"12px 14px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:10, color:selUser?"#f1f3fc":"#5a6080", fontSize:13, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}>
                <option value="">— Choisir un utilisateur —</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>

            {/* Depot */}
            {selUser && (
              <div style={{ animation:"fadeIn 0.2s ease" }}>
                <label style={{ display:"block", fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Dépôt GitLab</label>
                <select value={selDepot} onChange={e=>onDepot(e.target.value)} style={{ width:"100%", padding:"12px 14px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:10, color:selDepot?"#f1f3fc":"#5a6080", fontSize:13, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}>
                  <option value="">— Choisir un dépôt —</option>
                  {depots.map(d=><option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
            )}

            {/* Branches */}
            {selDepot && (
              <div style={{ animation:"fadeIn 0.2s ease", display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:14, alignItems:"center" }}>
                <BranchSelect label="Branche source (FROM)" value={fromBranch} onChange={setFromBranch} exclude={toBranch} />
                <div style={{ paddingTop:22, color:"#3a4060", fontSize:18, fontFamily:"'JetBrains Mono',monospace" }}>→</div>
                <BranchSelect label="Branche cible (TO)" value={toBranch} onChange={setToBranch} exclude={fromBranch} />
              </div>
            )}

            {/* Preview */}
            {fromBranch && toBranch && step === "idle" && (
              <div style={{ animation:"fadeIn 0.2s ease", background:"rgba(91,99,245,0.06)", border:"1px solid rgba(91,99,245,0.2)", borderRadius:12, padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
                <code style={{ background:"rgba(245,158,11,0.12)", color:"#f59e0b", padding:"4px 10px", borderRadius:7, fontSize:12, border:"1px solid rgba(245,158,11,0.2)" }}>{fromBranch}</code>
                <span style={{ color:"#5b63f5", fontSize:16 }}>⇄</span>
                <code style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa", padding:"4px 10px", borderRadius:7, fontSize:12, border:"1px solid rgba(96,165,250,0.2)" }}>{toBranch}</code>
                <span style={{ color:"#5a6080", fontSize:11, fontFamily:"'JetBrains Mono',monospace", marginLeft:"auto" }}>L'IA va analyser les différences</span>
              </div>
            )}

            {/* CTA */}
            {fromBranch && toBranch && step === "idle" && (
              <button onClick={runDiff} style={{ padding:"14px", background:"linear-gradient(135deg,#5b63f5,#ec4899)", border:"none", borderRadius:12, color:"#fff", fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:800, cursor:"pointer", boxShadow:"0 4px 24px rgba(91,99,245,0.3)" }}>
                ⇄ Lancer l'analyse diff
              </button>
            )}

            {/* Running */}
            {step === "running" && (
              <div style={{ animation:"fadeIn 0.2s ease", background:"rgba(91,99,245,0.08)", border:"1px solid rgba(91,99,245,0.2)", borderRadius:14, padding:"32px", textAlign:"center" }}>
                <div style={{ width:36, height:36, border:"2px solid #1e2235", borderTopColor:"#5b63f5", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
                <p style={{ color:"#818cf8", fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>Comparaison des branches en cours...</p>
              </div>
            )}

            {/* Error */}
            {step === "error" && (
              <div style={{ animation:"fadeIn 0.2s ease", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:14, padding:"20px", display:"flex", gap:14, alignItems:"center" }}>
                <span style={{ fontSize:24 }}>⊗</span>
                <div><p style={{ color:"#f87171", fontWeight:700 }}>Erreur</p><p style={{ color:"#a8b0d0", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>{error}</p></div>
                <button onClick={()=>setStep("idle")} style={{ marginLeft:"auto", background:"none", border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, color:"#f87171", padding:"6px 14px", cursor:"pointer", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>Réessayer</button>
              </div>
            )}

            {/* Result */}
            {step === "done" && result && (
              <div style={{ animation:"fadeIn 0.3s ease", background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:14, padding:"24px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                  <span style={{ fontSize:22 }}>✓</span>
                  <div>
                    <p style={{ color:"#22c55e", fontWeight:700, fontSize:15 }}>Analyse diff terminée</p>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                      <code style={{ color:"#f59e0b", fontSize:11 }}>{fromBranch}</code>
                      <span style={{ color:"#5a6080" }}>→</span>
                      <code style={{ color:"#60a5fa", fontSize:11 }}>{toBranch}</code>
                    </div>
                  </div>
                  <div style={{ marginLeft:"auto" }}>
                    <StatusBadge status={result.resultat_statut||result.statut} />
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                  {[
                    { label:"Qualité",  score:result.score_qualite||0 },
                    { label:"Sécurité", score:result.score_securite||0 },
                  ].map(s=>(
                    <div key={s.label} style={{ background:"#07090f", borderRadius:10, padding:"14px", textAlign:"center", border:`1px solid ${scoreColor(s.score)}30` }}>
                      <div style={{ fontSize:28, fontWeight:800, color:scoreColor(s.score) }}>{s.score}</div>
                      <div style={{ fontSize:10, color:"#a8b0d0", fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <button onClick={()=>{setStep("idle");setResult(null);setFromBranch("");setToBranch("");}} style={{ marginTop:16, width:"100%", padding:"10px", background:"rgba(91,99,245,0.1)", border:"1px solid rgba(91,99,245,0.25)", borderRadius:9, color:"#818cf8", cursor:"pointer", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                  Nouvelle comparaison
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
