"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface Depot {
  id: number;
  nom: string;
  url_branche_principale: string;
  url_branche_developpement: string;
  proprietaire_id: number;
}

interface FileItem {
  path: string;
  content: string;
  size: number;
}

export default function CodeDepotsPage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [loadingDepots, setLoadingDepots] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [search, setSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // ── Fetch dépôts ───────────────────────────────────────────────
  useEffect(() => {
    const fetchDepots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get("http://localhost:8000/depots/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDepots(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDepots(false);
      }
    };
    fetchDepots();
  }, []);

  // ── Fetch fichiers d'un dépôt ──────────────────────────────────
  const fetchFiles = async (depot: Depot, branchOverride?: string) => {
    setSelectedDepot(depot);
    setSelectedFile(null);
    setFiles([]);
    setLoadingFiles(true);
    const targetBranch = branchOverride || depot.url_branche_principale;
    setBranch(targetBranch);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `http://localhost:8000/depots/${depot.id}/files`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { branch: targetBranch },
        }
      );
      setFiles(res.data.files || []);
      setExpandedDirs(new Set());
    } catch (err: any) {
      console.error("Erreur fichiers:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // ── Arborescence ───────────────────────────────────────────────
  type TreeNode = {
    name: string;
    path: string;
    type: "file" | "dir";
    children?: TreeNode[];
    file?: FileItem;
  };

  const buildTree = (files: FileItem[]): TreeNode[] => {
    const root: TreeNode[] = [];
    const dirMap: Record<string, TreeNode> = {};

    const filtered = files.filter(f =>
      f.path.toLowerCase().includes(fileSearch.toLowerCase())
    );

    filtered.forEach(file => {
      const parts = file.path.split("/");
      let current = root;
      let currentPath = "";

      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (i === parts.length - 1) {
          current.push({ name: part, path: currentPath, type: "file", file });
        } else {
          if (!dirMap[currentPath]) {
            const node: TreeNode = { name: part, path: currentPath, type: "dir", children: [] };
            dirMap[currentPath] = node;
            current.push(node);
          }
          current = dirMap[currentPath].children!;
        }
      });
    });

    return root;
  };

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  // ── Syntaxe highlight simple ───────────────────────────────────
  const getLanguage = (path: string) => {
    if (path.endsWith(".py"))   return "python";
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
    if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
    if (path.endsWith(".java")) return "java";
    if (path.endsWith(".go"))   return "go";
    if (path.endsWith(".php"))  return "php";
    if (path.endsWith(".rb"))   return "ruby";
    if (path.endsWith(".cs"))   return "csharp";
    if (path.endsWith(".cpp") || path.endsWith(".c")) return "cpp";
    return "text";
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith(".py"))  return "🐍";
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return "🔷";
    if (path.endsWith(".js") || path.endsWith(".jsx")) return "🟨";
    if (path.endsWith(".java")) return "☕";
    if (path.endsWith(".go"))   return "🐹";
    if (path.endsWith(".php"))  return "🐘";
    if (path.endsWith(".html")) return "🌐";
    if (path.endsWith(".css") || path.endsWith(".scss")) return "🎨";
    if (path.endsWith(".json")) return "📋";
    if (path.endsWith(".md"))   return "📝";
    return "📄";
  };

  // ── Rendu arborescence ─────────────────────────────────────────
  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactElement[] => {
    return nodes.map(node => (
      <div key={node.path}>
        {node.type === "dir" ? (
          <div
            className="tree-dir"
            style={{ paddingLeft: depth * 14 + 10 }}
            onClick={() => toggleDir(node.path)}
          >
            <span className="tree-arrow">{expandedDirs.has(node.path) ? "▾" : "▸"}</span>
            <span className="tree-dir-icon">📁</span>
            <span className="tree-dir-name">{node.name}</span>
          </div>
        ) : (
          <div
            className={`tree-file ${selectedFile?.path === node.path ? "active" : ""}`}
            style={{ paddingLeft: depth * 14 + 24 }}
            onClick={() => setSelectedFile(node.file!)}
          >
            <span className="tree-file-icon">{getFileIcon(node.path)}</span>
            <span className="tree-file-name">{node.name}</span>
          </div>
        )}
        {node.type === "dir" && expandedDirs.has(node.path) && node.children && (
          <div>{renderTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const tree = selectedDepot ? buildTree(files) : [];
  const filteredDepots = depots.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .root {
          display: flex; height: 100vh;
          background: #0d0e12; font-family: 'Inter', sans-serif; color: #c9cad6;
          overflow: hidden;
        }

        /* ── PANEL 1 : liste dépôts ── */
        .panel-depots {
          width: 240px; min-width: 240px;
          background: #111218; border-right: 1px solid #1c1d26;
          display: flex; flex-direction: column;
        }
        .panel-header {
          padding: 16px 14px 12px;
          border-bottom: 1px solid #1c1d26;
          display: flex; align-items: center; gap: 10px;
        }
        .back-btn {
          background: transparent; border: 1px solid #1c1d26; border-radius: 6px;
          color: #555; font-size: 14px; width: 28px; height: 28px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .back-btn:hover { border-color: #333; color: #aaa; }
        .panel-title { font-size: 12px; font-weight: 700; color: #fff; }
        .panel-sub   { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; }

        .panel-search {
          padding: 10px 12px; border-bottom: 1px solid #1c1d26;
          position: relative;
        }
        .panel-search input {
          width: 100%; background: #0d0e12; border: 1px solid #1c1d26;
          border-radius: 6px; padding: 7px 10px 7px 28px;
          color: #e8e8f0; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; outline: none;
        }
        .panel-search input:focus { border-color: #6c63ff55; }
        .panel-search input::placeholder { color: #2e2f3e; }
        .search-ico {
          position: absolute; left: 20px; top: 50%;
          transform: translateY(-50%); color: #333; font-size: 12px; pointer-events: none;
        }

        .depot-list { flex: 1; overflow-y: auto; padding: 8px 8px; scrollbar-width: thin; scrollbar-color: #1c1d26 transparent; }
        .depot-item {
          padding: 10px 10px; border-radius: 7px; cursor: pointer;
          transition: background 0.12s; margin-bottom: 2px;
          border: 1px solid transparent;
        }
        .depot-item:hover { background: #1a1b24; }
        .depot-item.active { background: #1e1f2e; border-color: #6c63ff30; }
        .depot-item-name {
          font-size: 12px; font-weight: 600; color: #e8e8f0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .depot-item-branch {
          font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .depot-item.active .depot-item-name { color: #9b91ff; }

        /* ── PANEL 2 : arborescence fichiers ── */
        .panel-files {
          width: 240px; min-width: 240px;
          background: #0f1015; border-right: 1px solid #1c1d26;
          display: flex; flex-direction: column;
        }
        .files-header {
          padding: 12px 14px; border-bottom: 1px solid #1c1d26;
          display: flex; flex-direction: column; gap: 8px;
        }
        .files-title { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; }

        .branch-selector { display: flex; gap: 6px; }
        .branch-btn {
          flex: 1; padding: 5px 8px; background: transparent;
          border: 1px solid #1c1d26; border-radius: 5px;
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          cursor: pointer; transition: all 0.12s; color: #555; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .branch-btn:hover { border-color: #333; color: #aaa; }
        .branch-btn.active { background: #6c63ff15; color: #9b91ff; border-color: #6c63ff40; }

        .file-search { position: relative; }
        .file-search input {
          width: 100%; background: #0d0e12; border: 1px solid #1c1d26;
          border-radius: 6px; padding: 6px 8px 6px 26px;
          color: #e8e8f0; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; outline: none;
        }
        .file-search input:focus { border-color: #6c63ff55; }
        .file-search input::placeholder { color: #2e2f3e; }
        .file-search-ico { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #333; font-size: 11px; pointer-events: none; }

        .files-stats {
          padding: 6px 14px; border-bottom: 1px solid #1c1d26;
          font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace;
        }

        .tree-wrap { flex: 1; overflow-y: auto; padding: 6px 0; scrollbar-width: thin; scrollbar-color: #1c1d26 transparent; }

        .tree-dir {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 0; cursor: pointer; transition: background 0.1s;
          font-size: 12px; color: #888;
        }
        .tree-dir:hover { background: #1a1b2450; color: #bbb; }
        .tree-arrow    { font-size: 9px; width: 10px; color: #555; }
        .tree-dir-icon { font-size: 12px; }
        .tree-dir-name { font-family: 'JetBrains Mono', monospace; font-size: 11px; }

        .tree-file {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 0; cursor: pointer; transition: background 0.1s;
        }
        .tree-file:hover { background: #1a1b2450; }
        .tree-file.active { background: #6c63ff18; }
        .tree-file.active .tree-file-name { color: #c4bfff; }
        .tree-file-icon { font-size: 11px; }
        .tree-file-name { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888; white-space: nowrap; }

        .empty-files {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; gap: 8px; opacity: 0.3; padding: 20px;
        }
        .empty-icon { font-size: 28px; }
        .empty-txt  { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; text-align: center; }

        /* ── PANEL 3 : code viewer ── */
        .panel-code {
          flex: 1; display: flex; flex-direction: column; overflow: hidden;
          background: #0d0e12;
        }

        .code-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 18px; border-bottom: 1px solid #1c1d26;
          background: #111218; flex-shrink: 0; gap: 12px;
        }
        .code-filepath {
          font-size: 12px; color: #9b91ff;
          font-family: 'JetBrains Mono', monospace;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
        }
        .code-meta { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
        .code-lang {
          font-size: 10px; color: #ffd166; background: #ffd16610;
          border: 1px solid #ffd16620; border-radius: 4px; padding: 2px 7px;
          font-family: 'JetBrains Mono', monospace;
        }
        .code-size { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; }

        .code-body {
          flex: 1; overflow: auto; scrollbar-width: thin; scrollbar-color: #1c1d26 transparent;
        }
        .code-pre {
          margin: 0; padding: 20px;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          line-height: 1.8; color: #c9cad6; white-space: pre;
          counter-reset: line;
        }
        .code-line {
          display: flex; min-height: 21px;
        }
        .line-num {
          color: #2e3040; user-select: none; text-align: right;
          padding-right: 20px; min-width: 40px; flex-shrink: 0;
          font-size: 11px;
        }
        .line-content { flex: 1; }

        .no-file {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; gap: 12px; opacity: 0.2;
        }
        .no-file-icon { font-size: 48px; }
        .no-file-txt  { font-size: 12px; color: #555; font-family: 'JetBrains Mono', monospace; }

        .loading-spin {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; gap: 10px;
        }
        .spinner {
          width: 24px; height: 24px; border: 2px solid #1c1d26;
          border-top-color: #6c63ff; border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-txt { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div className="root">

        {/* ── PANEL 1 : Dépôts ── */}
        <div className="panel-depots">
          <div className="panel-header">
            <button className="back-btn" onClick={() => router.push("/dashboard")}>←</button>
            <div>
              <div className="panel-title">Explorateur</div>
              <div className="panel-sub">code source</div>
            </div>
          </div>

          <div className="panel-search">
            <span className="search-ico">⌕</span>
            <input
              placeholder="Rechercher un dépôt..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="depot-list">
            {loadingDepots ? (
              <div className="loading-spin" style={{ height: 120 }}>
                <div className="spinner" />
              </div>
            ) : filteredDepots.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon">◈</div>
                <div className="empty-txt">Aucun dépôt</div>
              </div>
            ) : (
              filteredDepots.map(d => (
                <div
                  key={d.id}
                  className={`depot-item ${selectedDepot?.id === d.id ? "active" : ""}`}
                  onClick={() => fetchFiles(d)}
                >
                  <div className="depot-item-name">{d.nom}</div>
                  <div className="depot-item-branch">⑂ {d.url_branche_principale}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── PANEL 2 : Arborescence ── */}
        <div className="panel-files">
          <div className="files-header">
            <div className="files-title">
              {selectedDepot ? selectedDepot.nom.split("/").pop() : "Fichiers"}
            </div>

            {selectedDepot && (
              <div className="branch-selector">
                <button
                  className={`branch-btn ${branch === selectedDepot.url_branche_principale ? "active" : ""}`}
                  onClick={() => fetchFiles(selectedDepot, selectedDepot.url_branche_principale)}
                >
                  {selectedDepot.url_branche_principale}
                </button>
                <button
                  className={`branch-btn ${branch === selectedDepot.url_branche_developpement ? "active" : ""}`}
                  onClick={() => fetchFiles(selectedDepot, selectedDepot.url_branche_developpement)}
                >
                  {selectedDepot.url_branche_developpement}
                </button>
              </div>
            )}

            <div className="file-search">
              <span className="file-search-ico">⌕</span>
              <input
                placeholder="Filtrer les fichiers..."
                value={fileSearch}
                onChange={e => setFileSearch(e.target.value)}
              />
            </div>
          </div>

          {files.length > 0 && (
            <div className="files-stats">
              {files.length} fichier{files.length !== 1 ? "s" : ""} · {branch}
            </div>
          )}

          <div className="tree-wrap">
            {loadingFiles ? (
              <div className="loading-spin">
                <div className="spinner" />
                <div className="loading-txt">chargement...</div>
              </div>
            ) : !selectedDepot ? (
              <div className="empty-files">
                <div className="empty-icon">◈</div>
                <div className="empty-txt">Sélectionnez un dépôt</div>
              </div>
            ) : files.length === 0 ? (
              <div className="empty-files">
                <div className="empty-icon">📂</div>
                <div className="empty-txt">Aucun fichier trouvé</div>
              </div>
            ) : (
              renderTree(tree)
            )}
          </div>
        </div>

        {/* ── PANEL 3 : Code viewer ── */}
        <div className="panel-code">
          {!selectedFile ? (
            <div className="no-file">
              <div className="no-file-icon">📄</div>
              <div className="no-file-txt">Sélectionnez un fichier</div>
            </div>
          ) : (
            <>
              <div className="code-topbar">
                <span className="code-filepath">{selectedFile.path}</span>
                <div className="code-meta">
                  <span className="code-lang">{getLanguage(selectedFile.path)}</span>
                  <span className="code-size">
                    {(selectedFile.size / 1024).toFixed(1)} KB ·{" "}
                    {selectedFile.content.split("\n").length} lignes
                  </span>
                </div>
              </div>

              <div className="code-body">
                <pre className="code-pre">
                  {selectedFile.content.split("\n").map((line, i) => (
                    <div key={i} className="code-line">
                      <span className="line-num">{i + 1}</span>
                      <span className="line-content">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}

