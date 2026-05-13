"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader } from "../adminUtils";

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────
interface UserItem   { id: number; email: string; }
interface Depot      { id: number; nom: string; url: string; token: string; branche: string; }
interface TreeItem   { name: string; type: string; path?: string; }
interface Vuln       { id: string; type: string; severite: "critical"|"high"|"medium"|"low"; ligne: number; suggestion: string; }
interface CorrectionResult { contenu_corrige: string; explication: string; }

type PanelMode = "idle" | "loading-ai" | "review" | "pushing" | "done";

// ─────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────
const C = {
  bg:        "#07090f",
  panel:     "#0a0c14",
  border:    "#1a1d2e",
  border2:   "#242840",
  text:      "#e8eaf6",
  muted:     "#7b82a8",
  faint:     "#3a4060",
  accent:    "#5b63f5",
  accentLo:  "rgba(91,99,245,0.12)",
  accentBo:  "rgba(91,99,245,0.30)",
  green:     "#22c55e",
  greenLo:   "rgba(34,197,94,0.12)",
  greenBo:   "rgba(34,197,94,0.30)",
  red:       "#f87171",
  redLo:     "rgba(248,113,113,0.12)",
  redBo:     "rgba(248,113,113,0.30)",
  orange:    "#fb923c",
  yellow:    "#fbbf24",
  mono:      "'JetBrains Mono',monospace",
  sans:      "'Syne','Inter',sans-serif",
};

const SEV_COLOR: Record<string,string> = {
  critical: C.red, high: C.orange, medium: C.yellow, low: C.green,
};

const LANG_COLOR: Record<string,string> = {
  py:"#3b82f6", js:"#f59e0b", ts:"#60a5fa", tsx:"#60a5fa", jsx:"#60a5fa",
  css:"#ec4899", html:"#ef4444", json:"#22c55e", md:"#818cf8",
  go:"#22c55e", rs:"#f97316", java:"#ef4444", php:"#8b5cf6", rb:"#ec4899",
  sh:"#22c55e", yml:"#f59e0b", yaml:"#f59e0b", sql:"#60a5fa",
};
const ext  = (n: string) => n.split(".").pop()?.toLowerCase() || "";
const lc   = (n: string) => LANG_COLOR[ext(n)] || "#5a6080";

// ─────────────────────────────────────────────────────────
// MINI COMPONENTS
// ─────────────────────────────────────────────────────────
function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position:"fixed", bottom:28, right:28, zIndex:9999,
      background: ok ? C.greenLo : C.redLo,
      border:`1px solid ${ok ? C.greenBo : C.redBo}`,
      borderRadius:12, padding:"12px 20px",
      color: ok ? C.green : C.red,
      fontSize:13, fontWeight:600, fontFamily:C.mono,
      backdropFilter:"blur(12px)", boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
      display:"flex", alignItems:"center", gap:10,
    }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

function Spinner({ size=18, color=C.accent }: { size?: number; color?: string }) {
  return (
    <div style={{
      width:size, height:size, border:`2px solid ${color}33`,
      borderTopColor:color, borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0,
    }} />
  );
}

function SevBadge({ s }: { s: string }) {
  const col = SEV_COLOR[s] || C.muted;
  return (
    <span style={{
      background:`${col}18`, border:`1px solid ${col}44`, color:col,
      fontFamily:C.mono, fontSize:10, fontWeight:700,
      padding:"2px 8px", borderRadius:20, textTransform:"uppercase",
    }}>{s}</span>
  );
}

