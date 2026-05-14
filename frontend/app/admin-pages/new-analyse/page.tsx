"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader } from "../adminUtils";
import type { UserItem } from "../adminUtils";

export default function AdminNewAnalysePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [depots, setDepots]   = useState<any[]>([]);
  const [selectedDepot, setSelectedDepot] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading]  = useState(false);
  const [loadingDepots, setLoadingDepots] = useState(false);
  const [result, setResult]    = useState<any>(null);
  const [error, setError]      = useState("");
  const [step, setStep]        = useState<"idle"|"running"|"done"|"error">("idle");

  useEffect(() => {
    axios.get(`${API}/admin/users`, { headers: getHeaders() })
      .then(r => setUsers(r.data)).catch(() => {});
  }, []);

  async function handleUserChange(uid: string) {
    setSelectedUser(uid);
    setSelectedDepot(""); setBranches([]); setSelectedBranch(""); setResult(null); setError("");
    if (!uid) return;
    setLoadingDepots(true);
    try {
      const r = await axios.get(`${API}/analyses/depots-user/${uid}`, { headers: getHeaders() });
      setDepots(r.data);
    } catch { setDepots([]); }
    setLoadingDepots(false);
  }

  async function handleDepotChange(did: string) {
    setSelectedDepot(did); setSelectedBranch(""); setBranches([]); setResult(null); setError("");
    if (!did) return;
    try {
      const r = await axios.get(`${API}/depots/${did}/branches`, { headers: getHeaders() });
      setBranches(r.data.branches || r.data || []);
    } catch { setBranches([]); }
  }

  async function runAnalyse() {
    if (!selectedDepot || !selectedBranch) return;
    setStep("running"); setResult(null); setError("");
    try {
      const r = await axios.post(`${API}/analyses/depot/${selectedDepot}`, { branche: selectedBranch }, { headers: getHeaders() });
      setResult(r.data);
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Erreur lors de l'analyse.");
      setStep("error");
    }
  }

  const scoreColor = (s: number) => s>=80?"#22c55e":s>=60?"#f59e0b":"#f87171";

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>
        <PageHeader icon="▶" title="Lancer une Analyse IA" sub="Analyse complète d'une branche de dépôt" />

        <div style={{ padding:"32px 36px", maxWidth:700 }}>

          {/* STEP INDICATOR */}
          <div style={{ display:"flex", gap:0, marginBottom:36 }}>
            {["Utilisateur","Dépôt","Branche","Analyse"].map((s,i)=>{
              const done = (i===0&&selectedUser)||(i===1&&selectedDepot)||(i===2&&selectedBranch)||(i===3&&step==="done");
              const active = (i===0&&!selectedUser)||(i===1&&selectedUser&&!selectedDepot)||(i===2&&selectedDepot&&!selectedBranch)||(i===3&&selectedBranch&&step!=="done");
              return (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:0, flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:done?"rgba(34,197,94,0.15)":active?"rgba(91,99,245,0.15)":"rgba(255,255,255,0.04)", border:`1px solid ${done?"rgba(34,197,94,0.4)":active?"rgba(91,99,245,0.4)":"#1e2235"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:done?"#22c55e":active?"#818cf8":"#3a4060", fontWeight:700, flexShrink:0 }}>
                      {done?"✓":(i+1)}
                    </div>
                    <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:done?"#22c55e":active?"#f1f3fc":"#3a4060", fontWeight:active||done?600:400 }}>{s}</span>
                  </div>
                  {i<3&&<div style={{ flex:1, height:1, background:"#1e2235", margin:"0 10px" }}/>}
                </div>
              );
            })}
          </div>

          {/* FORM */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* User select */}
            <div>
              <label style={{ display:"block", fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>
                Utilisateur propriétaire
              </label>
              <select value={selectedUser} onChange={e=>handleUserChange(e.target.value)} style={{ width:"100%", padding:"12px 14px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:10, color:selectedUser?"#f1f3fc":"#5a6080", fontSize:13, fontFamily:"'JetBrains Mono',monospace", outline:"none", cursor:"pointer" }}>
                <option value="">— Choisir un utilisateur —</option>
                {users.map(u=><option key={u.id} value={u.id}>  {u.email} ({u.role})</option>)}
              </select>
            </div>

            {/* Depot select */}
            {selectedUser && (
              <div style={{ animation:"fadeIn 0.2s ease" }}>
                <label style={{ display:"block", fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>
                  Dépôt GitLab
                </label>
                {loadingDepots ? (
                  <div style={{ color:"#5a6080", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>Chargement des dépôts...</div>
                ) : (
                  <select value={selectedDepot} onChange={e=>handleDepotChange(e.target.value)} style={{ width:"100%", padding:"12px 14px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:10, color:selectedDepot?"#f1f3fc":"#5a6080", fontSize:13, fontFamily:"'JetBrains Mono',monospace", outline:"none", cursor:"pointer" }}>
                    <option value="">— Choisir un dépôt —</option>
                    {depots.map(d=><option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Branch select */}
            {selectedDepot && (
              <div style={{ animation:"fadeIn 0.2s ease" }}>
                <label style={{ display:"block", fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>
                  Branche à analyser
                </label>
                {branches.length > 0 ? (
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {branches.map(b=>(
                      <button key={b} onClick={()=>setSelectedBranch(b)} style={{ padding:"8px 16px", background:selectedBranch===b?"rgba(91,99,245,0.14)":"transparent", border:`1px solid ${selectedBranch===b?"rgba(91,99,245,0.4)":"#1e2235"}`, borderRadius:8, color:selectedBranch===b?"#818cf8":"#5a6080", fontSize:12, fontFamily:"'JetBrains Mono',monospace", cursor:"pointer", fontWeight:600 }}>
                        {b}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={selectedBranch}
                    onChange={e=>setSelectedBranch(e.target.value)}
                    placeholder="main, develop, feature/..."
                    style={{ width:"100%", padding:"12px 14px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:10, color:"#f1f3fc", fontSize:13, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}
                  />
                )}
              </div>
            )}

            {/* CTA */}
            {selectedBranch && step !== "running" && step !== "done" && (
              <div style={{ animation:"fadeIn 0.2s ease", marginTop:8 }}>
                <button onClick={runAnalyse} style={{
                  width:"100%", padding:"14px", background:"linear-gradient(135deg,#5b63f5,#8b5cf6)",
                  border:"none", borderRadius:12, color:"#fff", fontFamily:"'Syne',sans-serif",
                  fontSize:15, fontWeight:800, cursor:"pointer", letterSpacing:"0.02em",
                  boxShadow:"0 4px 24px rgba(91,99,245,0.35)",
                }}>
                  ▶ Lancer l'analyse IA
                </button>
              </div>
            )}

            {/* RUNNING */}
            {step === "running" && (
              <div style={{ animation:"fadeIn 0.2s ease", background:"rgba(91,99,245,0.08)", border:"1px solid rgba(91,99,245,0.2)", borderRadius:14, padding:"28px", textAlign:"center" }}>
                <div style={{ width:36, height:36, border:"2px solid #1e2235", borderTopColor:"#5b63f5", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
                <p style={{ color:"#818cf8", fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600 }}>Analyse IA en cours...</p>
                <p style={{ color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", fontSize:11, marginTop:6, animation:"pulse 2s ease infinite" }}>Analyse du code, détection des vulnérabilités...</p>
              </div>
            )}

            {/* ERROR */}
            {step === "error" && (
              <div style={{ animation:"fadeIn 0.2s ease", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:14, padding:"22px", display:"flex", gap:14, alignItems:"center" }}>
                <span style={{ fontSize:24 }}>⊗</span>
                <div>
                  <p style={{ color:"#f87171", fontWeight:700, fontSize:13 }}>Erreur d'analyse</p>
                  <p style={{ color:"#a8b0d0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>{error}</p>
                </div>
                <button onClick={()=>setStep("idle")} style={{ marginLeft:"auto", background:"none", border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, color:"#f87171", padding:"6px 14px", cursor:"pointer", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>Réessayer</button>
              </div>
            )}

            {/* RESULT */}
            {step === "done" && result && (
              <div style={{ animation:"fadeIn 0.3s ease", background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:14, padding:"24px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <span style={{ fontSize:22 }}>✓</span>
                  <div>
                    <p style={{ color:"#22c55e", fontWeight:700, fontSize:15 }}>Analyse terminée</p>
                    <p style={{ color:"#5a6080", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>ID #{result.id}</p>
                  </div>
                  <button onClick={()=>{setStep("idle");setResult(null);setSelectedBranch("");}} style={{ marginLeft:"auto", background:"rgba(91,99,245,0.1)", border:"1px solid rgba(91,99,245,0.25)", borderRadius:8, color:"#818cf8", padding:"6px 14px", cursor:"pointer", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
                    Nouvelle analyse
                  </button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                  {[
                    { label:"Qualité",     score:result.score_qualite||0 },
                    { label:"Sécurité",    score:result.score_securite||0 },
                    { label:"Performance", score:result.score_performance||0 },
                  ].map(s=>(
                    <div key={s.label} style={{ background:"#07090f", borderRadius:10, padding:"14px", textAlign:"center", border:`1px solid ${scoreColor(s.score)}30` }}>
                      <div style={{ fontSize:28, fontWeight:800, color:scoreColor(s.score) }}>{s.score}</div>
                      <div style={{ fontSize:10, color:"#a8b0d0", fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {result.vulnerabilites?.length > 0 && (
                  <div style={{ marginTop:16, background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.15)", borderRadius:10, padding:"12px 16px" }}>
                    <p style={{ color:"#f87171", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>⚠ {result.vulnerabilites.length} vulnérabilité(s) détectée(s)</p>
                  </div>
                )}
                <a href={`/analyse/rapport?id=${result.id}`} style={{ display:"block", marginTop:12, textAlign:"center", color:"#818cf8", fontSize:12, fontFamily:"'JetBrains Mono',monospace", textDecoration:"none" }}>
                  Voir le rapport complet →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


