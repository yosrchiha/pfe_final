"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface FileItem { path: string; content: string; size: number; }
interface SessionData { projet: string; branche: string; total: number; fichiers: FileItem[]; token: string; }
interface Vuln { fichier: string; ligne: number; type: string; severite: string; suggestion: string; }
interface AnalyseResult {
  score_qualite: number; score_securite: number; score_performance: number;
  vulnerabilites: Vuln[]; recommandations: { titre: string; description: string }[];
  statut: "en_cours" | "termine" | "erreur"; erreur?: string;
}
interface CorrectionHistory {
  id: number;
  fichier_path: string;
  vuln_type: string;
  vuln_severite: string;
  vuln_ligne: number;
  vuln_suggestion: string;
  statut: string;
  created_at: string;
}

type Tab = "code" | "analyse" | "edit" | "history";
type TreeNode = { name: string; path: string; type: "file" | "dir"; children?: TreeNode[]; file?: FileItem; };

function buildTree(files: FileItem[], filter: string): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap: Record<string, TreeNode> = {};
  const filtered = filter ? files.filter(f => f.path.toLowerCase().includes(filter.toLowerCase())) : files;
  filtered.forEach(file => {
    const parts = file.path.split("/");
    let current = root; let cur = "";
    parts.forEach((part, i) => {
      cur = cur ? `${cur}/${part}` : part;
      if (i === parts.length - 1) { current.push({ name: part, path: cur, type: "file", file }); }
      else {
        if (!dirMap[cur]) { const node: TreeNode = { name: part, path: cur, type: "dir", children: [] }; dirMap[cur] = node; current.push(node); }
        current = dirMap[cur].children!;
      }
    });
  });
  return root;
}

function fileIcon(path: string) {
  if (path.endsWith(".py")) return "🐍";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "🔷";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "🟨";
  if (path.endsWith(".java")) return "☕";
  if (path.endsWith(".go")) return "🐹";
  if (path.endsWith(".php")) return "🐘";
  if (path.endsWith(".html")) return "🌐";
  if (path.endsWith(".css") || path.endsWith(".scss")) return "🎨";
  if (path.endsWith(".json")) return "📋";
  if (path.endsWith(".md")) return "📝";
  return "📄";
}

