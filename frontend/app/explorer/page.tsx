"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface FileItem {
  path: string;
  content: string;
  size: number;
}

interface ExplorerData {
  projet: string;
  branche: string;
  total: number;
  fichiers: FileItem[];
}

interface AnalyseResult {
  id?: number;
  fichier: string;
  score_qualite: number;
  score_securite: number;
  score_performance: number;
  vulnerabilites: any[];
  recommandations: any[];
  analysee_le: string;
  statut: string;
  erreur?: string;
}

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
  file?: FileItem;
  analyse?: AnalyseResult;
  analyseEnCours?: boolean;
};

function buildTree(files: FileItem[], filter: string, analyses: Record<string, AnalyseResult>): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap: Record<string, TreeNode> = {};
  const filtered = filter
    ? files.filter(f => f.path.toLowerCase().includes(filter.toLowerCase()))
    : files;

  filtered.forEach(file => {
    const parts = file.path.split("/");
    let current = root;
    let currentPath = "";
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (i === parts.length - 1) {
        current.push({
          name: part,
          path: currentPath,
          type: "file",
          file,
          analyse: analyses[file.path],
          analyseEnCours: false
        });
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
}

function getFileIcon(path: string) {
  if (path.endsWith(".py"))   return "🐍";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "🔷";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "🟨";
  if (path.endsWith(".java")) return "☕";
  if (path.endsWith(".go"))   return "🐹";
  if (path.endsWith(".php"))  return "🐘";
  if (path.endsWith(".html")) return "🌐";
  if (path.endsWith(".css") || path.endsWith(".scss")) return "🎨";
  if (path.endsWith(".json")) return "📋";
  if (path.endsWith(".md"))   return "📝";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "⚙️";
  return "📄";
}

function colorScore(s: number) {
  if (s >= 75) return "#10b981";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function ExplorerPage() {
  const router = useRouter();

  const [data, setData] = useState<ExplorerData | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedAnalyse, setSelectedAnalyse] = useState<AnalyseResult | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileSearch, setFileSearch] = useState("");
  const [analyses, setAnalyses] = useState<Record<string, AnalyseResult>>({});
  const [loadingAnalyse, setLoadingAnalyse] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "analyse">("code");

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem("explorer_data");
    if (!raw || raw.trim() === "") {
      router.push("/explore-form");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setData(parsed);
      // ⚠️ SUPPRIMÉ : appel à chargerAnalysesSauvegardees qui n'existe pas
      if (parsed.fichiers?.length > 0) {
        setExpandedDirs(new Set([parsed.fichiers[0].path.split("/")[0]]));
      }
    } catch {
      console.error("Données sessionStorage invalides");
      router.push("/explore-form");
    }
  }, [router]);

  const analyserFichier = async (file: FileItem) => {
    setLoadingAnalyse(true);
    setSelectedFile(file);
    setActiveTab("analyse");
    
    // Marquer le fichier comme en cours d'analyse
    setAnalyses(prev => ({
      ...prev,
      [file.path]: { ...prev[file.path], statut: "en_cours" } as AnalyseResult
    }));

    try {
      const res = await axios.post(
        `${API}/analyses-fichier/`,
        {
          projet_nom: data?.projet,
          fichier_path: file.path,
          contenu: file.content,
          branche: data?.branche
        },
        { headers: getHeaders() }
      );
      
      const nouvelleAnalyse = res.data;
      setAnalyses(prev => ({
        ...prev,
        [file.path]: nouvelleAnalyse
      }));
      setSelectedAnalyse(nouvelleAnalyse);
      
    } catch (err: any) {
      console.error("Erreur analyse", err);
      const errorMsg = err.response?.data?.detail || "Erreur lors de l'analyse";
      setAnalyses(prev => ({
        ...prev,
        [file.path]: {
          fichier: file.path,
          score_qualite: 0,
          score_securite: 0,
          score_performance: 0,
          vulnerabilites: [],
          recommandations: [],
          analysee_le: new Date().toISOString(),
          statut: "erreur",
          erreur: errorMsg
        } as any
      }));
    } finally {
      setLoadingAnalyse(false);
    }
  };

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactElement[] =>
    nodes.map(node => {
      const hasAnalyse = node.file && analyses[node.file.path];
      const analyseEnCours = hasAnalyse && analyses[node.file!.path]?.statut === "en_cours";
      
      return (
        <div key={node.path}>
          {node.type === "dir" ? (
            <div
              className="flex items-center gap-1 py-1 cursor-pointer hover:bg-gray-800 select-none text-gray-400 text-xs font-mono"
              style={{ paddingLeft: depth * 14 + 8 }}
              onClick={() => toggleDir(node.path)}
            >
              <span className="w-3 text-gray-600 text-xs shrink-0">
                {expandedDirs.has(node.path) ? "▾" : "▸"}
              </span>
              <span className="shrink-0">📁</span>
              <span className="truncate">{node.name}</span>
            </div>
          ) : (
            <div
              className={`flex items-center justify-between group py-1 cursor-pointer text-xs font-mono
                ${selectedFile?.path === node.path
                  ? "bg-indigo-900 text-indigo-200"
                  : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"}`}
              style={{ paddingLeft: depth * 14 + 22 }}
            >
              <div 
                className="flex items-center gap-2 flex-1 min-w-0"
                onClick={() => {
                  setSelectedFile(node.file!);
                  setSelectedAnalyse(analyses[node.file!.path] || null);
                  setActiveTab("code");
                }}
              >
                <span className="shrink-0">{getFileIcon(node.path)}</span>
                <span className="truncate">{node.name}</span>
              </div>
              
              {/* Indicateur d'analyse */}
              {hasAnalyse && !analyseEnCours && analyses[node.file!.path]?.statut === "termine" && (
                <span 
                  className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-green-950 text-green-400 border border-green-800 mr-2"
                  title="Analysé"
                >
                  ✓
                </span>
              )}
              
              {/* Bouton Analyser */}
              <button
                className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition opacity-0 group-hover:opacity-100 mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  analyserFichier(node.file!);
                }}
                disabled={analyseEnCours}
              >
                {analyseEnCours ? "..." : "🔍 Analyser"}
              </button>
            </div>
          )}
          {node.type === "dir" && expandedDirs.has(node.path) && node.children &&
            renderTree(node.children, depth + 1)
          }
        </div>
      );
    });

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-600 text-sm font-mono">
        Aucune donnée —{" "}
        <span
          className="text-indigo-400 cursor-pointer ml-1 hover:underline"
          onClick={() => router.push("/explore-form")}
        >
          retour au formulaire
        </span>
      </div>
    );
  }

  const tree = buildTree(data.fichiers, fileSearch, analyses);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-300 overflow-hidden">

      {/* Topbar */}
      <div className="flex items-center gap-4 px-5 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <button
          onClick={() => router.push("/explore-form")}
          className="text-gray-500 text-sm border border-gray-800 rounded-lg px-3 py-1 hover:text-gray-300 hover:border-gray-600 transition whitespace-nowrap"
        >
          ← Nouveau
        </button>
        <span className="text-sm font-bold font-mono text-gray-100 truncate">{data.projet}</span>
        <span className="text-xs font-mono text-indigo-300 bg-indigo-950 border border-indigo-800 rounded px-2 py-0.5 shrink-0">
          ⑂ {data.branche}
        </span>
        <span className="text-xs font-mono text-gray-600 ml-auto shrink-0">
          {data.total} fichier{data.total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-80 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800 shrink-0">
            <input
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-gray-300 text-xs font-mono placeholder-gray-700 outline-none focus:border-indigo-600 transition"
              placeholder="Filtrer les fichiers..."
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {tree.length === 0 ? (
              <div className="text-center text-gray-700 text-xs font-mono p-6">Aucun fichier</div>
            ) : (
              renderTree(tree)
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
              <div className="text-4xl">📄</div>
              <div className="text-xs font-mono text-gray-500">Sélectionnez un fichier</div>
              <div className="text-xs font-mono text-gray-700">dans l'arborescence à gauche</div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center border-b border-gray-800 shrink-0">
                <button
                  className={`px-5 py-2 text-xs font-mono transition ${activeTab === "code" ? "text-indigo-400 border-b-2 border-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
                  onClick={() => setActiveTab("code")}
                >
                  📄 Code
                </button>
                <button
                  className={`px-5 py-2 text-xs font-mono transition ${activeTab === "analyse" ? "text-indigo-400 border-b-2 border-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
                  onClick={() => setActiveTab("analyse")}
                >
                  🧠 Analyse IA
                  {analyses[selectedFile.path] && analyses[selectedFile.path].statut === "termine" && (
                    <span className="ml-2 text-green-400 text-[10px]">✓</span>
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                {activeTab === "code" ? (
                  <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre">
                    {selectedFile.content.split("\n").map((line, i) => (
                      <div key={i} className="flex hover:bg-gray-900 min-h-5">
                        <span className="select-none text-gray-700 text-right pr-5 pl-6 w-14 shrink-0 leading-relaxed">
                          {i + 1}
                        </span>
                        <span className="flex-1 pr-5">{line || " "}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className="p-5">
                    {loadingAnalyse && analyses[selectedFile.path]?.statut === "en_cours" ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                        <div className="text-gray-500 text-sm font-mono">Analyse en cours...</div>
                        <div className="text-gray-700 text-xs font-mono mt-2">Le LLM analyse votre code</div>
                      </div>
                    ) : analyses[selectedFile.path] && analyses[selectedFile.path].statut === "termine" ? (
                      <>
                        {/* Scores */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          {[
                            { label: "Qualité", val: analyses[selectedFile.path].score_qualite },
                            { label: "Sécurité", val: analyses[selectedFile.path].score_securite },
                            { label: "Performance", val: analyses[selectedFile.path].score_performance },
                          ].map(s => (
                            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                              <div className="text-3xl font-bold font-mono" style={{ color: colorScore(s.val) }}>
                                {s.val ?? "—"}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                              <div className="h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${s.val ?? 0}%`, backgroundColor: colorScore(s.val) }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Vulnérabilités */}
                        {analyses[selectedFile.path].vulnerabilites?.length > 0 && (
                          <div className="mb-6">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2">
                              <span className="w-1 h-4 bg-red-500 rounded-full"></span>
                              Vulnérabilités ({analyses[selectedFile.path].vulnerabilites.length})
                            </div>
                            <div className="space-y-3">
                              {analyses[selectedFile.path].vulnerabilites.map((v: any, i: number) => (
                                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3 border-l-4" style={{ borderLeftColor: colorScore(v.severite === "CRITIQUE" ? 0 : v.severite === "HAUTE" ? 50 : 100) }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.severite === "CRITIQUE" ? "bg-red-950 text-red-400" : v.severite === "HAUTE" ? "bg-orange-950 text-orange-400" : "bg-yellow-950 text-yellow-400"}`}>
                                      {v.severite}
                                    </span>
                                    <span className="text-sm font-mono text-gray-300">{v.type}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono mb-2">ligne {v.ligne}</div>
                                  <div className="text-xs text-gray-400">💡 {v.suggestion}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommandations */}
                        {analyses[selectedFile.path].recommandations?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2">
                              <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                              Recommandations ({analyses[selectedFile.path].recommandations.length})
                            </div>
                            <div className="space-y-3">
                              {analyses[selectedFile.path].recommandations.map((r: any, i: number) => (
                                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                                  <div className="text-sm font-mono text-indigo-400 mb-1">✓ {r.titre}</div>
                                  <div className="text-xs text-gray-400">{r.description}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!analyses[selectedFile.path].vulnerabilites || analyses[selectedFile.path].vulnerabilites.length === 0) && (
                          <div className="bg-green-950/30 border border-green-800 rounded-lg p-5 text-center">
                            <div className="text-2xl mb-2">✅</div>
                            <div className="text-green-400 text-sm font-mono">Aucune vulnérabilité détectée</div>
                            <div className="text-gray-500 text-xs mt-1">Code propre !</div>
                          </div>
                        )}
                      </>
                    ) : analyses[selectedFile.path]?.statut === "erreur" ? (
                      <div className="bg-red-950/30 border border-red-800 rounded-lg p-5 text-center">
                        <div className="text-2xl mb-2">❌</div>
                        <div className="text-red-400 text-sm font-mono">Erreur lors de l'analyse</div>
                        <div className="text-gray-500 text-xs mt-1">{analyses[selectedFile.path]?.erreur}</div>
                        <button
                          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-mono transition"
                          onClick={() => analyserFichier(selectedFile)}
                        >
                          🔍 Réessayer
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="text-4xl mb-4 opacity-30">🧠</div>
                        <div className="text-gray-500 text-sm font-mono">Ce fichier n'a pas encore été analysé</div>
                        <button
                          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-mono transition"
                          onClick={() => analyserFichier(selectedFile)}
                        >
                          🔍 Analyser ce fichier
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}