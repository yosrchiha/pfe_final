"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader } from "../adminUtils";
import type { UserItem } from "../adminUtils";

export default function AdminExplorerPage() {
  const [users, setUsers]     = useState<UserItem[]>([]);
  const [selUser, setSelUser] = useState("");
  const [depots, setDepots]   = useState<any[]>([]);
  const [selDepot, setSelDepot] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selBranch, setSelBranch] = useState("");
  const [path, setPath]       = useState("");
  const [tree, setTree]       = useState<any[]>([]);
  const [fileContent, setFileContent] = useState<string|null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pathStack, setPathStack] = useState<string[]>([]);

  useEffect(() => {
    axios.get(`${API}/admin/users`, { headers: getHeaders() }).then(r=>setUsers(r.data)).catch(()=>{});
  }, []);

  async function onUser(uid: string) {
    setSelUser(uid); setSelDepot(null); setSelBranch(""); setTree([]); setFileContent(null); setPath("");
    if (!uid) return;
    try {
      const r = await axios.get(`${API}/depots/user/${uid}`, { headers: getHeaders() });
      setDepots(r.data);
    } catch { setDepots([]); }
  }

  async function onDepot(d: any) {
    setSelDepot(d); setSelBranch(""); setTree([]); setFileContent(null); setPath(""); setPathStack([]);
    try {
      const r = await axios.get(`${API}/depots/${d.id}/branches`, { headers: getHeaders() });
      setBranches(r.data.branches || r.data || []);
    } catch { setBranches([]); }
  }

  async function loadTree(branch: string, p: string = "") {
    setSelBranch(branch); setLoading(true); setFileContent(null); setFileName("");
    try {
      const r = await axios.get(`${API}/explorer/tree`, { headers: getHeaders(), params: { depot_id: selDepot.id, branch, path: p } });
      setTree(r.data.tree || r.data || []);
      setPath(p);
    } catch { setTree([]); }
    setLoading(false);
  }

  async function openItem(item: any) {
    if (item.type === "tree" || item.type === "dir") {
      const newPath = path ? `${path}/${item.name}` : item.name;
      setPathStack(prev => [...prev, path]);
      await loadTree(selBranch, newPath);
    } else {
      setLoading(true); setFileName(item.name);
      try {
        const r = await axios.get(`${API}/explorer/file`, { headers: getHeaders(), params: { depot_id: selDepot.id, branch: selBranch, path: path ? `${path}/${item.name}` : item.name } });
        setFileContent(r.data.content || "");
      } catch { setFileContent("Impossible de charger le fichier."); }
      setLoading(false);
    }
  }

  function goBack() {
    const prev = pathStack[pathStack.length - 1] ?? "";
    setPathStack(ps => ps.slice(0,-1));
    loadTree(selBranch, prev);
    setFileContent(null);
  }

  const LANG_EXT: Record<string,string> = {
    py:"#3b82f6", js:"#f59e0b", ts:"#60a5fa", tsx:"#60a5fa", jsx:"#60a5fa",
    css:"#ec4899", html:"#ef4444", json:"#22c55e", md:"#818cf8", go:"#22c55e",
    rs:"#f97316", java:"#ef4444", php:"#8b5cf6", rb:"#ec4899", sh:"#22c55e",
  };
  const getExt = (name: string) => name.split(".").pop()?.toLowerCase() || "";
  const getLangColor = (name: string) => LANG_EXT[getExt(name)] || "#5a6080";

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ flex:1, background:"#07090f", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <PageHeader icon="⊞" title="Explorateur de code" sub="Parcourir les fichiers des dépôts GitLab" />

        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* LEFT PANEL: selections */}
          <div style={{ width:260, borderRight:"1px solid #1e2235", background:"#0a0c14", padding:"16px 12px", overflowY:"auto", display:"flex", flexDirection:"column", gap:16, flexShrink:0 }}>
            {/* User */}
            <div>
              <p style={{ fontSize:9, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Utilisateur</p>
              <select value={selUser} onChange={e=>onUser(e.target.value)} style={{ width:"100%", padding:"8px 10px", background:"#07090f", border:"1px solid #1e2235", borderRadius:8, color:selUser?"#f1f3fc":"#5a6080", fontSize:11, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}>
                <option value="">Choisir...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>

            {/* Depots */}
            {depots.length > 0 && (
              <div>
                <p style={{ fontSize:9, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Dépôt</p>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {depots.map(d=>(
                    <button key={d.id} onClick={()=>onDepot(d)} style={{ padding:"7px 10px", background:selDepot?.id===d.id?"rgba(91,99,245,0.12)":"transparent", border:`1px solid ${selDepot?.id===d.id?"rgba(91,99,245,0.3)":"transparent"}`, borderRadius:7, color:selDepot?.id===d.id?"#818cf8":"#a8b0d0", fontSize:11, fontFamily:"'JetBrains Mono',monospace", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ opacity:0.6 }}>▣</span> {d.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Branches */}
            {selDepot && branches.length > 0 && (
              <div>
                <p style={{ fontSize:9, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Branche</p>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {branches.map(b=>(
                    <button key={b} onClick={()=>loadTree(b)} style={{ padding:"7px 10px", background:selBranch===b?"rgba(91,99,245,0.12)":"transparent", border:`1px solid ${selBranch===b?"rgba(91,99,245,0.3)":"transparent"}`, borderRadius:7, color:selBranch===b?"#818cf8":"#a8b0d0", fontSize:11, fontFamily:"'JetBrains Mono',monospace", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ color:"#5b63f5", fontSize:9 }}>⬡</span> {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FILE TREE */}
          <div style={{ width:280, borderRight:"1px solid #1e2235", background:"#0a0c14", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
            {/* Breadcrumb */}
            <div style={{ padding:"10px 14px", borderBottom:"1px solid #1e2235", display:"flex", alignItems:"center", gap:8, minHeight:44 }}>
              {(pathStack.length > 0 || path) && (
                <button onClick={goBack} style={{ background:"none", border:"none", color:"#5a6080", cursor:"pointer", fontSize:14, padding:"2px 6px", borderRadius:5 }}>←</button>
              )}
              <span style={{ fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {path ? `/${path}` : selBranch ? "/" : "—"}
              </span>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"6px" }}>
              {loading && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
                  <div style={{ width:20, height:20, border:"2px solid #1e2235", borderTopColor:"#5b63f5", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                </div>
              )}
              {!loading && tree.map((item, i) => {
                const isDir = item.type==="tree"||item.type==="dir";
                const color = isDir ? "#818cf8" : getLangColor(item.name);
                return (
                  <button key={i} onClick={()=>openItem(item)} style={{ width:"100%", padding:"6px 10px", background:fileName===item.name?"rgba(91,99,245,0.1)":"transparent", border:"none", borderRadius:6, color:"#a8b0d0", fontSize:11, fontFamily:"'JetBrains Mono',monospace", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:8, animation:"fadeIn 0.15s ease backwards", animationDelay:`${i*0.02}s` }}>
                    <span style={{ color, flexShrink:0, fontSize:isDir?13:10 }}>{isDir?"▶":"◆"}</span>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</span>
                    {!isDir && <span style={{ color:"#3a4060", fontSize:9, marginLeft:"auto" }}>.{getExt(item.name)}</span>}
                  </button>
                );
              })}
              {!loading && selBranch && tree.length === 0 && (
                <p style={{ color:"#3a4060", fontSize:11, fontFamily:"'JetBrains Mono',monospace", textAlign:"center", padding:"24px 12px" }}>⊘ Répertoire vide</p>
              )}
              {!selBranch && !loading && (
                <p style={{ color:"#3a4060", fontSize:11, fontFamily:"'JetBrains Mono',monospace", textAlign:"center", padding:"24px 12px" }}>Sélectionner un utilisateur et un dépôt</p>
              )}
            </div>
          </div>

          {/* FILE CONTENT */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {fileContent !== null ? (
              <>
                <div style={{ padding:"10px 16px", borderBottom:"1px solid #1e2235", background:"#0a0c14", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ color:getLangColor(fileName), fontSize:12 }}>◆</span>
                  <span style={{ color:"#f1f3fc", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{fileName}</span>
                  <span style={{ color:"#3a4060", fontSize:10, fontFamily:"'JetBrains Mono',monospace", marginLeft:"auto" }}>{path}</span>
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
                  <pre style={{ color:"#a8b0d0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0 }}>
                    {fileContent}
                  </pre>
                </div>
              </>
            ) : (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
                <span style={{ fontSize:40, color:"#1e2235" }}>⊞</span>
                <p style={{ color:"#3a4060", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
                  {selBranch ? "Sélectionner un fichier" : "Choisir un dépôt et une branche"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