function CodeLine({ n, line, highlight }: { n: number; line: string; highlight?: boolean }) {
  return (
    <div style={{
      display:"flex", gap:0,
      background: highlight ? "rgba(251,146,60,0.08)" : "transparent",
      borderLeft: highlight ? `2px solid ${C.orange}` : "2px solid transparent",
    }}>
      <span style={{ color:C.faint, fontFamily:C.mono, fontSize:11, minWidth:44, paddingRight:12, userSelect:"none", textAlign:"right" }}>{n}</span>
      <span style={{ color: highlight ? "#fde68a" : C.text, fontFamily:C.mono, fontSize:11, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{line}</span>
    </div>
  );
}

function DiffView({ original, corrected, vulnLigne }: { original: string; corrected: string; vulnLigne: number }) {
  const origLines = original.split("\n");
  const corrLines = corrected.split("\n");
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, fontSize:11, fontFamily:C.mono }}>
      {/* Original */}
      <div style={{ background:"rgba(248,113,113,0.04)", borderRadius:"8px 0 0 8px", overflow:"auto", maxHeight:340 }}>
        <div style={{ padding:"6px 12px", fontSize:10, color:C.red, borderBottom:`1px solid ${C.border}`, fontWeight:600 }}>
          AVANT
        </div>
        <div style={{ padding:"8px 4px" }}>
          {origLines.map((l, i) => (
            <CodeLine key={i} n={i+1} line={l} highlight={i+1 === vulnLigne} />
          ))}
        </div>
      </div>
      {/* Corrected */}
      <div style={{ background:"rgba(34,197,94,0.04)", borderRadius:"0 8px 8px 0", overflow:"auto", maxHeight:340 }}>
        <div style={{ padding:"6px 12px", fontSize:10, color:C.green, borderBottom:`1px solid ${C.border}`, fontWeight:600 }}>
          APRÈS (IA)
        </div>
        <div style={{ padding:"8px 4px" }}>
          {corrLines.map((l, i) => (
            <CodeLine key={i} n={i+1} line={l} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DÉTECTION AUTOMATIQUE DE VULNS (client-side heuristics)
// ─────────────────────────────────────────────────────────
function detectVulns(content: string, filePath: string): Vuln[] {
  const vulns: Vuln[] = [];
  const lines = content.split("\n");
  const fext  = ext(filePath);

  const patterns: Array<{ regex: RegExp; type: string; severite: Vuln["severite"]; suggestion: string }> = [
    // Secrets / credentials
    { regex: /password\s*=\s*["'][^"']{4,}/i,  type:"Secret exposé",       severite:"critical", suggestion:"Utiliser une variable d'environnement au lieu d'un secret en dur." },
    { regex: /api_key\s*=\s*["'][^"']{8,}/i,    type:"Clé API exposée",     severite:"critical", suggestion:"Stocker la clé API dans les variables d'environnement." },
    { regex: /secret\s*=\s*["'][^"']{4,}/i,     type:"Secret en dur",       severite:"critical", suggestion:"Ne pas mettre de secret en dur dans le code source." },
    { regex: /token\s*=\s*["'][A-Za-z0-9_\-]{20,}/i, type:"Token exposé",  severite:"critical", suggestion:"Utiliser des variables d'environnement pour les tokens." },
    // SQL injection
    { regex: /f["'].*SELECT.*\{/i,               type:"Injection SQL",       severite:"high",     suggestion:"Utiliser des requêtes paramétrées (ORM ou prepared statements)." },
    { regex: /execute\s*\(\s*["'].*%s/i,         type:"Injection SQL",       severite:"high",     suggestion:"Utiliser des requêtes paramétrées." },
    // XSS
    { regex: /innerHTML\s*=/,                    type:"XSS potentiel",       severite:"high",     suggestion:"Utiliser textContent ou DOMPurify pour assainir le HTML." },
    { regex: /dangerouslySetInnerHTML/,          type:"XSS potentiel",       severite:"medium",   suggestion:"Éviter dangerouslySetInnerHTML ou valider et assainir le contenu." },
    // eval
    { regex: /\beval\s*\(/,                      type:"eval() dangereux",    severite:"high",     suggestion:"Éviter eval(). Utiliser JSON.parse() ou une alternative sûre." },
    // MD5
    { regex: /\bmd5\b/i,                         type:"Hash faible (MD5)",   severite:"medium",   suggestion:"Utiliser SHA-256 ou bcrypt pour les mots de passe." },
    // TODO / FIXME sécurité
    { regex: /\/\/\s*(TODO|FIXME|HACK|XXX)/i,   type:"Code non terminé",    severite:"low",      suggestion:"Résoudre ce point avant la mise en production." },
    // print/console debug
    { regex: /console\.log\s*\(.*password/i,    type:"Fuite de données",    severite:"high",     suggestion:"Ne jamais logger un mot de passe ou donnée sensible." },
    { regex: /print\s*\(.*password/i,            type:"Fuite de données",    severite:"high",     suggestion:"Ne jamais afficher un mot de passe en clair." },
    // URL hardcodée
    { regex: /https?:\/\/localhost/i,            type:"URL en dur",          severite:"low",      suggestion:"Utiliser une variable d'environnement pour l'URL de base." },
    // Exception silencieuse
    { regex: /except\s*:\s*\n\s*pass/,          type:"Exception silencieuse",severite:"medium",   suggestion:"Logger l'exception et gérer l'erreur explicitement." },
    { regex: /catch\s*\(\s*e\s*\)\s*\{\s*\}/,  type:"Exception silencieuse",severite:"medium",   suggestion:"Ne pas ignorer les erreurs : logger ou propager l'exception." },
  ];

  lines.forEach((line, i) => {
    patterns.forEach(p => {
      if (p.regex.test(line)) {
        // eviter doublons sur la même ligne + même type
        if (!vulns.find(v => v.ligne === i+1 && v.type === p.type)) {
          vulns.push({
            id:         `${i+1}-${p.type}`,
            type:       p.type,
            severite:   p.severite,
            ligne:      i+1,
            suggestion: p.suggestion,
          });
        }
      }
    });
  });

  return vulns.slice(0, 12); // max 12 par fichier
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────
export default function AdminExplorerPage() {
  // ── Navigation state ──────────────────────────────────
  const [users,      setUsers]      = useState<UserItem[]>([]);
  const [selUser,    setSelUser]    = useState<UserItem | null>(null);
  const [depots,     setDepots]     = useState<Depot[]>([]);
  const [selDepot,   setSelDepot]   = useState<Depot | null>(null);
  const [branches,   setBranches]   = useState<string[]>([]);
  const [selBranch,  setSelBranch]  = useState("");
  const [tree,       setTree]       = useState<TreeItem[]>([]);
  const [pathStack,  setPathStack]  = useState<string[]>([]);
  const [curPath,    setCurPath]    = useState("");

  // ── File state ────────────────────────────────────────
  const [selFile,     setSelFile]     = useState<TreeItem | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [vulns,       setVulns]       = useState<Vuln[]>([]);
  const [selVuln,     setSelVuln]     = useState<Vuln | null>(null);

  // ── Correction panel state ────────────────────────────
  const [panelMode,    setPanelMode]    = useState<PanelMode>("idle");
  const [correction,   setCorrection]   = useState<CorrectionResult | null>(null);
  const [mrBranch,     setMrBranch]     = useState("");
  const [mrTitle,      setMrTitle]      = useState("");
  const [mrDesc,       setMrDesc]       = useState("");
  const [mrUrl,        setMrUrl]        = useState("");

  // ── Loading flags ─────────────────────────────────────
  const [loadingUsers,  setLoadingUsers]  = useState(true);
  const [loadingDepots, setLoadingDepots] = useState(false);
  const [loadingTree,   setLoadingTree]   = useState(false);
  const [loadingFile,   setLoadingFile]   = useState(false);

  // ── Toast ─────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => setToast({ msg, ok });

  // ─── Load users ──────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/admin/users`, { headers: getHeaders() })
      .then(r => setUsers(r.data))
      .catch(() => showToast("Impossible de charger les utilisateurs", false))
      .finally(() => setLoadingUsers(false));
  }, []);

  // ─── Select user ─────────────────────────────────────
  async function onSelectUser(uid: string) {
    const u = users.find(x => String(x.id) === uid) || null;
    setSelUser(u); setSelDepot(null); setBranches([]); setSelBranch("");
    setTree([]); setSelFile(null); setFileContent(""); setVulns([]); setSelVuln(null); resetPanel();
    if (!u) return;
    setLoadingDepots(true);
    try {
      const r = await axios.get(`${API}/depots/user/${u.id}`, { headers: getHeaders() });
      setDepots(r.data);
    } catch { showToast("Impossible de charger les dépôts", false); setDepots([]); }
    setLoadingDepots(false);
  }

  // ─── Select depot ─────────────────────────────────────
  async function onSelectDepot(d: Depot) {
    setSelDepot(d); setSelBranch(""); setTree([]); setSelFile(null);
    setFileContent(""); setVulns([]); setSelVuln(null); resetPanel(); setPathStack([]); setCurPath("");
    try {
      const r = await axios.get(`${API}/depots/${d.id}/branches`, { headers: getHeaders() });
      setBranches(r.data.branches || r.data || []);
    } catch { setBranches([]); }
  }

  // ─── Load tree ────────────────────────────────────────
  async function loadTree(branch: string, p = "") {
    setSelBranch(branch); setLoadingTree(true);
    setSelFile(null); setFileContent(""); setVulns([]); setSelVuln(null); resetPanel();
    try {
      const r = await axios.get(`${API}/explorer/tree`, {
        headers: getHeaders(),
        params: { depot_id: selDepot!.id, branch, path: p },
      });
      setTree(r.data.tree || r.data || []);
      setCurPath(p);
    } catch { setTree([]); }
    setLoadingTree(false);
  }

  // ─── Open file or dir ─────────────────────────────────
  async function openItem(item: TreeItem) {
    if (item.type === "tree" || item.type === "dir") {
      const newPath = curPath ? `${curPath}/${item.name}` : item.name;
      setPathStack(ps => [...ps, curPath]);
      await loadTree(selBranch, newPath);
      return;
    }
    setSelFile(item); setLoadingFile(true); resetPanel(); setSelVuln(null);
    const filePath = curPath ? `${curPath}/${item.name}` : item.name;
    try {
      const r = await axios.get(`${API}/explorer/file`, {
        headers: getHeaders(),
        params: { depot_id: selDepot!.id, branch: selBranch, path: filePath },
      });
      const content = r.data.content || "";
      setFileContent(content);
      setVulns(detectVulns(content, filePath));
    } catch { setFileContent(""); showToast("Impossible de charger le fichier", false); }
    setLoadingFile(false);
  }

  // ─── Breadcrumb back ──────────────────────────────────
  function goBack() {
    const prev = pathStack[pathStack.length - 1] ?? "";
    setPathStack(ps => ps.slice(0, -1));
    loadTree(selBranch, prev);
  }

  // ─── Reset correction panel ───────────────────────────
  function resetPanel() {
    setPanelMode("idle"); setCorrection(null); setMrBranch(""); setMrTitle(""); setMrDesc(""); setMrUrl("");
  }

  // ─── Request AI correction ────────────────────────────
  async function requestAI(vuln: Vuln) {
    if (!selFile || !fileContent) return;
    setSelVuln(vuln); setPanelMode("loading-ai"); setCorrection(null);
    const filePath = curPath ? `${curPath}/${selFile.name}` : selFile.name;
    const numbered = fileContent.split("\n").map((l, i) => `${String(i+1).padStart(4," ")} | ${l}`).join("\n");
    try {
      const r = await axios.post(`${API}/explorer/corriger`, {
        fichier_path:    filePath,
        contenu_numerote: numbered,
        vuln_type:       vuln.type,
        vuln_ligne:      vuln.ligne,
        vuln_suggestion: vuln.suggestion,
        severite:        vuln.severite,
      }, { headers: getHeaders() });
      setCorrection(r.data);
      // auto-fill MR fields
      const branchName = `admin/fix/${vuln.type.toLowerCase().replace(/[^a-z0-9]/g,"-")}-${Date.now()}`;
      setMrBranch(branchName);
      setMrTitle(`[Admin] Fix: ${vuln.type} dans ${selFile.name}`);
      setMrDesc(`Correction automatique IA de la vulnérabilité **${vuln.type}** (${vuln.severite}).\n\nFichier: \`${filePath}\` — Ligne ${vuln.ligne}\n\n${vuln.suggestion}\n\n> Explication IA: ${r.data.explication}`);
      setPanelMode("review");
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "Erreur lors de la correction IA", false);
      setPanelMode("idle");
    }
  }

  // ─── Push + Create MR ────────────────────────────────
  async function pushAndCreateMR() {
    if (!selDepot || !correction || !selFile) return;
    setPanelMode("pushing");
    const filePath = curPath ? `${curPath}/${selFile.name}` : selFile.name;
    try {
      // 1. Push vers GitLab
      const pushRes = await axios.post(`${API}/explorer/push`, {
        token:       selDepot.token,
        projet:      selDepot.url,
        branche_src: selBranch,
        branche_dst: mrBranch,
        mode:        "new",
        message:     `fix: ${selVuln?.type} dans ${selFile.name} [admin-ai]`,
        fichiers:    [{ path: filePath, contenu: correction.contenu_corrige }],
      }, { headers: getHeaders() });

      // 2. Créer MR via python-gitlab côté backend (direct API call)
      const gl = `${selDepot.url.replace(/\.git$/, "")}`;
      const mrRes = await axios.post(`${API}/explorer/gitlab/create-mr`, {
        token:         selDepot.token,
        projet:        selDepot.url,
        branche_src:   mrBranch,
        branche_dst:   selBranch,
        titre:         mrTitle,
        description:   mrDesc,
      }, { headers: getHeaders() });

      const mrData = mrRes.data;
      setMrUrl(mrData.mr_url || "");

      // 3. Sauvegarder en base
      await axios.post(`${API}/explorer/mr/save`, {
        projet_nom:    selDepot.nom,
        projet_chemin: selDepot.url,
        branche_source: mrBranch,
        branche_cible:  selBranch,
        titre:          mrTitle,
        description:    mrDesc,
        mr_id_gitlab:   mrData.mr_id || 0,
        mr_iid_gitlab:  mrData.mr_iid || 0,
        mr_url:         mrData.mr_url || "",
        fichiers_modifies: [filePath],
      }, { headers: getHeaders() });

      setPanelMode("done");
      showToast("MR créée avec succès dans le dépôt du client ✓");
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "Erreur lors de la création de la MR", false);
      setPanelMode("review");
    }
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  const filePath = selFile ? (curPath ? `${curPath}/${selFile.name}` : selFile.name) : "";

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(5px) } to { opacity:1; transform:none } }
        @keyframes slideIn { from { opacity:0; transform:translateX(18px) } to { opacity:1; transform:none } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.45} }
        *::-webkit-scrollbar { width:4px; height:4px; }
        *::-webkit-scrollbar-track { background:transparent; }
        *::-webkit-scrollbar-thumb { background:${C.border2}; border-radius:4px; }
      `}</style>

      <div style={{ flex:1, background:C.bg, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:C.sans }}>
        <PageHeader icon="⊞" title="Explorateur & Correction IA" sub="Parcourir le code des clients · Détecter · Corriger · Créer MR" />

        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ═══════════════════════════════════════════════
              PANEL 1 — Sélecteur (user › dépôt › branche)
          ═══════════════════════════════════════════════ */}
          <div style={{ width:230, borderRight:`1px solid ${C.border}`, background:C.panel, display:"flex", flexDirection:"column", gap:0, overflowY:"auto", flexShrink:0 }}>

            {/* Section User */}
            <SideSection label="Utilisateur">
              {loadingUsers ? <div style={{ display:"flex", justifyContent:"center", padding:12 }}><Spinner size={14} /></div> : (
                <select
                  value={selUser?.id ?? ""}
                  onChange={e => onSelectUser(e.target.value)}
                  style={{ width:"100%", padding:"7px 10px", background:"#07090f", border:`1px solid ${C.border}`, borderRadius:8, color:selUser?C.text:C.muted, fontSize:11, fontFamily:C.mono, outline:"none" }}
                >
                  <option value="">Choisir...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                </select>
              )}
            </SideSection>

            {/* Section Dépôts */}
            {selUser && (
              <SideSection label="Dépôt">
                {loadingDepots ? <div style={{ display:"flex", justifyContent:"center", padding:12 }}><Spinner size={14} /></div> :
                 depots.length === 0 ? <p style={{ fontSize:10, color:C.faint, fontFamily:C.mono, padding:"4px 0" }}>Aucun dépôt</p> :
                 depots.map(d => (
                   <SideBtn key={d.id} active={selDepot?.id===d.id} onClick={() => onSelectDepot(d)}>
                     <span style={{ color:selDepot?.id===d.id?C.accent:C.faint, fontSize:9 }}>▣</span> {d.nom}
                   </SideBtn>
                 ))
                }
              </SideSection>
            )}

            {/* Section Branches */}
            {selDepot && branches.length > 0 && (
              <SideSection label="Branche">
                {branches.map(b => (
                  <SideBtn key={b} active={selBranch===b} onClick={() => { setPathStack([]); loadTree(b, ""); }}>
                    <span style={{ color:"#5b63f5", fontSize:8 }}>⬡</span> {b}
                  </SideBtn>
                ))}
              </SideSection>
            )}
          </div>

          {/* ═══════════════════════════════════════════════
              PANEL 2 — Arbre de fichiers
          ═══════════════════════════════════════════════ */}
          <div style={{ width:240, borderRight:`1px solid ${C.border}`, background:C.panel, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
            {/* Breadcrumb */}
            <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:6, minHeight:40, flexShrink:0 }}>
              {(pathStack.length > 0 || curPath) && (
                <button onClick={goBack} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px", borderRadius:4 }}>←</button>
              )}
              <span style={{ fontSize:10, color:C.muted, fontFamily:C.mono, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {curPath ? `/${curPath}` : selBranch ? "/" : "—"}
              </span>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:6 }}>
              {loadingTree ? (
                <div style={{ display:"flex", justifyContent:"center", padding:32 }}><Spinner /></div>
              ) : tree.length === 0 && selBranch ? (
                <Placeholder>Répertoire vide</Placeholder>
              ) : !selBranch ? (
                <Placeholder>Sélectionner un dépôt et une branche</Placeholder>
              ) : tree.map((item, i) => {
                const isDir = item.type==="tree"||item.type==="dir";
                const active = selFile?.name === item.name && !isDir;
                return (
                  <button key={i} onClick={() => openItem(item)} style={{
                    width:"100%", padding:"5px 8px",
                    background: active ? C.accentLo : "transparent",
                    border: active ? `1px solid ${C.accentBo}` : "1px solid transparent",
                    borderRadius:6, color:C.muted, fontSize:11, fontFamily:C.mono,
                    textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:7,
                    animation:"fadeIn 0.15s ease backwards", animationDelay:`${i*0.018}s`,
                  }}>
                    <span style={{ color: isDir ? "#818cf8" : lc(item.name), flexShrink:0, fontSize:isDir?12:9 }}>{isDir?"▶":"◆"}</span>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: active ? C.text : C.muted }}>{item.name}</span>
                    {!isDir && vulns.length > 0 && selFile?.name === item.name && (
                      <span style={{ marginLeft:"auto", background:C.redLo, color:C.red, fontSize:9, padding:"1px 5px", borderRadius:10, fontWeight:700 }}>{vulns.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════
              PANEL 3 — Contenu du fichier + Vulnérabilités
          ═══════════════════════════════════════════════ */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

            {/* Topbar fichier */}
            {selFile && (
              <div style={{ padding:"8px 16px", borderBottom:`1px solid ${C.border}`, background:C.panel, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <span style={{ color:lc(selFile.name), fontSize:11 }}>◆</span>
                <span style={{ color:C.text, fontSize:12, fontFamily:C.mono, fontWeight:600 }}>{selFile.name}</span>
                <span style={{ color:C.faint, fontSize:10, fontFamily:C.mono }}>{filePath}</span>
                {vulns.length > 0 && (
                  <span style={{ marginLeft:"auto", background:C.redLo, border:`1px solid ${C.redBo}`, color:C.red, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, fontFamily:C.mono }}>
                    {vulns.length} vulnérabilité{vulns.length>1?"s":""} détectée{vulns.length>1?"s":""}
                  </span>
                )}
                {vulns.length === 0 && fileContent && !loadingFile && (
                  <span style={{ marginLeft:"auto", background:C.greenLo, border:`1px solid ${C.greenBo}`, color:C.green, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, fontFamily:C.mono }}>
                    ✓ Aucune vulnérabilité
                  </span>
                )}
              </div>
            )}

            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

              {/* Code viewer */}
              <div style={{ flex:1, overflowY:"auto", padding: selFile ? "16px 20px" : 0 }}>
                {loadingFile ? (
                  <div style={{ display:"flex", justifyContent:"center", padding:48 }}><Spinner size={24} /></div>
                ) : selFile && fileContent ? (
                  <pre style={{ margin:0, color:C.muted, fontSize:11, fontFamily:C.mono, lineHeight:1.7 }}>
                    {fileContent.split("\n").map((line, i) => {
                      const isVuln = vulns.some(v => v.ligne === i+1);
                      return (
                        <div key={i} style={{
                          display:"flex", gap:0,
                          background: isVuln ? "rgba(251,146,60,0.07)" : "transparent",
                          borderLeft: isVuln ? `2px solid ${C.orange}` : "2px solid transparent",
                        }}>
                          <span style={{ color:C.faint, minWidth:44, paddingRight:12, textAlign:"right", userSelect:"none", flexShrink:0 }}>{i+1}</span>
                          <span style={{ color: isVuln ? "#fde68a" : C.text, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{line}</span>
                          {isVuln && (
                            <span style={{ marginLeft:8, color:C.orange, fontSize:9, alignSelf:"center", animation:"pulse 1.8s infinite", flexShrink:0 }}>
                              ⚠ {vulns.find(v=>v.ligne===i+1)?.type}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </pre>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:14 }}>
                    <span style={{ fontSize:44, color:C.faint }}>⊞</span>
                    <p style={{ color:C.faint, fontSize:12, fontFamily:C.mono }}>
                      {selBranch ? "Sélectionner un fichier" : "Choisir une branche"}
                    </p>
                  </div>
                )}
              </div>

              {/* ─── VULNS SIDEBAR ─── */}
              {vulns.length > 0 && !loadingFile && (
                <div style={{ width:290, borderLeft:`1px solid ${C.border}`, background:C.panel, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
                  <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.red, fontFamily:C.mono, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ animation:"pulse 1.8s infinite" }}>⚠</span> Vulnérabilités ({vulns.length})
                  </div>
                  <div style={{ flex:1, overflowY:"auto", padding:8, display:"flex", flexDirection:"column", gap:5 }}>
                    {vulns.map((v, i) => (
                      <div key={v.id}
                        onClick={() => selVuln?.id === v.id ? setSelVuln(null) : setSelVuln(v)}
                        style={{
                          padding:"9px 11px", borderRadius:9, cursor:"pointer",
                          background: selVuln?.id===v.id ? `${SEV_COLOR[v.severite]}14` : `${C.border}44`,
                          border:`1px solid ${selVuln?.id===v.id ? `${SEV_COLOR[v.severite]}44` : C.border}`,
                          animation:"fadeIn 0.2s ease backwards", animationDelay:`${i*0.04}s`,
                          transition:"all 0.15s",
                        }}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                          <SevBadge s={v.severite} />
                          <span style={{ color:C.faint, fontSize:10, fontFamily:C.mono }}>L.{v.ligne}</span>
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>{v.type}</div>
                        <div style={{ fontSize:10, color:C.muted, lineHeight:1.4 }}>{v.suggestion}</div>

                        {selVuln?.id === v.id && (
                          <div style={{ marginTop:10, animation:"slideIn 0.2s ease" }}>
                            {panelMode === "idle" && (
                              <button
                                onClick={e => { e.stopPropagation(); requestAI(v); }}
                                style={{
                                  width:"100%", padding:"8px", borderRadius:8, cursor:"pointer",
                                  background:`linear-gradient(135deg,${C.accent},#7c3aed)`,
                                  border:"none", color:"#fff", fontSize:12, fontWeight:700,
                                  display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                                }}
                              >
                                ✦ Corriger avec l'IA
                              </button>
                            )}
                            {panelMode === "loading-ai" && (
                              <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center", padding:"8px 0" }}>
                                <Spinner size={14} color="#7c3aed" />
                                <span style={{ fontSize:11, color:"#818cf8", fontFamily:C.mono }}>Analyse IA en cours...</span>
                              </div>
                            )}
                            {(panelMode === "review" || panelMode === "pushing" || panelMode === "done") && correction && (
                              <span style={{ fontSize:10, color:C.green, fontFamily:C.mono }}>✓ Correction prête → voir le panneau</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════
              PANEL 4 — Correction Review + Push MR
          ═══════════════════════════════════════════════ */}
          {(panelMode === "review" || panelMode === "pushing" || panelMode === "done") && correction && selVuln && (
            <div style={{
              width:480, borderLeft:`1px solid ${C.border}`, background:C.panel,
              display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0,
              animation:"slideIn 0.25s ease",
            }}>
              {/* Header */}
              <div style={{ padding:"12px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:C.text }}>Correction IA</div>
                  <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginTop:2 }}>{selVuln.type} · ligne {selVuln.ligne}</div>
                </div>
                <button onClick={resetPanel} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:16 }}>

                {/* Explication */}
                <div style={{ background:`${C.greenLo}`, border:`1px solid ${C.greenBo}`, borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:C.green, fontFamily:C.mono, fontWeight:700, marginBottom:4 }}>✦ EXPLICATION IA</div>
                  <div style={{ fontSize:12, color:C.text, lineHeight:1.55 }}>{correction.explication}</div>
                </div>

                {/* Diff */}
                <div>
                  <div style={{ fontSize:11, color:C.muted, fontFamily:C.mono, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Différence</div>
                  <DiffView original={fileContent} corrected={correction.contenu_corrige} vulnLigne={selVuln.ligne} />
                </div>

                {/* MR Form */}
                {panelMode !== "done" ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:11, color:C.muted, fontFamily:C.mono, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Créer une Merge Request</div>

                    <FieldGroup label="Branche cible">
                      <input value={mrBranch} onChange={e=>setMrBranch(e.target.value)}
                        style={inputStyle} placeholder="admin/fix/vuln-name-1234567890" />
                    </FieldGroup>

                    <FieldGroup label="Titre de la MR">
                      <input value={mrTitle} onChange={e=>setMrTitle(e.target.value)}
                        style={inputStyle} placeholder="[Admin] Fix: ..." />
                    </FieldGroup>

                    <FieldGroup label="Description">
                      <textarea value={mrDesc} onChange={e=>setMrDesc(e.target.value)}
                        rows={4} style={{ ...inputStyle, resize:"vertical" }} />
                    </FieldGroup>

                    <button
                      disabled={panelMode==="pushing" || !mrBranch || !mrTitle}
                      onClick={pushAndCreateMR}
                      style={{
                        padding:"11px", borderRadius:10, cursor: panelMode==="pushing"?"not-allowed":"pointer",
                        background: `linear-gradient(135deg,${C.accent},#7c3aed)`,
                        border:"none", color:"#fff", fontSize:13, fontWeight:800,
                        display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                        opacity: panelMode==="pushing" ? 0.7 : 1,
                      }}
                    >
                      {panelMode==="pushing" ? <><Spinner size={14} color="#fff" /> Push & Créer MR...</> : "⬆ Pousser & Créer MR GitLab"}
                    </button>
                  </div>
                ) : (
                  /* Done */
                  <div style={{ background:C.greenLo, border:`1px solid ${C.greenBo}`, borderRadius:12, padding:"18px 20px", textAlign:"center", animation:"fadeIn 0.3s ease" }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>✓</div>
                    <div style={{ fontSize:14, fontWeight:800, color:C.green, marginBottom:6 }}>MR créée avec succès !</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:14 }}>
                      La Merge Request a été créée dans le dépôt GitLab du client.<br/>
                      Il n'a plus qu'à merger.
                    </div>
                    {mrUrl && (
                      <a href={mrUrl} target="_blank" rel="noreferrer" style={{
                        display:"inline-flex", alignItems:"center", gap:6, padding:"8px 18px",
                        background:C.accentLo, border:`1px solid ${C.accentBo}`,
                        borderRadius:8, color:"#818cf8", fontSize:12, fontWeight:700, textDecoration:"none",
                      }}>
                        Voir la MR sur GitLab ↗
                      </a>
                    )}
                    <button onClick={resetPanel} style={{ display:"block", margin:"12px auto 0", background:"none", border:"none", color:C.faint, cursor:"pointer", fontSize:12 }}>
                      Fermer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width:"100%", padding:"8px 10px", background:"#07090f", border:`1px solid ${C.border2}`,
  borderRadius:8, color:C.text, fontSize:12, fontFamily:C.mono, outline:"none",
  boxSizing:"border-box",
};

function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding:"12px 12px 10px", borderBottom:`1px solid ${C.border}` }}>
      <p style={{ fontSize:9, color:C.faint, fontFamily:C.mono, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8, fontWeight:600 }}>{label}</p>
      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>{children}</div>
    </div>
  );
}

function SideBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding:"6px 9px", textAlign:"left", cursor:"pointer", fontSize:11, fontFamily:C.mono,
      background: active ? C.accentLo : "transparent",
      border: `1px solid ${active ? C.accentBo : "transparent"}`,
      borderRadius:7, color: active ? C.text : C.muted,
      display:"flex", alignItems:"center", gap:6, transition:"all 0.1s",
      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p style={{ color:C.faint, fontSize:10, fontFamily:C.mono, textAlign:"center", padding:"28px 12px" }}>⊘ {children}</p>;
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:10, color:C.muted, fontFamily:C.mono, marginBottom:5, fontWeight:600 }}>{label}</div>
      {children}
    </div>
  );
}
