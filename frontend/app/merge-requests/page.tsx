"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://localhost:8001";

// ── TYPES ────────────────────────────────────────────────────────
interface Projet {
  id: number; nom: string; project_url: string;
  branche: string; created_at: string;
}

interface MergeRequest {
  id: number;
  analyse_id?: number; analyse_diff_id?: number;
  test_id?: number | null;
  depot_analyse_id?: number; depot_id?: number;
  mr_id_gitlab: number; mr_iid_gitlab?: number;
  mr_url: string; titre: string;
  description: string | null;
  branche_source: string; branche_cible: string;
  statut: string; type_mr: string;
  labels: string | null;
  created_at: string; updated_at?: string | null;
  depot_nom?: string;
  analyse_score_qualite?: number | null;
  analyse_score_securite?: number | null;
  analyse_score_performance?: number | null;
  analyse_resultat_statut?: string | null;
}

// ── HELPERS ──────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  tests:      { icon: "🧪", label: "Tests IA",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  auto_merge: { icon: "⚡", label: "Auto-merge",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  diff:       { icon: "🔬", label: "Diff IA",     color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  force:      { icon: "⚠️", label: "Forcée",      color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  exploration:{ icon: "🗂️", label: "Exploration",  color: "#0284c7", bg: "#e0f2fe", border: "#bae6fd" },
};

const STATUT_CONFIG: Record<string, { dot: string; label: string; color: string; bg: string }> = {
  opened: { dot: "#f59e0b", label: "Ouverte",    color: "#92400e", bg: "#fef3c7" },
  merged: { dot: "#10b981", label: "Fusionnée",  color: "#065f46", bg: "#d1fae5" },
  closed: { dot: "#6b7280", label: "Fermée",     color: "#374151", bg: "#f3f4f6" },
};