function scoreCol(s: number) { return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"; }
function sevCol(s: string) {
  if (s === "CRITIQUE") return "#ef4444";
  if (s === "HAUTE") return "#f97316";
  if (s === "MOYENNE") return "#eab308";
  return "#6b7280";
}

export default function ExplorerPage() {
  const router = useRouter();
  const [data,        setData]        = useState<SessionData | null>(null);
  const [token,       setToken]       = useState("");
  const [selFile,     setSelFile]     = useState<FileItem | null>(null);
  const [activeTab,   setActiveTab]   = useState<Tab>("code");
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [search,      setSearch]      = useState("");
  const [analyses,    setAnalyses]    = useState<Record<string, AnalyseResult>>({});
  const [loadingAna,  setLoadingAna]  = useState(false);
  const [edits,       setEdits]       = useState<Record<string, string>>({});
  const [editContent, setEditContent] = useState("");
  const textareaRef                   = useRef<HTMLTextAreaElement>(null);
  const [fixingVuln,  setFixingVuln]  = useState<Vuln | null>(null);
  const [fixBanner,   setFixBanner]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [showPush,    setShowPush]    = useState(false);
  const [pushBranch,  setPushBranch]  = useState("");
  const [pushMsg,     setPushMsg]     = useState("");
  const [pushMode,    setPushMode]    = useState<"existing" | "new">("existing");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushRes,     setPushRes]     = useState<{ ok: boolean; msg: string; url?: string } | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  
  // ✅ Historique des corrections
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistory[]>([]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const jwt = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // ✅ Charger l'historique des corrections
  const loadCorrectionHistory = async (fichier?: string) => {
    try {
      const url = fichier 
        ? `${API}/explorer/correction/history?fichier_path=${encodeURIComponent(fichier)}`
        : `${API}/explorer/correction/history`;
      const res = await axios.get(url, { headers: jwt() });
      setCorrectionHistory(res.data);
    } catch (e) {
      console.error("Erreur chargement historique", e);
    }
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("explorer_data");
    if (!raw) { router.push("/Exploreformpage"); return; }
    try {
      const parsed: SessionData = JSON.parse(raw);
      setData(parsed);
      setToken(parsed.token || "");
      if (parsed.fichiers?.length) setExpanded(new Set([parsed.fichiers[0].path.split("/")[0]]));
    } catch { router.push("/Exploreformpage"); }
  }, [router]);

  const saveEditLocal = (path: string, content: string) => {
    const orig = data?.fichiers.find(f => f.path === path)?.content ?? "";
    if (content === orig) setEdits(prev => { const n = { ...prev }; delete n[path]; return n; });
    else setEdits(prev => ({ ...prev, [path]: content }));
  };

  const selectFile = (file: FileItem) => {
    if (activeTab === "edit" && selFile) saveEditLocal(selFile.path, editContent);
    setSelFile(file);
    setActiveTab("code");
    setFixBanner(null);
    setEditContent(edits[file.path] ?? file.content);
    // ✅ Charger l'historique pour ce fichier
    loadCorrectionHistory(file.path);
  };

  const openEditor = () => {
    if (!selFile) return;
    setEditContent(edits[selFile.path] ?? selFile.content);
    setFixBanner(null);
    setActiveTab("edit");
  };
  const handleSave = () => {
    if (!selFile) return;
    saveEditLocal(selFile.path, editContent);
    showToast("Sauvegardé localement");
  };
  const handleRevert = () => {
    if (!selFile) return;
    setEdits(prev => { const n = { ...prev }; delete n[selFile.path]; return n; });
    setEditContent(selFile.content);
    setFixBanner(null);
    showToast("Modifications annulées");
  };
  const analyserFichier = async (file: FileItem) => {
    if (!data) return;
    setLoadingAna(true);
    setSelFile(file);
    setActiveTab("analyse");
    setAnalyses(prev => ({ ...prev, [file.path]: { ...prev[file.path], statut: "en_cours" } as any }));
    try {
      const res = await axios.post(`${API}/analyses-fichier/`,
        { projet_nom: data.projet, fichier_path: file.path, contenu: file.content, branche: data.branche },
        { headers: jwt() }
      );
      setAnalyses(prev => ({ ...prev, [file.path]: { ...res.data, statut: "termine" } }));
    } catch (e: any) {
      setAnalyses(prev => ({
        ...prev, [file.path]: {
          score_qualite: 0, score_securite: 0, score_performance: 0,
          vulnerabilites: [], recommandations: [],
          statut: "erreur", erreur: e.response?.data?.detail || "Erreur d'analyse"
        }
      }));
    } finally { setLoadingAna(false); }
  };
  const corrigerParIA = async (vuln: Vuln) => {
  if (!selFile || !data) return;
  setFixingVuln(vuln);
  setFixBanner(null);
  setActiveTab("edit");
  const contenuActuel = edits[selFile.path] ?? selFile.content;
  // Numéroter les lignes
  const contenuNumerote = contenuActuel.split("\n").map((l, i) => `${String(i+1).padStart(4)} | ${l}`).join("\n");
  
  try {
    const res = await axios.post(`${API}/explorer/corriger`, {
      fichier_path: selFile.path,
      contenu_numerote: contenuNumerote,
      vuln_type: vuln.type,
      vuln_ligne: vuln.ligne,
      vuln_suggestion: vuln.suggestion,
      severite: vuln.severite,
    }, { headers: jwt() });
    
    const corrige = res.data.contenu_corrige as string;
    setEditContent(corrige);
    saveEditLocal(selFile.path, corrige);
    
    // Sauvegarde en base
    try {
      await axios.post(`${API}/explorer/correction/save`, {
        projet_nom: data.projet,
        fichier_path: selFile.path,
        branche: data.branche,
        vuln_type: vuln.type,
        vuln_severite: vuln.severite,
        vuln_ligne: vuln.ligne,
        vuln_suggestion: vuln.suggestion,
        contenu_original: contenuActuel,
        contenu_corrige: corrige
      }, { headers: jwt() });
      // Recharger l'historique après sauvegarde
      loadCorrectionHistory(selFile.path);
    } catch (saveErr) {
      console.error("[SAVE] Erreur:", saveErr);
    }
    
    let msg = res.data.explication || "Correction appliquée";
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
    setFixBanner({ ok: true, msg });
    
  } catch (e: any) {
    let errorMsg = e.response?.data?.detail || e.message || "Échec de la correction IA";
    if (typeof errorMsg !== 'string') errorMsg = JSON.stringify(errorMsg);
    setFixBanner({ ok: false, msg: errorMsg });
  } finally {
    setFixingVuln(null);
  }
};

  const modifiedPaths = Object.keys(edits).filter(p => {
    const orig = data?.fichiers.find(f => f.path === p)?.content ?? "";
    return edits[p] !== orig;
  });

  const openPushModal = () => {
    if (activeTab === "edit" && selFile) saveEditLocal(selFile.path, editContent);
    if (modifiedPaths.length === 0) { showToast("Aucune modification à pousser", false); return; }
    setPushBranch(data?.branche || "main");
    setPushMsg(`fix: corrections IA — ${modifiedPaths.length} fichier(s)`);
    setPushMode("existing");
    setPushRes(null);
    setShowPush(true);
  };

  // ── Pusher vers GitLab ────────────────────────────────────
const pusherGitLab = async () => {
  if (!data || !token) { 
    setPushRes({ ok: false, msg: "Token GitLab manquant. Relancez depuis le formulaire." }); 
    return; 
  }
  setPushLoading(true); 
  setPushRes(null);
  try {
    const fichiers = modifiedPaths.map(p => ({ path: p, contenu: edits[p] }));
    const res = await axios.post(`${API}/explorer/push`, {
      token, 
      projet: data.projet, 
      branche_src: data.branche,
      branche_dst: pushBranch, 
      mode: pushMode, 
      message: pushMsg, 
      fichiers,
    }, { headers: jwt() });
    
    setPushRes({ ok: true, msg: res.data.message, url: res.data.url });
    
    // ✅ Sauvegarde de la MR dans la base de données
    if (res.data.url) {
      try {
        await axios.post(`${API}/explorer/mr/save`, {
          projet_nom: data.projet,
          projet_chemin: data.projet,
          branche_source: pushBranch,
          branche_cible: data.branche,
          titre: `[IA] Corrections sur ${modifiedPaths.length} fichier(s)`,
          description: pushMsg,
          mr_id_gitlab: res.data.mr_id || 0,
          mr_iid_gitlab: res.data.mr_iid || 0,
          mr_url: res.data.url,
          fichiers_modifies: modifiedPaths
        }, { headers: jwt() });
        console.log("[SAVE] MR sauvegardée en base");
      } catch (saveErr) {
        console.error("[SAVE] Erreur sauvegarde MR:", saveErr);
      }
    }
    
    setEdits({});
    if (selFile) setEditContent(selFile.content);
    showToast("Push réussi !");
    
  } catch (e: any) {
    const d = e.response?.data?.detail;
    setPushRes({ ok: false, msg: typeof d === "string" ? d : "Erreur lors du push" });
  } finally { 
    setPushLoading(false); 
  }
};

  const toggleDir = (p: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactElement[] =>
    nodes.flatMap(node => {
      const isSel     = selFile?.path === node.path;
      const isDirty   = node.file ? (node.file.path in edits && edits[node.file.path] !== node.file.content) : false;
      const ana       = node.file ? analyses[node.file.path] : null;
      return [
        <div key={node.path}
          style={{
            paddingLeft: depth*14+(node.type==="dir"?8:22), paddingRight:8,
            paddingTop:4, paddingBottom:4, display:"flex", alignItems:"center", gap:6,
            cursor:"pointer", fontSize:11, fontFamily:"monospace",
            background: isSel ? "rgba(99,102,241,0.15)" : "transparent",
            color: isSel ? "#a5b4fc" : node.type==="dir" ? "#6b7280" : "#9ca3af",
            borderLeft: isSel ? "2px solid #6366f1" : "2px solid transparent",
          }}
          className="tree-row"
          onClick={() => node.type==="dir" ? toggleDir(node.path) : selectFile(node.file!)}
        >
          {node.type === "dir" ? (
            <><span style={{fontSize:9,color:"#4b5563"}}>{expanded.has(node.path)?"▾":"▸"}</span><span>📁</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.name}</span></>
          ) : (
            <>
              <span>{fileIcon(node.path)}</span>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.name}</span>
              {isDirty && <span style={{color:"#f59e0b",fontSize:10,flexShrink:0}} title="Modifié">●</span>}
              {ana?.statut==="termine" && !isDirty && <span style={{color:"#10b981",fontSize:10,flexShrink:0}}>✓</span>}
              {ana?.statut==="en_cours" && <span style={{color:"#6366f1",fontSize:10,flexShrink:0}}>⟳</span>}
              <button className="ana-btn"
                onClick={e=>{e.stopPropagation();analyserFichier(node.file!);}}
                style={{display:"none",padding:"2px 7px",background:"rgba(99,102,241,0.2)",border:"none",borderRadius:4,color:"#818cf8",cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>
                🔍
              </button>
            </>
          )}
        </div>,
        ...(node.type==="dir" && expanded.has(node.path) && node.children ? renderTree(node.children, depth+1) : [])
      ];
    });

  if (!data) return <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#030712",color:"#4b5563",fontFamily:"monospace"}}>Chargement…</div>;

  const tree      = buildTree(data.fichiers, search);
  const ana       = selFile ? analyses[selFile.path] : null;
  const isDirty   = selFile ? (selFile.path in edits && edits[selFile.path] !== selFile.content) : false;
  const displayed = selFile ? (edits[selFile.path] ?? selFile.content) : "";

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#030712;overflow:hidden;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#0a0f1a;}
        ::-webkit-scrollbar-thumb{background:#1e2538;border-radius:3px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        .tree-row:hover{background:rgba(255,255,255,0.04)!important;}
        .tree-row:hover .ana-btn{display:block!important;}
        textarea{resize:none;outline:none;tab-size:2;}
      `}</style>

      <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#030712",color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace",fontSize:12,overflow:"hidden"}}>

        {/* TOPBAR */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:"#0a0f1a",borderBottom:"1px solid #1e2538",flexShrink:0,minHeight:42}}>
          <button onClick={()=>router.push("/Exploreformpage")} style={{padding:"5px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid #1e2538",borderRadius:7,color:"#6b7280",cursor:"pointer",fontSize:11}}>← Retour</button>
          <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{data.projet}</span>
          <span style={{fontSize:10,color:"#818cf8",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:5,padding:"2px 8px",flexShrink:0}}>⑂ {data.branche}</span>
          <span style={{fontSize:10,color:"#374151",flexShrink:0}}>{data.total} fichiers</span>
          {modifiedPaths.length > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:8}}>
              <span style={{fontSize:10,color:"#f59e0b",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:5,padding:"2px 8px"}}>
                {modifiedPaths.length} modifié{modifiedPaths.length>1?"s":""}
              </span>
              <button onClick={openPushModal} style={{padding:"6px 14px",background:"linear-gradient(135deg,#5b63f5,#9b5cf6)",border:"none",borderRadius:7,color:"white",cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:"0 2px 10px rgba(91,99,245,0.35)"}}>↑ Push GitLab</button>
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>

          {/* SIDEBAR */}
          <div style={{width:240,flexShrink:0,background:"#0a0f1a",borderRight:"1px solid #1e2538",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"8px",borderBottom:"1px solid #1e2538"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrer..."
                style={{width:"100%",background:"#030712",border:"1px solid #1e2538",borderRadius:6,padding:"6px 10px",color:"#9ca3af",fontSize:11,outline:"none"}}/>
            </div>
            <div style={{flex:1,overflowY:"auto",paddingTop:4}}>{renderTree(tree)}</div>
          </div>

          {/* PANEL DROIT */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {!selFile ? (
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,opacity:0.2}}>
                <div style={{fontSize:36}}>📄</div>
                <div style={{fontSize:11}}>Sélectionnez un fichier</div>
              </div>
            ) : (
              <>
                {/* TABS */}
                <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid #1e2538",background:"#0a0f1a",flexShrink:0,paddingLeft:4}}>
                  {(["code","analyse","edit","history"] as Tab[]).map(t => {
                    const labels: Record<Tab,string> = {
                      code:"📄 Code", 
                      analyse:"🧠 Analyse", 
                      edit:"✏️ Éditeur",
                      history:"📜 Historique"
                    };
                    const act = activeTab===t;
                    return (
                      <button key={t} onClick={() => {
                        if (t === "edit") openEditor();
                        else if (t === "history") loadCorrectionHistory(selFile?.path);
                        setActiveTab(t);
                      }}
                        style={{padding:"9px 16px",background:"transparent",border:"none",borderBottom:act?"2px solid #6366f1":"2px solid transparent",color:act?"#818cf8":"#4b5563",cursor:"pointer",fontSize:11,fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                        {labels[t]}
                        {t==="analyse"&&ana?.statut==="termine"&&<span style={{color:"#10b981",fontSize:9}}>✓</span>}
                        {t==="edit"&&isDirty&&<span style={{color:"#f59e0b",fontSize:10}}>●</span>}
                        {t==="history"&&correctionHistory.length>0&&<span style={{color:"#818cf8",fontSize:9}}>({correctionHistory.length})</span>}
                      </button>
                    );
                  })}
                  <div style={{marginLeft:"auto",display:"flex",gap:6,padding:"4px 10px",alignItems:"center"}}>
                    {activeTab==="code" && (
                      <>
                        <button onClick={()=>analyserFichier(selFile)} disabled={loadingAna}
                          style={{padding:"5px 11px",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:7,color:"#818cf8",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
                          {loadingAna?"…":"🔍 Analyser"}
                        </button>
                        <button onClick={openEditor}
                          style={{padding:"5px 11px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:7,color:"#f59e0b",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
                          ✏️ Éditer
                        </button>
                      </>
                    )}
                    {activeTab==="edit" && (
                      <>
                        <button onClick={handleSave}
                          style={{padding:"5px 11px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:7,color:"#10b981",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
                          💾 Sauvegarder
                        </button>
                        {isDirty&&<button onClick={handleRevert}
                          style={{padding:"5px 11px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,color:"#f87171",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
                          ↩ Annuler
                        </button>}
                      </>
                    )}
                  </div>
                </div>

                {/* TAB CODE */}
                {activeTab==="code" && (
                  <div style={{flex:1,overflowY:"auto"}}>
                    {displayed.split("\n").map((line,i)=>{
                      const ln=i+1;
                      const vuln=ana?.vulnerabilites?.find(v=>v.ligne===ln);
                      return (
                        <div key={i} style={{display:"flex",alignItems:"flex-start",minHeight:20,background:vuln?`${sevCol(vuln.severite)}12`:"transparent",borderLeft:vuln?`2px solid ${sevCol(vuln.severite)}`:"2px solid transparent"}}>
                          <span style={{userSelect:"none",color:"#374151",textAlign:"right",paddingRight:14,paddingLeft:14,width:50,flexShrink:0,lineHeight:"1.6",fontSize:11}}>{ln}</span>
                          <span style={{flex:1,paddingRight:14,fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:"1.6",whiteSpace:"pre",color:"#d1d5db"}}>{line||" "}</span>
                          {vuln&&<span title={vuln.suggestion} onClick={()=>setActiveTab("analyse")} style={{flexShrink:0,fontSize:9,color:sevCol(vuln.severite),padding:"0 8px",cursor:"pointer",lineHeight:"1.6",whiteSpace:"nowrap"}}>⚠ {vuln.severite}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TAB ANALYSE */}
                {activeTab==="analyse" && (
                  <div style={{flex:1,overflowY:"auto",padding:18}}>
                    {loadingAna&&ana?.statut==="en_cours" ? (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:12}}>
                        <div style={{width:28,height:28,border:"2px solid #1e2538",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                        <span style={{color:"#4b5563",fontSize:11}}>Analyse IA en cours…</span>
                      </div>
                    ) : ana?.statut==="termine" ? (
                      <div style={{animation:"fade 0.2s ease"}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
                          {[{l:"Qualité",v:ana.score_qualite},{l:"Sécurité",v:ana.score_securite},{l:"Perf.",v:ana.score_performance}].map(s=>(
                            <div key={s.l} style={{background:"#0a0f1a",border:"1px solid #1e2538",borderRadius:10,padding:"14px 10px",textAlign:"center"}}>
                              <div style={{fontSize:28,fontWeight:700,color:scoreCol(s.v)}}>{s.v??"—"}</div>
                              <div style={{fontSize:10,color:"#4b5563",marginTop:4}}>{s.l}</div>
                              <div style={{height:2,background:"#1e2538",borderRadius:1,marginTop:6,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${s.v??0}%`,background:scoreCol(s.v)}}/>
                              </div>
                            </div>
                          ))}
                        </div>

                        {ana.vulnerabilites.length>0&&(
                          <>
                            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                              <span style={{width:2,height:12,background:"#ef4444",borderRadius:1,display:"inline-block"}}/>Vulnérabilités ({ana.vulnerabilites.length})
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                              {ana.vulnerabilites.map((v,i)=>(
                                <div key={i} style={{background:"#0a0f1a",border:"1px solid #1e2538",borderLeft:`3px solid ${sevCol(v.severite)}`,borderRadius:9,padding:12,animation:"fade 0.15s ease"}}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:`${sevCol(v.severite)}18`,color:sevCol(v.severite),fontWeight:700}}>{v.severite}</span>
                                      <span style={{fontSize:11,color:"#d1d5db"}}>{v.type}</span>
                                      <span style={{fontSize:10,color:"#374151"}}>ligne {v.ligne}</span>
                                    </div>
                                    <button onClick={()=>corrigerParIA(v)} disabled={fixingVuln!==null}
                                      style={{flexShrink:0,padding:"5px 11px",background:fixingVuln?.ligne===v.ligne&&fixingVuln?.type===v.type?"rgba(91,99,245,0.06)":"linear-gradient(135deg,#5b63f5,#9b5cf6)",border:"none",borderRadius:7,color:"white",cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:700,opacity:fixingVuln&&!(fixingVuln.ligne===v.ligne&&fixingVuln.type===v.type)?0.4:1,display:"flex",alignItems:"center",gap:5}}>
                                      {fixingVuln?.ligne===v.ligne&&fixingVuln?.type===v.type
                                        ?<><span style={{width:10,height:10,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.6s linear infinite",display:"inline-block"}}/>IA…</>
                                        :"🤖 Corriger par IA"}
                                    </button>
                                  </div>
                                  <div style={{fontSize:11,color:"#6b7280"}}>💡 {v.suggestion}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {ana.recommandations.length>0&&(
                          <>
                            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                              <span style={{width:2,height:12,background:"#10b981",borderRadius:1,display:"inline-block"}}/>Recommandations ({ana.recommandations.length})
                            </div>
                            {ana.recommandations.map((r,i)=>(
                              <div key={i} style={{background:"#0a0f1a",border:"1px solid #1e2538",borderRadius:9,padding:12,marginBottom:8}}>
                                <div style={{fontSize:11,color:"#818cf8",marginBottom:4}}>✓ {r.titre}</div>
                                <div style={{fontSize:11,color:"#4b5563"}}>{r.description}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {ana.vulnerabilites.length===0&&(
                          <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:10,padding:24,textAlign:"center"}}>
                            <div style={{fontSize:28,marginBottom:6}}>✅</div>
                            <div style={{color:"#10b981",fontSize:12}}>Aucune vulnérabilité — Code propre !</div>
                          </div>
                        )}
                      </div>
                    ) : ana?.statut==="erreur" ? (
                      <div style={{textAlign:"center",padding:"40px 0"}}>
                        <div style={{fontSize:28,marginBottom:8}}>❌</div>
                        <div style={{color:"#f87171",fontSize:11,marginBottom:14}}>{ana.erreur}</div>
                        <button onClick={()=>analyserFichier(selFile)} style={{padding:"7px 16px",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:7,color:"#818cf8",cursor:"pointer",fontSize:11}}>🔍 Réessayer</button>
                      </div>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:10,opacity:0.3}}>
                        <div style={{fontSize:32}}>🧠</div>
                        <div style={{fontSize:11}}>Pas encore analysé</div>
                        <button onClick={()=>analyserFichier(selFile)} style={{opacity:1,padding:"7px 16px",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:7,color:"#818cf8",cursor:"pointer",fontSize:11}}>🔍 Analyser ce fichier</button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB ÉDITEUR */}
                {activeTab==="edit" && (
                  <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    {fixBanner&&(
                      <div style={{padding:"8px 14px",flexShrink:0,animation:"fade 0.2s ease",background:fixBanner.ok?"rgba(91,99,245,0.07)":"rgba(239,68,68,0.07)",borderBottom:`1px solid ${fixBanner.ok?"rgba(91,99,245,0.2)":"rgba(239,68,68,0.2)"}`,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:11,color:fixBanner.ok?"#818cf8":"#f87171",flex:1}}>{fixBanner.ok?"🤖 Correction IA —":"❌"} {fixBanner.msg}</span>
                        {fixBanner.ok&&<button onClick={()=>{setEditContent(selFile!.content);setFixBanner(null);handleRevert();}} style={{padding:"3px 9px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:5,color:"#f87171",cursor:"pointer",fontSize:10}}>↩ Annuler correction</button>}
                        <button onClick={()=>setFixBanner(null)} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontSize:12}}>✕</button>
                      </div>
                    )}
                    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
                      {/* Numéros de ligne */}
                      <div style={{width:48,flexShrink:0,background:"#030712",borderRight:"1px solid #111827",overflowY:"hidden"}}>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:"1.6",color:"#374151",textAlign:"right",paddingRight:10,paddingTop:0}}>
                          {editContent.split("\n").map((_,i)=>(
                            <div key={i} style={{lineHeight:"1.6"}}>{i+1}</div>
                          ))}
                        </div>
                      </div>
                      <textarea ref={textareaRef} value={editContent} onChange={e=>setEditContent(e.target.value)} spellCheck={false}
                        style={{flex:1,background:"#030712",color:"#d1d5db",border:"none",padding:"0 14px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:"1.6",whiteSpace:"pre",overflowWrap:"normal",overflowX:"auto"}}
                      />
                    </div>
                  </div>
                )}

                {/* ✅ TAB HISTORIQUE - NOUVEAU */}
                {activeTab === "history" && (
                  <div style={{flex:1,overflowY:"auto",padding:18}}>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                        <span>📜</span> Historique des corrections IA pour <code style={{background:"#0a0f1a",padding:"2px 6px",borderRadius:4}}>{selFile?.path}</code>
                      </div>
                      {correctionHistory.length === 0 ? (
                        <div style={{textAlign:"center",padding:"40px 0",color:"#4b5563"}}>
                          <div style={{fontSize:32,marginBottom:8}}>📭</div>
                          <div style={{fontSize:12}}>Aucune correction enregistrée pour ce fichier</div>
                          <div style={{fontSize:10,color:"#374151",marginTop:4}}>Utilisez le bouton "🤖 Corriger par IA" dans l'onglet Analyse pour créer une correction</div>
                        </div>
                      ) : (
                        <div style={{display:"flex",flexDirection:"column",gap:12}}>
                          {correctionHistory.map((corr) => (
                            <div key={corr.id} style={{background:"#0a0f1a",border:"1px solid #1e2538",borderRadius:10,padding:14,animation:"fade 0.2s ease"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:10,color:"#818cf8",background:"rgba(99,102,241,0.1)",padding:"2px 8px",borderRadius:15}}>
                                    #{corr.id}
                                  </span>
                                  <span style={{fontSize:10,color:"#374151"}}>
                                    {new Date(corr.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <span style={{fontSize:9,padding:"2px 8px",borderRadius:15,
                                  background:corr.statut==="poussee"?"rgba(16,185,129,0.15)":"rgba(91,99,245,0.1)",
                                  color:corr.statut==="poussee"?"#10b981":"#818cf8"}}>
                                  {corr.statut==="poussee"?"✓ Poussée":"● Appliquée"}
                                </span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                <span style={{fontSize:9,padding:"2px 6px",borderRadius:12,background:`${sevCol(corr.vuln_severite)}18`,color:sevCol(corr.vuln_severite),fontWeight:700}}>
                                  {corr.vuln_severite}
                                </span>
                                <span style={{fontSize:11,color:"#d1d5db"}}>{corr.vuln_type}</span>
                                <span style={{fontSize:10,color:"#374151"}}>ligne {corr.vuln_ligne}</span>
                              </div>
                              <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>
                                💡 {corr.vuln_suggestion?.substring(0,150)}...
                              </div>
                              <details style={{fontSize:10,color:"#4b5563",marginTop:8}}>
                                <summary style={{cursor:"pointer",color:"#818cf8"}}>Voir le diff</summary>
                                <pre style={{marginTop:8,padding:8,background:"#030712",borderRadius:6,overflowX:"auto",fontSize:9,fontFamily:"monospace"}}>
                                  <span style={{color:"#f87171"}}>- Ligne {corr.vuln_ligne} (original)</span>{"\n"}
                                  <span style={{color:"#10b981"}}>+ Ligne {corr.vuln_ligne} (corrigé)</span>
                                </pre>
                              </details>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PUSH */}
      {showPush&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={()=>!pushLoading&&setShowPush(false)}>
          <div style={{background:"#0a0f1a",border:"1px solid #1e2538",borderRadius:18,width:"100%",maxWidth:500,padding:"26px 30px",boxShadow:"0 24px 80px rgba(0,0,0,0.7)",animation:"fade 0.2s ease"}} onClick={e=>e.stopPropagation()}>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:9,color:"#818cf8",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:6}}>↑ PUSH GITLAB</div>
              <div style={{fontSize:16,fontWeight:700,color:"#f1f5f9"}}>Pousser les modifications</div>
              <div style={{fontSize:10,color:"#374151",marginTop:4}}>{modifiedPaths.length} fichier{modifiedPaths.length>1?"s":""} · {data.projet}</div>
            </div>

            <div style={{background:"#030712",border:"1px solid #1e2538",borderRadius:8,padding:"8px 12px",marginBottom:16,maxHeight:90,overflowY:"auto"}}>
              {modifiedPaths.map(p=>(
                <div key={p} style={{fontSize:10,color:"#f59e0b",padding:"1px 0",display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:8}}>●</span>{p}
                </div>
              ))}
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Mode</div>
              <div style={{display:"flex",gap:8}}>
                {([{v:"existing",l:"✏️ Branche existante",d:"Commit direct"},{v:"new",l:"⑂ Nouvelle branche",d:"Créer une branche séparée"}] as const).map(o=>(
                  <button key={o.v} onClick={()=>{setPushMode(o.v);setPushBranch(o.v==="new"?`fix/ia-${Date.now().toString(36)}`:data.branche||"main");}}
                    style={{flex:1,padding:"9px 10px",cursor:"pointer",textAlign:"left",background:pushMode===o.v?"rgba(91,99,245,0.12)":"transparent",border:`1px solid ${pushMode===o.v?"rgba(91,99,245,0.35)":"#1e2538"}`,borderRadius:8}}>
                    <div style={{fontSize:11,color:pushMode===o.v?"#818cf8":"#6b7280",fontWeight:700}}>{o.l}</div>
                    <div style={{fontSize:9,color:"#374151",marginTop:2}}>{o.d}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>{pushMode==="new"?"Nom de la nouvelle branche":"Branche cible"}</div>
              <input value={pushBranch} onChange={e=>setPushBranch(e.target.value)} style={{width:"100%",background:"#030712",border:"1px solid #1e2538",borderRadius:7,padding:"8px 12px",color:"#d1d5db",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
            </div>

            <div style={{marginBottom:18}}>
              <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Message de commit</div>
              <input value={pushMsg} onChange={e=>setPushMsg(e.target.value)} style={{width:"100%",background:"#030712",border:"1px solid #1e2538",borderRadius:7,padding:"8px 12px",color:"#d1d5db",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
            </div>

            {pushRes&&(
              <div style={{background:pushRes.ok?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.07)",border:`1px solid ${pushRes.ok?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)"}`,borderRadius:8,padding:"10px 12px",marginBottom:14,animation:"fade 0.2s ease"}}>
                <div style={{fontSize:11,color:pushRes.ok?"#10b981":"#f87171"}}>{pushRes.ok?"✓":"✕"} {pushRes.msg}</div>
                {pushRes.url&&<a href={pushRes.url} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:5,fontSize:10,color:"#818cf8"}}>Voir sur GitLab →</a>}
              </div>
            )}

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowPush(false)} disabled={pushLoading} style={{flex:1,padding:"10px",background:"transparent",border:"1px solid #1e2538",borderRadius:8,color:"#4b5563",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Annuler</button>
              <button onClick={pusherGitLab} disabled={pushLoading||!pushBranch.trim()||!pushMsg.trim()}
                style={{flex:2,padding:"10px",background:"linear-gradient(135deg,#5b63f5,#9b5cf6)",border:"none",borderRadius:8,color:"white",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,opacity:pushLoading||!pushBranch.trim()?0.6:1}}>
                {pushLoading?<><span style={{width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.6s linear infinite",display:"inline-block"}}/>Push…</>:`↑ Pousser sur ${pushBranch}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast&&(
        <div style={{position:"fixed",bottom:20,right:20,zIndex:2000,animation:"fade 0.2s ease",background:toast.ok?"#0a0f1a":"rgba(239,68,68,0.15)",border:`1px solid ${toast.ok?"rgba(91,99,245,0.3)":"rgba(239,68,68,0.3)"}`,borderRadius:10,padding:"10px 16px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:toast.ok?"#818cf8":"#f87171",boxShadow:"0 8px 30px rgba(0,0,0,0.4)"}}>
          {toast.ok?"✓":"✕"} {toast.msg}
        </div>
      )}
    </>
  );}