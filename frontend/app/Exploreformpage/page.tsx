"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface GitLabProjet {
  id: number;
  nom: string;
  chemin: string;
  url: string;
}

interface Branche {
  name: string;
  default: boolean;
}

// ── Étapes du flow ───────────────────────────────────────────────
// 1 → saisie token
// 2 → liste projets
// 3 → choix branche + lancement

export default function ExploreFormPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [token,        setToken]        = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError,   setTokenError]   = useState("");

  // Step 2
  const [projets,      setProjets]      = useState<GitLabProjet[]>([]);
  const [search,       setSearch]       = useState("");
  const [projetChoisi, setProjetChoisi] = useState<GitLabProjet | null>(null);

  // Step 3
  const [branches,       setBranches]       = useState<Branche[]>([]);
  const [brancheChoisie, setBrancheChoisie] = useState("main");
  const [branchLoading,  setBranchLoading]  = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError,   setExploreError]   = useState("");

  const H = () => {
    const t = localStorage.getItem("token");
    return { Authorization: t ? `Bearer ${t}` : "" };
  };

  // ── STEP 1 → 2 : charger les projets ─────────────────────────
  const chargerProjets = async () => {
    if (!token.trim()) { setTokenError("Le token GitLab est requis"); return; }
    setTokenLoading(true);
    setTokenError("");
    try {
      const res = await axios.post(
        `${API}/explorer/gitlab/projets`,
        { token: token.trim() },
        { headers: H() }
      );
      if (!res.data.length) { setTokenError("Aucun projet trouvé avec ce token"); return; }
      setProjets(res.data);
      setSearch("");
      setStep(2);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setTokenError(typeof d === "string" ? d : "Token invalide ou impossible de se connecter à GitLab");
    } finally {
      setTokenLoading(false);
    }
  };

  // ── STEP 2 → 3 : sélectionner projet + charger branches ───────
  const selectionnerProjet = async (p: GitLabProjet) => {
    setProjetChoisi(p);
    setBranchLoading(true);
    setBranches([]);
    setBrancheChoisie("main");
    setExploreError("");
    try {
      const res = await axios.post(
        `${API}/explorer/gitlab/branches`,
        { token: token.trim(), project_name: p.chemin },
        { headers: H() }
      );
      const bs: Branche[] = res.data.branches || [];
      setBranches(bs);
      const def = bs.find(b => b.default);
      if (def) setBrancheChoisie(def.name);
    } catch {
      // Silencieux — on laisse l'utilisateur saisir manuellement
    } finally {
      setBranchLoading(false);
      setStep(3);
    }
  };

  // ── Sauvegarder l'exploration en base ────────────────────────────
const sauvegarderExploration = async (explorationData: any) => {
  try {
    await axios.post(`${API}/explorer/save`, explorationData, { headers: H() });
    console.log("[SAVE] Exploration sauvegardée");
  } catch (e) {
    console.error("[SAVE] Erreur:", e);
    // Non bloquant - l'exploration continue même si la sauvegarde échoue
  }
};

