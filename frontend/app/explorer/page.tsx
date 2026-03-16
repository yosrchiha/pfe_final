"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
  file?: FileItem;
};

function buildTree(files: FileItem[], filter: string): TreeNode[] {
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

function getLang(path: string) {
  if (path.endsWith(".py"))   return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".java")) return "java";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css") || path.endsWith(".scss")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md"))   return "markdown";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  return "text";
}

export default function ExplorerPage() {
  const router = useRouter();

  const [data, setData]                 = useState<ExplorerData | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileSearch, setFileSearch]     = useState("");

  useEffect(() => {
    // Guard SSR : sessionStorage n'existe que côté client
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem("explorer_data");

    // sessionStorage vide → redirige vers le formulaire
    if (!raw || raw.trim() === "") {
      router.push("/explore-form");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setData(parsed);
      if (parsed.fichiers?.length > 0) {
        setExpandedDirs(new Set([parsed.fichiers[0].path.split("/")[0]]));
      }
    } catch {
      console.error("Données sessionStorage invalides");
      router.push("/explore-form");
    }
  }, []);

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactElement[] =>
    nodes.map(node => (
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
            className={`flex items-center gap-2 py-1 cursor-pointer text-xs font-mono
              ${selectedFile?.path === node.path
                ? "bg-indigo-900 text-indigo-200"
                : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"}`}
            style={{ paddingLeft: depth * 14 + 22 }}
            onClick={() => setSelectedFile(node.file!)}
          >
            <span className="shrink-0">{getFileIcon(node.path)}</span>
            <span className="truncate">{node.name}</span>
          </div>
        )}
        {node.type === "dir" && expandedDirs.has(node.path) && node.children &&
          renderTree(node.children, depth + 1)
        }
      </div>
    ));

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

  const tree = buildTree(data.fichiers, fileSearch);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-300 overflow-hidden">

      {/* ── Topbar ── */}
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

        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
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

        {/* ── Viewer ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
              <div className="text-4xl">📄</div>
              <div className="text-xs font-mono text-gray-500">Sélectionnez un fichier</div>
              <div className="text-xs font-mono text-gray-700">dans l'arborescence à gauche</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-2 bg-gray-900 border-b border-gray-800 shrink-0 gap-4">
                <span className="text-xs font-mono text-indigo-400 truncate flex-1">
                  {selectedFile.path}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-yellow-500 bg-yellow-950 border border-yellow-900 rounded px-2 py-0.5">
                    {getLang(selectedFile.path)}
                  </span>
                  <span className="text-xs font-mono text-gray-600">
                    {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.content.split("\n").length} lignes
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
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
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}