"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
const API = "http://localhost:8000";
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
type Theme = "dark" | "light";
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
  // ✅ FIX : mode "new" par défaut pour créer une MR automatiquement
  const [pushMode,    setPushMode]    = useState<"existing" | "new">("new");
  const [pushLoading, setPushLoading] = useState(false);
  // ✅ FIX : pushRes inclut mr_url séparé de url (commit)
  const [pushRes,     setPushRes]     = useState<{ ok: boolean; msg: string; url?: string; mr_url?: string } | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistory[]>([]);
  // UI only: theme preference does not modify any business action or API call.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("explorer_theme") as Theme | null;
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("explorer_theme", next);
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const jwt = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

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
    setAnalyses(prev => ({
      ...prev,
      [file.path]: prev[file.path]
        ? { ...prev[file.path], statut: "en_cours" }
        : {
            score_qualite: 0,
            score_securite: 0,
            score_performance: 0,
            vulnerabilites: [],
            recommandations: [],
            statut: "en_cours",
          },
    }));
    try {
      const res = await axios.post(`${API}/analyses-fichier/`,
        { projet_nom: data.projet, fichier_path: file.path, contenu: file.content, branche: data.branche },
        { headers: jwt() }
      );
      setAnalyses(prev => ({ ...prev, [file.path]: { ...res.data, statut: "termine" } }));
    } catch (error: unknown) {
      const e = error as AxiosError<{ detail?: string }>;
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
      setAnalyses(prev => { const next = { ...prev }; delete next[selFile.path]; return next; });
      await analyserFichier({ ...selFile, content: corrige });
      saveEditLocal(selFile.path, corrige);

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
        loadCorrectionHistory(selFile.path);
      } catch (saveErr) {
        console.error("[SAVE] Erreur:", saveErr);
      }

      let msg = res.data.explication || "Correction appliquée";
      if (typeof msg !== "string") msg = JSON.stringify(msg);
      setFixBanner({ ok: true, msg });

    } catch (error: unknown) {
      const e = error as AxiosError<{ detail?: string }>;
      let errorMsg = e.response?.data?.detail || e.message || "Échec de la correction IA";
      if (typeof errorMsg !== "string") errorMsg = JSON.stringify(errorMsg);
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
    // ✅ FIX : mode "new" par défaut + nom de branche auto généré
    setPushMode("new");
    setPushBranch(`fix/ia-${Date.now().toString(36)}`);
    setPushMsg(`fix: corrections IA — ${modifiedPaths.length} fichier(s)`);
    setPushRes(null);
    setShowPush(true);
  };

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

      // ✅ FIX : récupérer mr_url séparément de url (commit)
      setPushRes({
        ok: true,
        msg: res.data.message,
        url: res.data.url,
        mr_url: res.data.mr_url || null,
      });

      // Sauvegarde MR en base
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
            mr_url: res.data.mr_url || res.data.url,
            fichiers_modifies: modifiedPaths
          }, { headers: jwt() });
        } catch (saveErr) {
          console.error("[SAVE] Erreur sauvegarde MR:", saveErr);
        }
      }

      setEdits({});
      if (selFile) setEditContent(selFile.content);
      showToast("Push réussi !");

    } catch (error: unknown) {
      const e = error as AxiosError<{ detail?: string }>;
      const d = e.response?.data?.detail;
      setPushRes({ ok: false, msg: typeof d === "string" ? d : "Erreur lors du push" });
    } finally {
      setPushLoading(false);
    }
  };

  const toggleDir = (p: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactElement[] =>
    nodes.flatMap(node => {
      const isSel   = selFile?.path === node.path;
      const isDirty = node.file ? (node.file.path in edits && edits[node.file.path] !== node.file.content) : false;
      const ana     = node.file ? analyses[node.file.path] : null;
      return [
        <div
          key={node.path}
          className={`xp-tree-row ${node.type === "dir" ? "is-dir" : "is-file"} ${isSel ? "is-selected" : ""}`}
          style={{ paddingLeft: depth * 14 + (node.type === "dir" ? 10 : 26) }}
          onClick={() => node.type === "dir" ? toggleDir(node.path) : selectFile(node.file!)}
        >
          {node.type === "dir" ? (
            <>
              <span className="xp-chevron">{expanded.has(node.path) ? "▾" : "▸"}</span>
              <span className="xp-folder">▦</span>
              <span className="xp-tree-name">{node.name}</span>
            </>
          ) : (
            <>
              <span className="xp-file-icon">{fileIcon(node.path)}</span>
              <span className="xp-tree-name">{node.name}</span>
              {isDirty && <span className="xp-dot dirty" title="Modifié" />}
              {ana?.statut === "termine" && !isDirty && <span className="xp-dot valid" title="Analysé" />}
              {ana?.statut === "en_cours" && <span className="xp-spinner small" title="Analyse en cours" />}
              <button
                className="xp-tree-analyse"
                onClick={e => { e.stopPropagation(); analyserFichier(node.file!); }}
                title="Analyser ce fichier"
              >
                Analyser
              </button>
            </>
          )}
        </div>,
        ...(node.type === "dir" && expanded.has(node.path) && node.children ? renderTree(node.children, depth + 1) : [])
      ];
    });

  if (!data) return (
    <div className={`xp-loading ${theme}`}>
      <span className="xp-spinner" />
      <span>Chargement de l&apos;explorateur…</span>
      <style>{explorerStyles}</style>
    </div>
  );

  const tree      = buildTree(data.fichiers, search);
  const ana       = selFile ? analyses[selFile.path] : null;
  const isDirty   = selFile ? (selFile.path in edits && edits[selFile.path] !== selFile.content) : false;
  const displayed = selFile ? (edits[selFile.path] ?? selFile.content) : "";
  const fileHistory = correctionHistory.length;

  return (
    <>
      <style>{explorerStyles}</style>
      <div className={`xp-shell ${theme}`}>
        <header className="xp-topbar">
          <div className="xp-brand">
            <button className="xp-icon-button" onClick={() => router.push("/Exploreformpage")} aria-label="Retour">←</button>
            <div className="xp-logo">AI</div>
            <div>
              <div className="xp-brand-title">Code Explorer</div>
              <div className="xp-brand-subtitle">AuditIA · Analyse et correction intelligente</div>
            </div>
          </div>

          <div className="xp-project-bar">
            <div className="xp-project-title">{data.projet}</div>
            <span className="xp-pill branch">⑂ {data.branche}</span>
            <span className="xp-pill neutral">{data.total} fichiers</span>
            {modifiedPaths.length > 0 && <span className="xp-pill warning">● {modifiedPaths.length} modifié{modifiedPaths.length > 1 ? "s" : ""}</span>}
          </div>

          <div className="xp-actions">
            <button className="xp-theme-toggle" onClick={toggleTheme} aria-label="Changer le thème">
              <span>{theme === "dark" ? "☀" : "☾"}</span>
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </button>
            {modifiedPaths.length > 0 && (
              <button className="xp-primary-button" onClick={openPushModal}>
                ↑ Push GitLab
              </button>
            )}
          </div>
        </header>

        <main className="xp-content">
          <aside className="xp-sidebar">
            <div className="xp-repository-card">
              <div className="xp-label">Dépôt actif</div>
              <div className="xp-repository-name">{data.projet}</div>
              <div className="xp-repository-meta">
                <span className="xp-status-dot" /> Branche {data.branche}
              </div>
            </div>

            <div className="xp-sidebar-header">
              <div>
                <div className="xp-label">Explorateur</div>
                <div className="xp-sidebar-title">Fichiers du projet</div>
              </div>
              <span className="xp-count">{data.fichiers.length}</span>
            </div>
            <label className="xp-search">
              <span>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un fichier…" />
            </label>
            <div className="xp-tree">{renderTree(tree)}</div>
            <div className="xp-sidebar-footer">
              <div className="xp-help-icon">✦</div>
              <div>
                <strong>Conseil IA</strong>
                <p>Sélectionnez un fichier puis lancez une analyse ciblée.</p>
              </div>
            </div>
          </aside>

          <section className="xp-workspace">
            {!selFile ? (
              <div className="xp-empty">
                <div className="xp-empty-icon">⌘</div>
                <h2>Explorez votre dépôt</h2>
                <p>Sélectionnez un fichier pour consulter son code, l&apos;analyser ou appliquer une correction IA.</p>
                <div className="xp-empty-features">
                  <span>Analyse ciblée</span>
                  <span>Correction assistée</span>
                  <span>Push sécurisé</span>
                </div>
              </div>
            ) : (
              <>
                <div className="xp-file-header">
                  <div className="xp-file-identity">
                    <span className="xp-file-large-icon">{fileIcon(selFile.path)}</span>
                    <div>
                      <div className="xp-file-path">{selFile.path}</div>
                      <div className="xp-file-metadata">
                        {selFile.size} octets
                        {isDirty && <span className="xp-inline-warning">● Modifications non poussées</span>}
                        {ana?.statut === "termine" && !isDirty && <span className="xp-inline-valid">✓ Analyse terminée</span>}
                      </div>
                    </div>
                  </div>
                  <div className="xp-file-buttons">
                    <button className="xp-secondary-button" onClick={() => analyserFichier(selFile)} disabled={loadingAna}>
                      {loadingAna ? <><span className="xp-spinner small" /> Analyse…</> : "✦ Analyser"}
                    </button>
                    <button className="xp-secondary-button accent" onClick={openEditor}>✎ Éditer</button>
                  </div>
                </div>

                <nav className="xp-tabs" aria-label="Onglets fichier">
                  {(["code", "analyse", "edit", "history"] as Tab[]).map(t => {
                    const labels: Record<Tab, string> = { code: "Code", analyse: "Analyse IA", edit: "Éditeur", history: "Historique" };
                    const icons: Record<Tab, string> = { code: "</>", analyse: "✦", edit: "✎", history: "↺" };
                    const active = activeTab === t;
                    return (
                      <button
                        key={t}
                        className={`xp-tab ${active ? "active" : ""}`}
                        onClick={() => {
                          if (t === "edit") openEditor();
                          else {
                            if (t === "history") loadCorrectionHistory(selFile.path);
                            setActiveTab(t);
                          }
                        }}
                      >
                        <span>{icons[t]}</span>{labels[t]}
                        {t === "analyse" && ana?.statut === "termine" && <i className="xp-badge-dot valid" />}
                        {t === "edit" && isDirty && <i className="xp-badge-dot dirty" />}
                        {t === "history" && fileHistory > 0 && <em>{fileHistory}</em>}
                      </button>
                    );
                  })}
                </nav>

                <div className="xp-panel">
                  {activeTab === "code" && (
                    <div className="xp-code-window">
                      <div className="xp-code-toolbar">
                        <span>Lecture seule</span>
                        <span>{displayed.split("\n").length} lignes</span>
                      </div>
                      <div className="xp-code-lines">
                        {displayed.split("\n").map((line, i) => {
                          const lineNo = i + 1;
                          const vuln = ana?.vulnerabilites?.find(v => v.ligne === lineNo);
                          return (
                            <div key={i} className={`xp-code-line ${vuln ? "vulnerable" : ""}`} style={vuln ? { borderLeftColor: sevCol(vuln.severite), background: `${sevCol(vuln.severite)}10` } : undefined}>
                              <span className="xp-line-number">{lineNo}</span>
                              <pre>{line || " "}</pre>
                              {vuln && (
                                <button className="xp-severity" style={{ color: sevCol(vuln.severite), borderColor: `${sevCol(vuln.severite)}35`, background: `${sevCol(vuln.severite)}12` }} onClick={() => setActiveTab("analyse")}>
                                  ⚠ {vuln.severite}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === "analyse" && (
                    <div className="xp-analysis">
                      {loadingAna && ana?.statut === "en_cours" ? (
                        <div className="xp-state">
                          <span className="xp-spinner large" />
                          <h3>Analyse intelligente en cours</h3>
                          <p>Évaluation de la qualité, la sécurité et la performance du fichier.</p>
                        </div>
                      ) : ana?.statut === "termine" ? (
                        <>
                          <div className="xp-score-grid">
                            {[{ l: "Qualité", v: ana.score_qualite }, { l: "Sécurité", v: ana.score_securite }, { l: "Performance", v: ana.score_performance }].map(s => (
                              <div className="xp-score-card" key={s.l}>
                                <div className="xp-score-head"><span>{s.l}</span><strong style={{ color: scoreCol(s.v) }}>{s.v}</strong></div>
                                <div className="xp-score-track"><div style={{ width: `${s.v ?? 0}%`, background: scoreCol(s.v) }} /></div>
                                <small>{s.v >= 75 ? "Bon niveau" : s.v >= 50 ? "À améliorer" : "Critique"}</small>
                              </div>
                            ))}
                          </div>

                          {ana.vulnerabilites.length > 0 ? (
                            <section className="xp-result-section">
                              <div className="xp-section-title"><span className="red" /> Vulnérabilités détectées <b>{ana.vulnerabilites.length}</b></div>
                              <div className="xp-vuln-list">
                                {ana.vulnerabilites.map((v, i) => (
                                  <article className="xp-vuln" key={i} style={{ borderLeftColor: sevCol(v.severite) }}>
                                    <div className="xp-vuln-top">
                                      <div className="xp-vuln-meta">
                                        <span style={{ color: sevCol(v.severite), background: `${sevCol(v.severite)}12`, borderColor: `${sevCol(v.severite)}25` }}>{v.severite}</span>
                                        <strong>{v.type}</strong>
                                        <small>Ligne {v.ligne}</small>
                                      </div>
                                      <button className="xp-ai-button" onClick={() => corrigerParIA(v)} disabled={fixingVuln !== null}>
                                        {fixingVuln?.ligne === v.ligne && fixingVuln?.type === v.type ? <><span className="xp-spinner small" /> Correction…</> : "✦ Corriger par IA"}
                                      </button>
                                    </div>
                                    <p>Suggestion : {v.suggestion}</p>
                                  </article>
                                ))}
                              </div>
                            </section>
                          ) : (
                            <div className="xp-success-state"><div>✓</div><strong>Aucune vulnérabilité détectée</strong><span>Le fichier analysé ne présente pas de risque signalé.</span></div>
                          )}

                          {ana.recommandations.length > 0 && (
                            <section className="xp-result-section">
                              <div className="xp-section-title"><span className="green" /> Recommandations <b>{ana.recommandations.length}</b></div>
                              <div className="xp-recommendations">
                                {ana.recommandations.map((r, i) => (
                                  <article key={i}><strong>✓ {r.titre}</strong><p>{r.description}</p></article>
                                ))}
                              </div>
                            </section>
                          )}
                        </>
                      ) : ana?.statut === "erreur" ? (
                        <div className="xp-state error">
                          <div>!</div><h3>Analyse indisponible</h3><p>{ana.erreur}</p>
                          <button className="xp-primary-button" onClick={() => analyserFichier(selFile)}>Réessayer</button>
                        </div>
                      ) : (
                        <div className="xp-state">
                          <div className="xp-empty-icon">✦</div>
                          <h3>Prêt pour l&apos;analyse IA</h3>
                          <p>Lancez une analyse ciblée de ce fichier pour détecter les vulnérabilités et recommandations.</p>
                          <button className="xp-primary-button" onClick={() => analyserFichier(selFile)}>Analyser ce fichier</button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "edit" && (
                    <div className="xp-editor">
                      {fixBanner && (
                        <div className={`xp-banner ${fixBanner.ok ? "success" : "error"}`}>
                          <span>{fixBanner.ok ? "✦" : "!"}</span>
                          <p>{fixBanner.msg}</p>
                          {fixBanner.ok && <button onClick={() => { setEditContent(selFile.content); setFixBanner(null); handleRevert(); }}>Annuler la correction</button>}
                          <button className="close" onClick={() => setFixBanner(null)}>×</button>
                        </div>
                      )}
                      <div className="xp-editor-actions">
                        <span>Édition sécurisée · Les changements restent locaux avant push</span>
                        <div>
                          <button className="xp-secondary-button" onClick={handleRevert} disabled={!isDirty}>Annuler</button>
                          <button className="xp-primary-button" onClick={handleSave}>Sauvegarder localement</button>
                        </div>
                      </div>
                      <div className="xp-editor-body">
                        <div className="xp-gutter">{editContent.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}</div>
                        <textarea ref={textareaRef} value={editContent} onChange={e => setEditContent(e.target.value)} spellCheck={false} />
                      </div>
                    </div>
                  )}

                  {activeTab === "history" && (
                    <div className="xp-history">
                      <div className="xp-history-header">
                        <div><div className="xp-label">Traçabilité</div><h3>Corrections IA appliquées</h3><p>{selFile.path}</p></div>
                        <span className="xp-count">{correctionHistory.length}</span>
                      </div>
                      {correctionHistory.length === 0 ? (
                        <div className="xp-state small-state"><div className="xp-empty-icon">↺</div><h3>Aucune correction enregistrée</h3><p>Les corrections IA appliquées à ce fichier apparaîtront ici.</p></div>
                      ) : (
                        <div className="xp-history-list">
                          {correctionHistory.map(corr => (
                            <article key={corr.id} className="xp-history-card">
                              <div className="xp-history-top">
                                <span className="xp-pill branch">#{corr.id}</span>
                                <time>{new Date(corr.created_at).toLocaleString()}</time>
                                <span className={`xp-history-status ${corr.statut === "poussee" ? "pushed" : ""}`}>{corr.statut === "poussee" ? "✓ Poussée" : "● Appliquée"}</span>
                              </div>
                              <div className="xp-vuln-meta">
                                <span style={{ color: sevCol(corr.vuln_severite), background: `${sevCol(corr.vuln_severite)}12`, borderColor: `${sevCol(corr.vuln_severite)}25` }}>{corr.vuln_severite}</span>
                                <strong>{corr.vuln_type}</strong><small>Ligne {corr.vuln_ligne}</small>
                              </div>
                              <p>Suggestion : {corr.vuln_suggestion}</p>
                              <details><summary>Voir le diff</summary><pre><span>- Ligne {corr.vuln_ligne} (original)</span>{"\n"}<b>+ Ligne {corr.vuln_ligne} (corrigé)</b></pre></details>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      </div>

      {showPush && (
        <div className={`xp-overlay ${theme}`} onClick={() => !pushLoading && setShowPush(false)}>
          <div className="xp-modal" onClick={e => e.stopPropagation()}>
            <div className="xp-modal-header">
              <div>
                <div className="xp-label">Publication GitLab</div>
                <h2>Pousser les corrections</h2>
                <p>{modifiedPaths.length} fichier{modifiedPaths.length > 1 ? "s" : ""} modifié{modifiedPaths.length > 1 ? "s" : ""} · {data.projet}</p>
              </div>
              <button className="xp-icon-button" onClick={() => setShowPush(false)} disabled={pushLoading}>×</button>
            </div>

            <div className="xp-changed-files">
              {modifiedPaths.map(path => <div key={path}><span />{path}</div>)}
            </div>

            <div className="xp-field">
              <label>Mode de publication</label>
              <div className="xp-mode-grid">
                {([{ v: "existing", l: "Branche existante", d: "Commit direct — sans MR" }, { v: "new", l: "Nouvelle branche", d: "Branche dédiée + Merge Request" }] as const).map(option => (
                  <button key={option.v} className={pushMode === option.v ? "active" : ""} onClick={() => { setPushMode(option.v); setPushBranch(option.v === "new" ? `fix/ia-${Date.now().toString(36)}` : data.branche || "main"); }}>
                    <strong>{option.v === "new" ? "⑂" : "✎"} {option.l}</strong><span>{option.d}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="xp-field">
              <label>{pushMode === "new" ? "Nom de la nouvelle branche" : "Branche cible"}</label>
              <input value={pushBranch} onChange={e => setPushBranch(e.target.value)} />
            </div>
            <div className="xp-field">
              <label>Message de commit</label>
              <input value={pushMsg} onChange={e => setPushMsg(e.target.value)} />
            </div>

            {pushRes && (
              <div className={`xp-push-result ${pushRes.ok ? "success" : "error"}`}>
                <div>{pushRes.ok ? "✓" : "!"} {pushRes.msg}</div>
                {pushRes.mr_url && <a href={pushRes.mr_url} target="_blank" rel="noreferrer">Voir la Merge Request →</a>}
                {!pushRes.mr_url && pushRes.url && <a href={pushRes.url} target="_blank" rel="noreferrer">Voir le commit →</a>}
              </div>
            )}

            <div className="xp-modal-actions">
              <button className="xp-secondary-button" onClick={() => setShowPush(false)} disabled={pushLoading}>Annuler</button>
              <button className="xp-primary-button grow" onClick={pusherGitLab} disabled={pushLoading || !pushBranch.trim() || !pushMsg.trim()}>
                {pushLoading ? <><span className="xp-spinner small" /> Publication…</> : `↑ Pousser sur ${pushBranch}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`xp-toast ${theme} ${toast.ok ? "success" : "error"}`}>
          <span>{toast.ok ? "✓" : "!"}</span>{toast.msg}
        </div>
      )}
    </>
  );
}

const explorerStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
* { box-sizing: border-box; }
body { margin: 0; overflow: hidden; }
.xp-shell, .xp-loading, .xp-overlay, .xp-toast {
  --bg: #070b14; --surface: #0e1421; --surface-2: #121a2a; --surface-3: #182238;
  --border: rgba(143,164,202,.14); --border-strong: rgba(94,144,255,.28);
  --text: #eef4ff; --text-soft: #b2bfd8; --muted: #74839f;
  --primary: #4f7dff; --primary-2: #7857ff; --primary-soft: rgba(79,125,255,.12);
  --success: #16c784; --warning: #f4a340; --danger: #ef5c6b;
  --shadow: 0 24px 72px rgba(0,0,0,.36); --code-bg: #090f1c;
  color: var(--text); font-family: 'Inter', Arial, sans-serif;
}
.xp-shell.light, .xp-loading.light, .xp-overlay.light, .xp-toast.light {
  --bg: #f5f7fc; --surface: #ffffff; --surface-2: #f7f9fe; --surface-3: #edf2fb;
  --border: rgba(31,51,88,.10); --border-strong: rgba(51,101,229,.25);
  --text: #17233d; --text-soft: #455570; --muted: #73819c;
  --primary: #356bf0; --primary-2: #6246ea; --primary-soft: rgba(53,107,240,.09);
  --shadow: 0 20px 60px rgba(44,62,105,.10); --code-bg: #f8faff;
}
.xp-shell { display: flex; flex-direction: column; height: 100vh; background: var(--bg); transition: background .25s ease, color .25s ease; overflow: hidden; }
.xp-topbar { height: 72px; padding: 12px 22px; border-bottom: 1px solid var(--border); background: var(--surface); display:flex; align-items:center; justify-content:space-between; gap:20px; flex-shrink:0; }
.xp-brand, .xp-project-bar, .xp-actions, .xp-file-identity, .xp-file-buttons { display:flex; align-items:center; gap:12px; }
.xp-brand-title { font-size: 15px; font-weight:700; letter-spacing: -.02em; }
.xp-brand-subtitle { color: var(--muted); font-size: 11px; margin-top:2px; }
.xp-logo { width:38px; height:38px; border-radius:12px; display:grid; place-items:center; color:#fff; font-weight:700; font-size:13px; background: linear-gradient(135deg,var(--primary),var(--primary-2)); box-shadow:0 9px 22px rgba(79,125,255,.28); }
.xp-icon-button { width:38px; height:38px; border-radius:11px; border:1px solid var(--border); color:var(--text-soft); background:var(--surface-2); cursor:pointer; font-size:18px; }
.xp-icon-button:hover { border-color:var(--border-strong); color:var(--primary); }
.xp-project-title { max-width:260px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-weight:600; }
.xp-pill { border-radius:999px; padding:7px 12px; font-size:11px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.xp-pill.branch { color:var(--primary); background:var(--primary-soft); border:1px solid var(--border-strong); }
.xp-pill.neutral { color:var(--muted); background:var(--surface-2); border:1px solid var(--border); }
.xp-pill.warning { color:var(--warning); background:rgba(244,163,64,.10); border:1px solid rgba(244,163,64,.22); }
.xp-theme-toggle { border:1px solid var(--border); background:var(--surface-2); color:var(--text-soft); border-radius:12px; padding:10px 14px; display:flex; gap:8px; cursor:pointer; font-size:12px; font-weight:600; }
.xp-theme-toggle:hover { border-color:var(--border-strong); }
.xp-primary-button, .xp-secondary-button { border-radius:11px; padding:11px 16px; border:1px solid transparent; font:600 12px 'Inter',sans-serif; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:7px; transition:transform .16s, opacity .16s, border-color .16s; }
.xp-primary-button { background:linear-gradient(135deg,var(--primary),var(--primary-2)); color:white; box-shadow:0 12px 28px rgba(62,105,244,.22); }
.xp-primary-button:hover:not(:disabled) { transform:translateY(-1px); }
.xp-secondary-button { color:var(--text-soft); background:var(--surface-2); border-color:var(--border); }
.xp-secondary-button.accent { color:var(--warning); }
.xp-secondary-button:hover:not(:disabled) { border-color:var(--border-strong); color:var(--primary); }
.xp-primary-button:disabled, .xp-secondary-button:disabled { opacity:.5; cursor:not-allowed; }
.xp-content { display:grid; grid-template-columns:300px minmax(0,1fr); gap:18px; padding:18px; flex:1; min-height:0; }
.xp-sidebar, .xp-workspace { background:var(--surface); border:1px solid var(--border); border-radius:20px; min-height:0; overflow:hidden; }
.xp-sidebar { display:flex; flex-direction:column; padding:14px; gap:14px; }
.xp-repository-card { padding:14px; border-radius:15px; background:linear-gradient(135deg,var(--primary-soft),transparent); border:1px solid var(--border-strong); }
.xp-label { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.12em; font-weight:700; margin-bottom:7px; }
.xp-repository-name { font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.xp-repository-meta { margin-top:10px; font-size:11px; color:var(--text-soft); display:flex; align-items:center; gap:7px; }
.xp-status-dot { width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 4px rgba(22,199,132,.12); }
.xp-sidebar-header { display:flex; justify-content:space-between; align-items:end; }
.xp-sidebar-title { font-size:14px; font-weight:650; }
.xp-count { min-width:28px; height:28px; border-radius:9px; padding:0 9px; background:var(--surface-3); color:var(--muted); display:grid; place-items:center; font-size:12px; font-weight:700; }
.xp-search { height:42px; display:flex; align-items:center; gap:9px; padding:0 12px; border-radius:12px; background:var(--surface-2); border:1px solid var(--border); color:var(--muted); }
.xp-search:focus-within { border-color:var(--border-strong); box-shadow:0 0 0 3px var(--primary-soft); }
.xp-search input { border:0; outline:0; width:100%; color:var(--text); background:transparent; font-size:12px; }
.xp-search input::placeholder { color:var(--muted); }
.xp-tree { flex:1; min-height:0; overflow:auto; padding:4px 0; }
.xp-tree-row { position:relative; height:34px; display:flex; align-items:center; gap:8px; border-radius:9px; padding-right:7px; margin:2px 0; cursor:pointer; color:var(--text-soft); font:500 12px 'JetBrains Mono', monospace; }
.xp-tree-row:hover { background:var(--surface-2); }
.xp-tree-row.is-selected { background:var(--primary-soft); color:var(--primary); }
.xp-chevron { width:10px; color:var(--muted); }
.xp-folder { color:var(--primary); font-size:13px; }
.xp-file-icon { width:16px; font-size:13px; }
.xp-tree-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.xp-dot { height:7px;width:7px;border-radius:50%;flex-shrink:0; }
.xp-dot.dirty { background:var(--warning); }
.xp-dot.valid { background:var(--success); }
.xp-tree-analyse { visibility:hidden; border:0; background:var(--primary-soft); color:var(--primary); border-radius:7px; font-size:10px; padding:5px 7px; cursor:pointer; }
.xp-tree-row:hover .xp-tree-analyse { visibility:visible; }
.xp-sidebar-footer { display:flex; gap:10px; padding:12px; border:1px solid var(--border); border-radius:13px; background:var(--surface-2); }
.xp-help-icon { color:var(--primary); }
.xp-sidebar-footer strong { font-size:11px; }
.xp-sidebar-footer p { margin:4px 0 0; color:var(--muted); font-size:10px; line-height:1.4; }
.xp-workspace { display:flex; flex-direction:column; }
.xp-empty, .xp-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px; gap:10px; }
.xp-empty-icon { width:62px;height:62px;border-radius:20px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;font-size:25px;margin-bottom:8px; }
.xp-empty h2, .xp-state h3 { margin:0; font-size:22px; letter-spacing:-.04em; }
.xp-empty p, .xp-state p { max-width:450px; font-size:13px; color:var(--muted); line-height:1.6; margin:0 0 16px; }
.xp-empty-features { display:flex; gap:9px; }
.xp-empty-features span { border:1px solid var(--border); color:var(--text-soft); background:var(--surface-2); border-radius:999px; padding:9px 13px; font-size:11px; }
.xp-file-header { padding:17px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:16px; }
.xp-file-large-icon { width:43px;height:43px;border-radius:13px;display:grid;place-items:center;background:var(--surface-2);border:1px solid var(--border);font-size:19px; }
.xp-file-path { font:600 13px 'JetBrains Mono',monospace; color:var(--text); }
.xp-file-metadata { display:flex; gap:14px; align-items:center; margin-top:5px; color:var(--muted); font-size:11px; }
.xp-inline-warning { color:var(--warning); }
.xp-inline-valid { color:var(--success); }
.xp-tabs { border-bottom:1px solid var(--border); display:flex; padding:0 14px; gap:4px; }
.xp-tab { position:relative; border:0; background:transparent; height:52px; padding:0 15px; display:flex; gap:8px; align-items:center; color:var(--muted); cursor:pointer; font:600 12px 'Inter',sans-serif; }
.xp-tab.active { color:var(--primary); }
.xp-tab.active::after { content:''; position:absolute; height:2px; bottom:0;left:10px;right:10px; background:var(--primary); border-radius:4px; }
.xp-tab em { font-style:normal; font-size:10px; background:var(--primary-soft); color:var(--primary); border-radius:12px; padding:2px 6px; }
.xp-badge-dot { display:inline-block; width:7px;height:7px;border-radius:50%; }
.xp-badge-dot.valid { background:var(--success); }
.xp-badge-dot.dirty { background:var(--warning); }
.xp-panel { flex:1; min-height:0; overflow:hidden; }
.xp-code-window, .xp-editor { height:100%; display:flex; flex-direction:column; background:var(--code-bg); }
.xp-code-toolbar { height:42px; padding:0 18px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:11px; }
.xp-code-lines { overflow:auto; flex:1; padding:10px 0; font:12px/1.7 'JetBrains Mono', monospace; }
.xp-code-line { min-height:22px; display:flex; align-items:flex-start; border-left:3px solid transparent; }
.xp-line-number { width:54px; flex-shrink:0; text-align:right; padding-right:17px; user-select:none; color:var(--muted); opacity:.55; }
.xp-code-line pre { flex:1; margin:0; color:var(--text-soft); white-space:pre; font:inherit; }
.xp-severity { margin:0 16px; align-self:center; border:1px solid; border-radius:999px; padding:3px 8px; cursor:pointer; font-size:9px; font-weight:700; }
.xp-analysis, .xp-history { padding:20px; height:100%; overflow:auto; }
.xp-score-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:22px; }
.xp-score-card { border:1px solid var(--border); background:var(--surface-2); border-radius:15px; padding:16px; }
.xp-score-head { display:flex; justify-content:space-between; align-items:center; color:var(--text-soft); font-size:12px; font-weight:600; }
.xp-score-head strong { font-size:28px; }
.xp-score-track { height:6px; border-radius:99px; background:var(--surface-3); overflow:hidden; margin:13px 0 9px; }
.xp-score-track div { height:100%; border-radius:99px; }
.xp-score-card small { color:var(--muted); font-size:11px; }
.xp-result-section { margin-top:20px; }
.xp-section-title { display:flex; align-items:center; gap:8px; color:var(--text-soft); font-size:12px; font-weight:700; margin-bottom:12px; }
.xp-section-title span { width:5px; height:17px; border-radius:4px; }
.xp-section-title span.red { background:var(--danger); }
.xp-section-title span.green { background:var(--success); }
.xp-section-title b { color:var(--muted); border:1px solid var(--border); border-radius:99px; padding:2px 8px; font-size:10px; }
.xp-vuln-list { display:flex; flex-direction:column; gap:10px; }
.xp-vuln { padding:14px 15px; border:1px solid var(--border); border-left:3px solid; background:var(--surface-2); border-radius:13px; }
.xp-vuln-top { display:flex; justify-content:space-between; gap:12px; align-items:start; }
.xp-vuln-meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.xp-vuln-meta span { font-size:9px; font-weight:700; border:1px solid; border-radius:999px; padding:4px 8px; }
.xp-vuln-meta strong { font-size:12px; }
.xp-vuln-meta small { color:var(--muted); font-size:11px; }
.xp-vuln p, .xp-history-card p { font-size:11px; line-height:1.55; color:var(--muted); margin:11px 0 0; }
.xp-ai-button { border:0; border-radius:9px; background:linear-gradient(135deg,var(--primary),var(--primary-2)); color:#fff; font-size:11px; font-weight:600; padding:9px 12px; display:flex; gap:6px; align-items:center; cursor:pointer; white-space:nowrap; }
.xp-ai-button:disabled { opacity:.55; }
.xp-recommendations { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.xp-recommendations article { background:var(--surface-2); border:1px solid var(--border); border-radius:13px; padding:14px; }
.xp-recommendations strong { color:var(--success); font-size:12px; }
.xp-recommendations p { color:var(--muted); font-size:11px; line-height:1.55; margin:7px 0 0; }
.xp-success-state { padding:32px; border:1px solid rgba(22,199,132,.2); border-radius:16px; background:rgba(22,199,132,.05); display:flex; align-items:center; justify-content:center; flex-direction:column; gap:8px; color:var(--success); }
.xp-success-state div { width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(22,199,132,.14);font-size:20px; }
.xp-success-state span { color:var(--muted); font-size:12px; }
.xp-state { min-height:420px; }
.xp-state.error > div { width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:var(--danger);background:rgba(239,92,107,.10);font-size:25px;font-weight:700; }
.xp-editor-actions { height:58px; padding:0 18px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; color:var(--muted); font-size:11px; background:var(--surface); }
.xp-editor-actions > div { display:flex; gap:8px; }
.xp-editor-body { flex:1; min-height:0; display:flex; font:12px/1.72 'JetBrains Mono', monospace; }
.xp-gutter { width:56px; flex-shrink:0; border-right:1px solid var(--border); color:var(--muted); opacity:.65; text-align:right; padding:14px 14px 14px 0; overflow:hidden; }
.xp-editor textarea { flex:1; border:0; outline:0; resize:none; background:transparent; color:var(--text-soft); font:12px/1.72 'JetBrains Mono',monospace; padding:14px 16px; white-space:pre; overflow-wrap:normal; overflow:auto; tab-size:2; }
.xp-banner { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid; font-size:11px; }
.xp-banner.success { color:var(--primary); border-color:var(--border-strong); background:var(--primary-soft); }
.xp-banner.error { color:var(--danger); border-color:rgba(239,92,107,.22); background:rgba(239,92,107,.08); }
.xp-banner p { margin:0; flex:1; }
.xp-banner button { border:1px solid currentColor; border-radius:7px; padding:5px 9px; color:inherit; background:transparent; cursor:pointer; font-size:10px; }
.xp-banner .close { border:0; font-size:16px; }
.xp-history-header { display:flex; justify-content:space-between; align-items:start; border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:16px; }
.xp-history-header h3 { margin:0 0 4px; font-size:17px; }
.xp-history-header p { margin:0; font:11px 'JetBrains Mono', monospace; color:var(--muted); }
.xp-history-list { display:flex; flex-direction:column; gap:11px; }
.xp-history-card { border:1px solid var(--border); border-radius:14px; background:var(--surface-2); padding:15px; }
.xp-history-top { display:flex; gap:9px; align-items:center; margin-bottom:11px; }
.xp-history-top time { color:var(--muted); font-size:11px; flex:1; }
.xp-history-status { color:var(--primary); background:var(--primary-soft); border-radius:999px; padding:5px 9px; font-size:10px; font-weight:700; }
.xp-history-status.pushed { color:var(--success); background:rgba(22,199,132,.10); }
.xp-history-card details { margin-top:12px; color:var(--primary); font-size:11px; cursor:pointer; }
.xp-history-card pre { background:var(--code-bg); padding:11px; border-radius:8px; margin-top:9px; color:var(--danger); font:11px 'JetBrains Mono',monospace; }
.xp-history-card pre b { color:var(--success); }
.xp-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:22px; background:rgba(4,7,15,.68); backdrop-filter:blur(8px); }
.xp-modal { width:min(570px,100%); max-height:92vh; overflow:auto; border-radius:22px; padding:24px; color:var(--text); background:var(--surface); border:1px solid var(--border); box-shadow:var(--shadow); }
.xp-modal-header { display:flex; justify-content:space-between; gap:18px; margin-bottom:18px; }
.xp-modal-header h2 { margin:0 0 5px; font-size:20px; letter-spacing:-.04em; }
.xp-modal-header p { margin:0; color:var(--muted); font-size:12px; }
.xp-changed-files { max-height:108px; overflow:auto; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:8px 12px; margin-bottom:17px; }
.xp-changed-files div { display:flex; align-items:center; gap:7px; padding:5px 0; color:var(--text-soft); font:11px 'JetBrains Mono',monospace; }
.xp-changed-files span { width:6px;height:6px;border-radius:50%;background:var(--warning); }
.xp-field { margin-bottom:15px; }
.xp-field label { display:block; color:var(--muted); text-transform:uppercase; letter-spacing:.09em; font-size:10px; font-weight:700; margin-bottom:7px; }
.xp-field input { width:100%; border-radius:11px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); padding:12px 13px; outline:none; font:12px 'Inter',sans-serif; }
.xp-field input:focus { border-color:var(--border-strong); }
.xp-mode-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.xp-mode-grid button { padding:13px; border-radius:12px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-soft); display:flex; flex-direction:column; text-align:left; gap:5px; cursor:pointer; }
.xp-mode-grid button.active { border-color:var(--border-strong); background:var(--primary-soft); color:var(--primary); }
.xp-mode-grid strong { font-size:12px; }
.xp-mode-grid span { color:var(--muted); font-size:10px; }
.xp-push-result { border-radius:12px; border:1px solid; padding:13px; margin-bottom:16px; font-size:12px; }
.xp-push-result.success { color:var(--success); border-color:rgba(22,199,132,.22); background:rgba(22,199,132,.07); }
.xp-push-result.error { color:var(--danger); border-color:rgba(239,92,107,.22); background:rgba(239,92,107,.07); }
.xp-push-result a { display:inline-flex; color:inherit; border:1px solid currentColor; border-radius:8px; padding:6px 10px; margin-top:10px; text-decoration:none; font-weight:600; }
.xp-modal-actions { display:flex; gap:10px; margin-top:21px; }
.xp-modal-actions .grow { flex:1; }
.xp-toast { position:fixed; right:24px; bottom:24px; z-index:2000; border-radius:13px; padding:13px 16px; display:flex; gap:9px; align-items:center; font-size:12px; font-weight:600; box-shadow:var(--shadow); background:var(--surface); border:1px solid var(--border); }
.xp-toast.success { color:var(--success); }
.xp-toast.error { color:var(--danger); }
.xp-spinner { display:inline-block; width:25px; height:25px; border:2px solid var(--border); border-top-color:var(--primary); border-radius:50%; animation:xp-spin .7s linear infinite; }
.xp-spinner.small { width:13px; height:13px; }
.xp-spinner.large { width:34px; height:34px; }
.xp-loading { height:100vh; background:var(--bg); display:flex; align-items:center; justify-content:center; gap:12px; color:var(--muted); }
.small-state { min-height:380px; }
@keyframes xp-spin { to { transform:rotate(360deg); } }
::-webkit-scrollbar { width:6px;height:6px; }
::-webkit-scrollbar-thumb { border-radius:10px; background:rgba(125,145,181,.28); }
::-webkit-scrollbar-track { background:transparent; }
@media (max-width:1050px) {
  .xp-content { grid-template-columns:250px minmax(0,1fr); padding:12px; gap:12px; }
  .xp-project-bar { display:none; }
  .xp-score-grid, .xp-recommendations { grid-template-columns:1fr; }
}
`;