function getType(type: string)   { return TYPE_CONFIG[type]   || { icon: "🔀", label: type,   color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" }; }
function getStatut(s: string)    { return STATUT_CONFIG[s]    || { dot: "#94a3b8", label: s,   color: "#475569", bg: "#f1f5f9" }; }

function ScoreDot({ score }: { score: number | null | undefined }) {
  if (score == null) return <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>;
  const c = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: c }}>{score}</span>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
export default function MergeRequestsPage() {
  const router = useRouter();

  const [projets, setProjets]           = useState<Projet[]>([]);
  const [projetFiltre, setProjetFiltre] = useState<number | "all">("all");
  const [mrs, setMrs]                   = useState<MergeRequest[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [selectedMr, setSelectedMr]     = useState<MergeRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  const headers = () => {
    const t = localStorage.getItem("token");
    return { Authorization: t ? `Bearer ${t}` : "" };
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── FETCH DATA ────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }

      const me = await axios.get(`${API}/auth/me`, { headers: headers() });
      const userId = me.data.id;

      // Charger projets
      const projRes = await axios.get(`${API}/analyses/depots-user/${userId}`, { headers: headers() });
      setProjets(projRes.data);

      // Charger dépôts des deux sources
      const [resAnalyses, resDepots] = await Promise.allSettled([
        axios.get(`${API}/analyses/depots-user/${userId}`, { headers: headers() }),
        axios.get(`${API}/depots/user/${userId}`,          { headers: headers() }),
      ]);

      const seen = new Set<number>();
      const depots: any[] = [];
      for (const r of [resAnalyses, resDepots]) {
        if (r.status === "fulfilled") {
          for (const d of r.value.data) {
            if (!seen.has(d.id)) { seen.add(d.id); depots.push(d); }
          }
        }
      }

      // Charger MR de chaque dépôt
      let all: MergeRequest[] = [];
      for (const depot of depots) {
        // MR tests/analyses
        try {
          const r = await axios.get(`${API}/merge-requests/depot/${depot.id}`, { headers: headers() });
          for (const mr of r.data) {
            all.push({ ...mr, depot_nom: depot.nom, depot_id: depot.id,
              titre: mr.titre || "", branche_source: mr.branche_source || "",
              branche_cible: mr.branche_cible || "", statut: mr.statut || "opened" });
          }
        } catch {}
        // MR diff
        try {
          const r = await axios.get(`${API}/merge-requests-diff/depot/${depot.id}`, { headers: headers() });
          for (const mr of r.data) {
            all.push({ ...mr, depot_nom: depot.nom, depot_id: depot.id,
              titre: mr.title || mr.titre || "",
              branche_source: mr.source_branch || mr.branche_source || "",
              branche_cible:  mr.target_branch || mr.branche_cible  || "",
              statut:  mr.state   || mr.statut  || "opened",
              type_mr: mr.type_mr === "auto" ? "auto_merge" : (mr.type_mr || "diff") });
          }
        } catch {}
      }

      // ── MR d'exploration (GET /explorer/mr/history) ──────────
      try {
        const expMrs = await axios.get(`${API}/explorer/mr/history`, { headers: headers() });
        for (const m of expMrs.data) {
          let filesList: string[] = [];
          try { filesList = m.fichiers_modifies ? JSON.parse(m.fichiers_modifies) : []; } catch {}
          const descr = filesList.length > 0
            ? `Fichiers modifiés : ${filesList.slice(0, 5).join(", ")}${filesList.length > 5 ? ` (+${filesList.length - 5})` : ""}`
            : (m.description ?? null);
          all.push({
            id:             m.id + 900000,
            mr_id_gitlab:   m.mr_id_gitlab  ?? 0,
            mr_iid_gitlab:  m.mr_iid_gitlab ?? 0,
            mr_url:         m.mr_url        ?? "",
            titre:          m.titre         ?? "MR Exploration",
            description:    descr,
            branche_source: m.branche_source ?? "",
            branche_cible:  m.branche_cible  ?? "",
            statut:         m.statut         ?? "opened",
            type_mr:        "exploration",
            labels:         null,
            created_at:     m.created_at,
            depot_nom:      m.projet_nom    ?? m.projet_chemin ?? "—",
          } as any);
        }
      } catch { /* silencieux */ }

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMrs(all);
    } catch (e: any) {
      if (e?.response?.status === 401) { localStorage.removeItem("token"); router.push("/login"); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── FERMER / ROUVRIR UNE MR ───────────────────────────────────
  // Cette fonction :
  // 1. Appelle le backend → qui appelle l'API GitLab pour fermer/rouvrir la MR
  // 2. Met à jour l'état local immédiatement
  const toggleMrStatut = async (mr: MergeRequest) => {
    const isDiff = mr.type_mr === "auto_merge" || mr.type_mr === "diff" || mr.type_mr === "force";
    const newStatut = mr.statut === "opened" ? "closed" : "opened";
    const action    = mr.statut === "opened" ? "close" : "reopen";

    setActionLoading(mr.id);
    try {
      // Appel backend pour fermer/rouvrir sur GitLab
      const endpoint = isDiff
        ? `${API}/merge-requests-diff/${mr.id}/${action}`
        : `${API}/merge-requests/${mr.id}/${action}`;

      await axios.put(endpoint, {}, { headers: headers() });

      // Mettre à jour l'état local
      setMrs(prev => prev.map(m =>
        m.id === mr.id ? { ...m, statut: newStatut } : m
      ));
      // Mettre à jour le modal si ouvert
      if (selectedMr?.id === mr.id) {
        setSelectedMr(prev => prev ? { ...prev, statut: newStatut } : null);
      }

      showToast(
        mr.statut === "opened"
          ? `MR fermée sur GitLab ✓`
          : `MR réouverte sur GitLab ✓`,
        true
      );
    } catch (e: any) {
      showToast(`Erreur : ${e?.response?.data?.detail || "Impossible de modifier la MR"}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  // ── SYNC STATUT ───────────────────────────────────────────────
  const syncMr = async (mr: MergeRequest) => {
    const isDiff = mr.type_mr === "auto_merge" || mr.type_mr === "diff" || mr.type_mr === "force";
    const endpoint = isDiff
      ? `${API}/merge-requests-diff/${mr.id}/sync`
      : `${API}/merge-requests/${mr.id}/sync`;

    setActionLoading(mr.id);
    try {
      const res = await axios.put(endpoint, {}, { headers: headers() });
      const newStatut = res.data?.statut || res.data?.gitlab_state || mr.statut;
      setMrs(prev => prev.map(m => m.id === mr.id ? { ...m, statut: newStatut } : m));
      if (selectedMr?.id === mr.id) setSelectedMr(prev => prev ? { ...prev, statut: newStatut } : null);
      showToast("Statut synchronisé depuis GitLab ✓");
    } catch {
      showToast("Erreur de synchronisation", false);
    } finally {
      setActionLoading(null);
    }
  };

  // ── FILTRES ───────────────────────────────────────────────────
  const filtered = mrs.filter(mr => {
    const matchProjet  = projetFiltre === "all" || mr.depot_id === projetFiltre || mr.depot_analyse_id === projetFiltre;
    const matchSearch  = !search ||
      mr.titre?.toLowerCase().includes(search.toLowerCase()) ||
      mr.branche_source?.toLowerCase().includes(search.toLowerCase()) ||
      mr.branche_cible?.toLowerCase().includes(search.toLowerCase()) ||
      mr.depot_nom?.toLowerCase().includes(search.toLowerCase());
    const matchType    = filterType   === "all" || mr.type_mr === filterType;
    const matchStatut  = filterStatut === "all" || mr.statut  === filterStatut;
    return matchProjet && matchSearch && matchType && matchStatut;
  });

  const stats = {
    total:   filtered.length,
    opened:  filtered.filter(m => m.statut === "opened").length,
    merged:  filtered.filter(m => m.statut === "merged").length,
    closed:  filtered.filter(m => m.statut === "closed").length,
    tests:   filtered.filter(m => m.type_mr === "tests").length,
    auto:    filtered.filter(m => m.type_mr === "auto_merge").length,
    diff:    filtered.filter(m => m.type_mr === "diff").length,
    force:       filtered.filter(m => m.type_mr === "force").length,
    exploration: filtered.filter(m => m.type_mr === "exploration").length,
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? "#064e3b" : "#7f1d1d",
          border: `1px solid ${toast.ok ? "#059669" : "#dc2626"}`,
          color: "#fff", borderRadius: 12, padding: "12px 20px",
          fontSize: 13, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 8,
          animation: "slideIn 0.3s ease",
        }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeUp  { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .mr-row:hover { background: #1a1f2e !important; }
        .action-btn:hover { opacity: 0.85; transform: scale(0.97); }
        .action-btn { transition: all 0.15s ease; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #1a1f2e; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔀</div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                Merge Requests
              </h1>
            </div>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
              Toutes les MR générées par l'IA — tests, diff, auto-merge
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={fetchAll}
              style={{ padding: "8px 16px", background: "#1e2538", border: "1px solid #2d3748", borderRadius: 10, color: "#94a3b8", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              ↻ Rafraîchir
            </button>
            <button onClick={() => router.push("/dashboard")}
              style={{ padding: "8px 16px", background: "#1e2538", border: "1px solid #2d3748", borderRadius: 10, color: "#94a3b8", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              ← Retour
            </button>
          </div>
        </div>

        {/* ── STATS BAND ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Total",      value: stats.total,  color: "#6366f1", bg: "#1e1b4b" },
            { label: "Ouvertes",   value: stats.opened, color: "#f59e0b", bg: "#1c1409" },
            { label: "Fusionnées", value: stats.merged, color: "#10b981", bg: "#022c22" },
            { label: "Fermées",    value: stats.closed, color: "#94a3b8", bg: "#1a1f2e" },
            { label: "🧪 Tests",   value: stats.tests,  color: "#7c3aed", bg: "#1e1b4b" },
            { label: "⚡ Auto",    value: stats.auto,   color: "#d97706", bg: "#1c1409" },
            { label: "🔬 Diff",    value: stats.diff,   color: "#059669", bg: "#022c22" },
            { label: "⚠️ Force",   value: stats.force,  color: "#ef4444", bg: "#1f0909" },
            { label: "🗂️ Explorer",  value: stats.exploration, color: "#0284c7", bg: "#082f49" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── FILTRES ── */}
        <div style={{ background: "#141921", border: "1px solid #1e2538", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <select value={projetFiltre === "all" ? "all" : String(projetFiltre)}
            onChange={e => setProjetFiltre(e.target.value === "all" ? "all" : Number(e.target.value))}
            style={{ padding: "8px 12px", background: "#1e2538", border: "1px solid #2d3748", borderRadius: 9, color: "#94a3b8", fontSize: 13, cursor: "pointer", outline: "none" }}>
            <option value="all">📁 Tous les projets</option>
            {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>

          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: "8px 12px", background: "#1e2538", border: "1px solid #2d3748", borderRadius: 9, color: "#94a3b8", fontSize: 13, cursor: "pointer", outline: "none" }}>
            <option value="all">🏷️ Tous les types</option>
            <option value="tests">🧪 Tests IA</option>
            <option value="auto_merge">⚡ Auto-merge</option>
            <option value="diff">🔬 Diff IA</option>
            <option value="force">⚠️ Forcée</option>
            <option value="exploration">🗂️ Exploration</option>
          </select>

          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            style={{ padding: "8px 12px", background: "#1e2538", border: "1px solid #2d3748", borderRadius: 9, color: "#94a3b8", fontSize: 13, cursor: "pointer", outline: "none" }}>
            <option value="all">🔄 Tous les statuts</option>
            <option value="opened">🟡 Ouvertes</option>
            <option value="merged">🟢 Fusionnées</option>
            <option value="closed">⚫ Fermées</option>
          </select>

          <input type="text" placeholder="🔍 Rechercher titre, branche, projet..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "8px 14px", background: "#1e2538", border: "1px solid #2d3748", borderRadius: 9, color: "#e2e8f0", fontSize: 13, outline: "none" }} />
        </div>

        {/* ── TABLE ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#475569" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #1e2538", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Chargement des Merge Requests...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", background: "#141921", borderRadius: 16, border: "1px solid #1e2538" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔀</div>
            <p style={{ color: "#475569", fontSize: 14 }}>Aucune Merge Request trouvée</p>
          </div>
        ) : (
          <div style={{ background: "#141921", border: "1px solid #1e2538", borderRadius: 16, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0f1117", borderBottom: "1px solid #1e2538" }}>
                  {["Projet", "Type", "Titre", "Branches", "Statut", "Scores IA", "Date", "Actions"].map(h => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((mr, i) => {
                  const type   = getType(mr.type_mr);
                  const statut = getStatut(mr.statut);
                  const isDiff = mr.type_mr === "auto_merge" || mr.type_mr === "diff" || mr.type_mr === "force";
                  const isLoading = actionLoading === mr.id;

                  return (
                    <tr key={`${mr.type_mr}-${mr.id}`} className="mr-row"
                      style={{ borderBottom: "1px solid #1a1f2e", cursor: "pointer", transition: "background 0.15s", animation: `fadeUp 0.2s ease ${i * 0.02}s both` }}
                      onClick={() => setSelectedMr(mr)}>

                      {/* Projet */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                          📁 {mr.depot_nom || "—"}
                        </span>
                      </td>

                      {/* Type */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: type.bg, color: type.color, border: `1px solid ${type.border}` }}>
                          {type.icon} {type.label}
                        </span>
                      </td>

                      {/* Titre */}
                      <td style={{ padding: "12px 16px", maxWidth: 260 }}>
                        {mr.mr_url ? (
                          <a href={mr.mr_url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: "#818cf8", fontSize: 13, fontWeight: 500, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {mr.titre?.slice(0, 55) || "Sans titre"}
                          </a>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {mr.titre?.slice(0, 55) || "Sans titre"}
                          </span>
                        )}
                      </td>

                      {/* Branches */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <code style={{ fontSize: 11, background: "#1e2538", padding: "2px 7px", borderRadius: 5, color: "#fbbf24", fontFamily: "'DM Mono',monospace" }}>
                            {(mr.branche_source || "?").slice(0, 16)}
                          </code>
                          <span style={{ color: "#475569", fontSize: 11 }}>→</span>
                          <code style={{ fontSize: 11, background: "#1e2538", padding: "2px 7px", borderRadius: 5, color: "#34d399", fontFamily: "'DM Mono',monospace" }}>
                            {(mr.branche_cible || "?").slice(0, 12)}
                          </code>
                        </div>
                      </td>

                      {/* Statut */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: statut.bg, color: statut.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statut.dot }} />
                          {statut.label}
                        </span>
                      </td>

                      {/* Scores IA */}
                      <td style={{ padding: "12px 16px" }}>
                        {(mr.analyse_score_qualite != null || mr.analyse_score_securite != null) ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ fontSize: 10, color: "#64748b" }}>Q<br /><ScoreDot score={mr.analyse_score_qualite} /></div>
                            <div style={{ fontSize: 10, color: "#64748b" }}>S<br /><ScoreDot score={mr.analyse_score_securite} /></div>
                          </div>
                        ) : (
                          <span style={{ color: "#334155", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Mono',monospace" }}>
                          {new Date(mr.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>

                          {/* Bouton Fermer / Rouvrir — FONCTIONNALITÉ PRINCIPALE */}
                          {mr.statut !== "merged" && (
                            <button className="action-btn"
                              onClick={() => toggleMrStatut(mr)}
                              disabled={isLoading}
                              title={mr.statut === "opened" ? "Fermer cette MR sur GitLab" : "Rouvrir cette MR sur GitLab"}
                              style={{
                                padding: "5px 12px", border: "none", borderRadius: 8, cursor: isLoading ? "not-allowed" : "pointer",
                                fontSize: 11, fontWeight: 600,
                                background: mr.statut === "opened" ? "#1f0909" : "#022c22",
                                color:      mr.statut === "opened" ? "#ef4444" : "#10b981",
                                opacity: isLoading ? 0.6 : 1,
                              }}>
                              {isLoading ? "..." : mr.statut === "opened" ? "✕ Fermer" : "↩ Rouvrir"}
                            </button>
                          )}

                          {/* Bouton Sync */}
                          <button className="action-btn"
                            onClick={() => syncMr(mr)}
                            disabled={isLoading}
                            title="Synchroniser le statut depuis GitLab"
                            style={{ padding: "5px 10px", border: "1px solid #2d3748", borderRadius: 8, cursor: "pointer", fontSize: 11, background: "transparent", color: "#64748b" }}>
                            {isLoading ? "..." : "↻"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── MODAL DÉTAIL ── */}
        {selectedMr && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)" }}
            onClick={() => setSelectedMr(null)}>
            <div style={{ background: "#141921", border: "1px solid #1e2538", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
              onClick={e => e.stopPropagation()}>

              {/* Modal Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e2538", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{getType(selectedMr.type_mr).icon}</span>
                    <span style={{ ...{}, background: getType(selectedMr.type_mr).bg, color: getType(selectedMr.type_mr).color, border: `1px solid ${getType(selectedMr.type_mr).border}`, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {getType(selectedMr.type_mr).label}
                    </span>
                    <span style={{ background: getStatut(selectedMr.statut).bg, color: getStatut(selectedMr.statut).color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {getStatut(selectedMr.statut).label}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.4 }}>
                    {selectedMr.titre || "Sans titre"}
                  </h3>
                  <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                    MR #{selectedMr.mr_id_gitlab} · {new Date(selectedMr.created_at).toLocaleString("fr-FR")}
                  </p>
                  {selectedMr.type_mr === "exploration" && (
                    <div style={{ marginTop: 8, padding: "6px 10px", background: "#082f49", border: "1px solid #0284c7", borderRadius: 8, fontSize: 11, color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      🗂️ MR créée depuis l'Explorateur de code
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedMr(null)}
                  style={{ background: "#1e2538", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#64748b", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Projet */}
                <div>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Projet</div>
                  <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 500 }}>📁 {selectedMr.depot_nom}</div>
                </div>

                {/* Branches */}
                <div>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Branches</div>
                  <div style={{ background: "#0f1117", borderRadius: 10, padding: "10px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>
                    <span style={{ color: "#fbbf24" }}>{selectedMr.branche_source}</span>
                    <span style={{ color: "#475569", margin: "0 8px" }}>→</span>
                    <span style={{ color: "#34d399" }}>{selectedMr.branche_cible}</span>
                  </div>
                </div>

                {/* Lien GitLab */}
                {selectedMr.mr_url && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Lien GitLab</div>
                    <a href={selectedMr.mr_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#818cf8", fontSize: 13, wordBreak: "break-all", textDecoration: "none" }}>
                      {selectedMr.mr_url}
                    </a>
                  </div>
                )}

                {/* Scores IA */}
                {(selectedMr.analyse_score_qualite != null || selectedMr.analyse_score_securite != null) && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Scores IA</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[
                        { label: "Qualité",     score: selectedMr.analyse_score_qualite },
                        { label: "Sécurité",    score: selectedMr.analyse_score_securite },
                        { label: "Performance", score: selectedMr.analyse_score_performance },
                      ].map(s => s.score != null && (
                        <div key={s.label} style={{ flex: 1, background: "#0f1117", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: s.score >= 80 ? "#10b981" : s.score >= 60 ? "#f59e0b" : "#ef4444", fontFamily: "'DM Mono',monospace" }}>
                            {s.score}
                          </div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fichiers modifiés — affiché pour les MR exploration */}
                {selectedMr.type_mr === "exploration" && selectedMr.description && selectedMr.description.startsWith("Fichiers modifiés") && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Fichiers modifiés</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedMr.description
                        .replace("Fichiers modifiés : ", "")
                        .split(", ")
                        .map((f: string, fi: number) => (
                          <span key={fi} style={{ fontSize: 10, padding: "3px 9px", background: "#082f49", border: "1px solid #0284c7", borderRadius: 8, color: "#38bdf8", fontFamily: "'DM Mono',monospace" }}>
                            {f.replace(/\(\+\d+\)$/, "").trim() || f}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedMr.description && !selectedMr.description.startsWith("Fichiers modifiés") && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Description</div>
                    <div style={{ background: "#0f1117", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto", lineHeight: 1.6 }}>
                      {selectedMr.description}
                    </div>
                  </div>
                )}

                {/* Actions du modal */}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {selectedMr.statut !== "merged" && (
                    <button
                      onClick={() => toggleMrStatut(selectedMr)}
                      disabled={actionLoading === selectedMr.id}
                      style={{
                        flex: 1, padding: "11px",
                        background: selectedMr.statut === "opened" ? "#7f1d1d" : "#064e3b",
                        color: selectedMr.statut === "opened" ? "#fca5a5" : "#6ee7b7",
                        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", transition: "opacity 0.2s",
                      }}>
                      {actionLoading === selectedMr.id
                        ? "En cours..."
                        : selectedMr.statut === "opened"
                          ? "✕ Fermer sur GitLab"
                          : "↩ Rouvrir sur GitLab"}
                    </button>
                  )}
                  <button onClick={() => syncMr(selectedMr)}
                    disabled={actionLoading === selectedMr.id}
                    style={{ flex: 1, padding: "11px", background: "#1e2538", color: "#94a3b8", border: "1px solid #2d3748", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ↻ Synchroniser
                  </button>
                  <button onClick={() => setSelectedMr(null)}
                    style={{ padding: "11px 16px", background: "#0f1117", color: "#64748b", border: "1px solid #1e2538", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