// ── STEP 3 : lancer l'exploration ────────────────────────────
const lancerExploration = async () => {
  if (!projetChoisi) return;
  setExploreLoading(true);
  setExploreError("");
  try {
    const res = await axios.post(
      `${API}/explorer/files`,
      { nom: projetChoisi.chemin, branche: brancheChoisie.trim(), token: token.trim() },
      { headers: H() }
    );
    
    // Sauvegarder en base
    await sauvegarderExploration({
      projet_nom: projetChoisi.nom,
      projet_chemin: projetChoisi.chemin,
      branche: brancheChoisie.trim(),
      gitlab_token: token.trim(),
      total_fichiers: res.data.total,
      metadata: {
        url: projetChoisi.url,
        last_explored: new Date().toISOString()
      }
    });
    
    sessionStorage.setItem("explorer_data", JSON.stringify({
      ...res.data,
      token: token.trim(),
    }));
    router.push("/explorer");
  } catch (e: any) {
    const d = e?.response?.data?.detail;
    setExploreError(typeof d === "string" ? d : "Erreur lors de l'exploration du dépôt");
  } finally {
    setExploreLoading(false);
  }
};

  // ── Projets filtrés ───────────────────────────────────────────
  const filtered = projets.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.chemin.toLowerCase().includes(search.toLowerCase())
  );

  // ── Icône langue (déduit du nom) ──────────────────────────────
  const langIcon = (nom: string) => {
    const n = nom.toLowerCase();
    if (n.includes("python"))  return "🐍";
    if (n.includes("react") || n.includes("next")) return "⚛";
    if (n.includes("java") && !n.includes("script")) return "☕";
    if (n.includes("node") || n.includes("express")) return "🟢";
    if (n.includes("go"))      return "🔷";
    if (n.includes("rust"))    return "🦀";
    if (n.includes("php"))     return "🐘";
    return "📁";
  };

  // ── Styles ────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{opacity:1}50%{opacity:.5} }
        .proj-item   { transition:all .18s ease; cursor:pointer; }
        .proj-item:hover   { background:rgba(99,102,241,0.08) !important; border-color:rgba(99,102,241,0.4) !important; transform:translateX(3px); }
        .proj-item.selected{ background:rgba(99,102,241,0.12) !important; border-color:#6366f1 !important; }
        .branch-pill { transition:all .15s; cursor:pointer; }
        .branch-pill:hover { border-color:#6366f1 !important; color:#818cf8 !important; }
        .branch-pill.active{ background:rgba(99,102,241,0.15) !important; border-color:#6366f1 !important; color:#818cf8 !important; }
        ::-webkit-scrollbar       { width:4px; }
        ::-webkit-scrollbar-track { background:#0d0f1a; }
        ::-webkit-scrollbar-thumb { background:#1e2235; border-radius:2px; }
        input[type=text],input[type=password],input[type=search] { font-family:'IBM Plex Mono',monospace; }
      `}</style>

      <div style={{ minHeight:"100vh", background:"#07090f", fontFamily:"'IBM Plex Sans',sans-serif", color:"#e2e4f0", display:"flex", flexDirection:"column" }}>

        {/* ── TOP BAR ── */}
        <div style={{ padding:"18px 36px", display:"flex", alignItems:"center", gap:20, borderBottom:"1px solid #1a1f2e", background:"#0a0c14" }}>
          <button onClick={()=>router.push("/dashboard")}
            style={{ background:"none", border:"1px solid #1a1f2e", borderRadius:8, padding:"7px 14px", color:"#4a5080", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", cursor:"pointer", transition:"all .15s" }}
            onMouseEnter={e=>(e.currentTarget.style.borderColor="#2a2f45")}
            onMouseLeave={e=>(e.currentTarget.style.borderColor="#1a1f2e")}>
            ← Dashboard
          </button>

          {/* Breadcrumb steps */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
            {[
              { n:1, label:"Token" },
              { n:2, label:"Projet" },
              { n:3, label:"Branche" },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <div style={{ width:28, height:1, background: step > s.n - 1 ? "#6366f1" : "#1a1f2e" }} />}
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{
                    width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace",
                    background: step >= s.n ? (step === s.n ? "#6366f1" : "rgba(99,102,241,0.2)") : "#1a1f2e",
                    color:      step >= s.n ? (step === s.n ? "white"   : "#818cf8") : "#3a4060",
                    border:     step === s.n ? "2px solid #6366f1" : "2px solid transparent",
                    transition: "all .3s",
                  }}>{s.n}</div>
                  <span style={{ fontSize:12, color: step >= s.n ? (step === s.n ? "#a8b0d0" : "#5a6080") : "#3a4060", fontFamily:"'IBM Plex Mono',monospace", transition:"color .3s" }}>
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#3a4060" }}>
            ◈ Explorer un dépôt
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            STEP 1 — TOKEN
        ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:32, animation:"fadeUp .35s ease" }}>
            <div style={{ width:"100%", maxWidth:480 }}>

              <div style={{ marginBottom:32 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#6366f1", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:10 }}>◈ Étape 1 / 3</div>
                <h1 style={{ fontSize:26, fontWeight:600, color:"#f1f3fc", letterSpacing:"-0.02em", marginBottom:8 }}>
                  Token GitLab
                </h1>
                <p style={{ fontSize:13, color:"#4a5080", lineHeight:1.6 }}>
                  Entrez votre token d'accès personnel GitLab pour accéder à la liste de vos projets.
                </p>
              </div>

              {/* Token field */}
              <div style={{ background:"#0a0c14", border:"1px solid #1a1f2e", borderRadius:16, padding:"24px 22px", marginBottom:14 }}>
                <div style={{ fontSize:10, color:"#4a5080", fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>
                  Personal Access Token
                </div>
                <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                  <span style={{ position:"absolute", left:14, fontSize:14, color:"#3a4060", pointerEvents:"none" }}>🔑</span>
                  <input
                    type="password"
                    value={token}
                    onChange={e=>{ setToken(e.target.value); setTokenError(""); }}
                    onKeyDown={e=>e.key==="Enter"&&chargerProjets()}
                    placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                    autoFocus
                    style={{ width:"100%", paddingLeft:42, paddingRight:16, paddingTop:12, paddingBottom:12, background:"#070910", border:`1px solid ${tokenError?"#f87171":"#1a1f2e"}`, borderRadius:10, color:"#a8b0d0", fontSize:13, outline:"none", transition:"border-color .18s", letterSpacing:"0.06em" }}
                    onFocus={e=>e.target.style.borderColor="#6366f1"}
                    onBlur={e=>e.target.style.borderColor=tokenError?"#f87171":"#1a1f2e"}
                  />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
                  <div style={{ width:4, height:4, borderRadius:"50%", background:"#3a4060" }}/>
                  <span style={{ fontSize:10, color:"#3a4060", fontFamily:"'IBM Plex Mono',monospace" }}>
                    GitLab → Settings → Access Tokens → scopes : api, read_repository
                  </span>
                </div>
              </div>

              {tokenError && (
                <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"11px 14px", fontSize:12, color:"#f87171", fontFamily:"'IBM Plex Mono',monospace", marginBottom:14, animation:"fadeUp .2s ease" }}>
                  ✕ {tokenError}
                </div>
              )}

              <button onClick={chargerProjets} disabled={tokenLoading || !token.trim()}
                style={{ width:"100%", padding:"14px", background: token.trim()?"linear-gradient(135deg,#5b63f5,#7c3aed)":"#1a1f2e", border:"none", borderRadius:12, color: token.trim()?"white":"#3a4060", fontSize:14, fontWeight:600, cursor:token.trim()&&!tokenLoading?"pointer":"not-allowed", fontFamily:"'IBM Plex Sans',sans-serif", transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}
                onMouseEnter={e=>{ if(token.trim()&&!tokenLoading)(e.currentTarget as HTMLElement).style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform="none"}>
                {tokenLoading ? (
                  <>
                    <div style={{ width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                    Chargement des projets...
                  </>
                ) : "Charger mes projets GitLab →"}
              </button>

              <div style={{ marginTop:14, textAlign:"center", fontSize:11, color:"#2a2f45", fontFamily:"'IBM Plex Mono',monospace" }}>
                Le token n'est pas sauvegardé en base de données.
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2 — LISTE PROJETS
        ══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", animation:"fadeUp .3s ease" }}>

            <div style={{ padding:"28px 36px 20px", borderBottom:"1px solid #1a1f2e" }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#6366f1", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:8 }}>◈ Étape 2 / 3 — Sélectionner un projet</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                <div>
                  <h2 style={{ fontSize:20, fontWeight:600, color:"#f1f3fc", letterSpacing:"-0.02em" }}>
                    {projets.length} projet{projets.length > 1 ? "s" : ""} disponible{projets.length > 1 ? "s" : ""}
                  </h2>
                  <p style={{ fontSize:12, color:"#4a5080", marginTop:4, fontFamily:"'IBM Plex Mono',monospace" }}>
                    Cliquez sur un projet pour continuer
                  </p>
                </div>
                {/* Barre recherche */}
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"#3a4060" }}>⌕</span>
                  <input
                    type="search"
                    value={search}
                    onChange={e=>setSearch(e.target.value)}
                    placeholder="Filtrer les projets..."
                    style={{ paddingLeft:34, paddingRight:14, paddingTop:9, paddingBottom:9, background:"#0a0c14", border:"1px solid #1a1f2e", borderRadius:10, color:"#a8b0d0", fontSize:12, outline:"none", width:240, fontFamily:"'IBM Plex Mono',monospace" }}
                    onFocus={e=>e.target.style.borderColor="#6366f1"}
                    onBlur={e=>e.target.style.borderColor="#1a1f2e"}
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Liste scrollable */}
            <div style={{ flex:1, overflowY:"auto", padding:"20px 36px 32px" }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:"64px 0", color:"#3a4060", fontFamily:"'IBM Plex Mono',monospace", fontSize:13 }}>
                  Aucun projet correspondant à « {search} »
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:12 }}>
                  {filtered.map((p, i) => (
                    <div key={p.id} className="proj-item"
                      onClick={() => selectionnerProjet(p)}
                      style={{ background:"#0a0c14", border:"1px solid #1a1f2e", borderRadius:14, padding:"16px 18px", display:"flex", alignItems:"flex-start", gap:14, animationDelay:`${i*0.03}s`, animation:"fadeUp .3s ease backwards" }}>

                      {/* Icon */}
                      <div style={{ width:38, height:38, borderRadius:10, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                        {langIcon(p.nom)}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:"#e2e4f0", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {p.nom}
                        </div>
                        <div style={{ fontSize:11, color:"#3a4060", fontFamily:"'IBM Plex Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {p.chemin}
                        </div>
                      </div>

                      <div style={{ fontSize:16, color:"#2a2f45", flexShrink:0, marginTop:2 }}>›</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer : retour */}
            <div style={{ padding:"14px 36px", borderTop:"1px solid #1a1f2e", display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={()=>{ setStep(1); setTokenError(""); }}
                style={{ background:"none", border:"1px solid #1a1f2e", borderRadius:8, padding:"7px 16px", color:"#4a5080", fontSize:12, fontFamily:"'IBM Plex Mono',monospace", cursor:"pointer" }}>
                ← Changer de token
              </button>
              <span style={{ fontSize:11, color:"#2a2f45", fontFamily:"'IBM Plex Mono',monospace" }}>
                {filtered.length}/{projets.length} projets affichés
              </span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3 — BRANCHE + LANCEMENT
        ══════════════════════════════════════════════════════ */}
        {step === 3 && projetChoisi && (
          <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 32px", animation:"fadeUp .3s ease" }}>
            <div style={{ width:"100%", maxWidth:520 }}>

              <div style={{ marginBottom:28 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#6366f1", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:10 }}>◈ Étape 3 / 3 — Choisir la branche</div>
                <h2 style={{ fontSize:22, fontWeight:600, color:"#f1f3fc", letterSpacing:"-0.02em", marginBottom:4 }}>
                  Explorer le projet
                </h2>
              </div>

              {/* Résumé projet sélectionné */}
              <div style={{ background:"#0a0c14", border:"1px solid rgba(99,102,241,0.3)", borderRadius:14, padding:"16px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:11, background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                  {langIcon(projetChoisi.nom)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:"#f1f3fc", marginBottom:3 }}>{projetChoisi.nom}</div>
                  <div style={{ fontSize:11, color:"#4a5080", fontFamily:"'IBM Plex Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{projetChoisi.chemin}</div>
                </div>
                <button onClick={()=>setStep(2)}
                  style={{ fontSize:11, color:"#4a5080", background:"none", border:"1px solid #1a1f2e", borderRadius:7, padding:"5px 10px", cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
                  Changer
                </button>
              </div>

              {/* Branches */}
              <div style={{ background:"#0a0c14", border:"1px solid #1a1f2e", borderRadius:14, padding:"20px", marginBottom:14 }}>
                <div style={{ fontSize:10, color:"#4a5080", fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:14 }}>
                  Branche
                  {branchLoading && (
                    <span style={{ marginLeft:10, color:"#6366f1" }}>
                      <span style={{ display:"inline-block", width:10,height:10,border:"1.5px solid rgba(99,102,241,0.3)",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin .6s linear infinite",verticalAlign:"middle" }}/>
                      {" "}Chargement...
                    </span>
                  )}
                </div>

                {/* Pills branches détectées */}
                {branches.length > 0 ? (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                    {branches.map(b => (
                      <button key={b.name} className={`branch-pill${brancheChoisie===b.name?" active":""}`}
                        onClick={()=>setBrancheChoisie(b.name)}
                        style={{ padding:"6px 14px", background:"transparent", border:"1px solid #1e2235", borderRadius:20, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:brancheChoisie===b.name?"#818cf8":"#4a5080", display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                        {b.default && <span style={{ width:5,height:5,background:"#22c55e",borderRadius:"50%",display:"inline-block" }}/>}
                        {b.name}
                        {b.default && <span style={{ fontSize:9, color:"#22c55e", opacity:.8 }}>défaut</span>}
                      </button>
                    ))}
                  </div>
                ) : !branchLoading && (
                  <div style={{ fontSize:11, color:"#3a4060", fontFamily:"'IBM Plex Mono',monospace", marginBottom:10 }}>
                    Aucune branche détectée automatiquement — saisissez manuellement :
                  </div>
                )}

                {/* Champ branche manuel */}
                <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                  <span style={{ position:"absolute", left:13, color:"#3a4060", fontSize:13, pointerEvents:"none" }}>⎇</span>
                  <input
                    type="text"
                    value={brancheChoisie}
                    onChange={e=>setBrancheChoisie(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&lancerExploration()}
                    placeholder="main"
                    style={{ width:"100%", paddingLeft:38, paddingRight:14, paddingTop:11, paddingBottom:11, background:"#070910", border:"1px solid #1a1f2e", borderRadius:10, color:"#a8b0d0", fontSize:13, outline:"none", letterSpacing:"0.04em" }}
                    onFocus={e=>e.target.style.borderColor="#6366f1"}
                    onBlur={e=>e.target.style.borderColor="#1a1f2e"}
                  />
                </div>
              </div>

              {exploreError && (
                <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"11px 14px", fontSize:12, color:"#f87171", fontFamily:"'IBM Plex Mono',monospace", marginBottom:14, animation:"fadeUp .2s ease" }}>
                  ✕ {exploreError}
                </div>
              )}

              {/* Bouton explorer */}
              <button onClick={lancerExploration} disabled={exploreLoading || !brancheChoisie.trim()}
                style={{ width:"100%", padding:"15px", background:brancheChoisie.trim()&&!exploreLoading?"linear-gradient(135deg,#5b63f5,#7c3aed)":"#1a1f2e", border:"none", borderRadius:12, color:brancheChoisie.trim()&&!exploreLoading?"white":"#3a4060", fontSize:14, fontWeight:600, cursor:brancheChoisie.trim()&&!exploreLoading?"pointer":"not-allowed", fontFamily:"'IBM Plex Sans',sans-serif", transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}
                onMouseEnter={e=>{ if(brancheChoisie.trim()&&!exploreLoading)(e.currentTarget as HTMLElement).style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform="none"}>
                {exploreLoading ? (
                  <>
                    <div style={{ width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                    Chargement du code source...
                  </>
                ) : (
                  <>◈ Explorer {projetChoisi.nom} / {brancheChoisie}</>
                )}
              </button>

              <div style={{ marginTop:12, textAlign:"center", fontSize:11, color:"#2a2f45", fontFamily:"'IBM Plex Mono',monospace" }}>
                Le contenu est chargé directement depuis GitLab — non sauvegardé.
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}