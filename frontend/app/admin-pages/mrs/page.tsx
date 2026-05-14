"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, StatusBadge, EmptyRow, Loader, ErrorState, SearchInput } from "../adminUtils";
import type { MR, UserItem } from "../adminUtils";
import { useTheme } from "../ThemeContext";

// MR standard (IA) + MR Explorer fusionnées dans un type unifié
interface UnifiedMR {
  id: number;
  source: "ia" | "explorer";           // origine de la MR
  projet_nom: string;
  user_email: string;
  titre: string;
  statut: string;
  type_mr: string;
  branche_source: string;
  branche_cible: string;
  created_at: string;
  mr_url?: string;
  mr_iid_gitlab?: number;              // uniquement explorer
  description?: string;                // uniquement explorer
}

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: ok ? "rgba(34,197,94,0.12)" : "rgba(248,113,113,0.12)",
      border: `1px solid ${ok ? "rgba(34,197,94,0.35)" : "rgba(248,113,113,0.35)"}`,
      borderRadius: 12, padding: "12px 20px", color: ok ? "#22c55e" : "#f87171",
      fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace",
      backdropFilter: "blur(10px)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span>{ok ? "✓" : "✗"}</span> {msg}
    </div>
  );
}

function ConfirmModal({ msg, onConfirm, onCancel }: { msg: string; onConfirm: () => void; onCancel: () => void }) {
  const { theme } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: "28px 32px", maxWidth: 400, width: "92%", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚠</div>
        <p style={{ color: theme.text, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ padding: "9px 22px", background: "transparent", border: `1px solid ${theme.cardBorder}`, borderRadius: 9, color: theme.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: "9px 22px", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ m, onClose }: { m: UnifiedMR; onClose: () => void }) {
  const { theme } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: "28px 32px", maxWidth: 520, width: "92%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>Merge Request #{m.id}</div>
            <SourceBadge source={m.source} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textFaint, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {([
          ["Utilisateur",    m.user_email],
          ["Projet",         m.projet_nom],
          ["Titre",          m.titre],
          ["Type",           m.type_mr],
          ["Statut",         m.statut],
          ["Branche source", m.branche_source],
          ["Branche cible",  m.branche_cible],
          ["Créée le",       m.created_at || "—"],
          ...(m.mr_iid_gitlab ? [["IID GitLab", `!${m.mr_iid_gitlab}`]] : []),
        ] as [string,string][]).map(([label, val]) => (
          <div key={label} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", minWidth: 130 }}>{label}</span>
            <span style={{ fontSize: 12, color: theme.textMuted, wordBreak: "break-all" }}>{val}</span>
          </div>
        ))}
        {m.description && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>Description</div>
            <div style={{ background: theme.bg, border: `1px solid ${theme.cardBorder}`, borderRadius: 8, padding: 12, fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
              {m.description}
            </div>
          </div>
        )}
        {m.mr_url && (
          <div style={{ marginTop: 20 }}>
            <a href={m.mr_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "rgba(91,99,245,0.12)", border: "1px solid rgba(91,99,245,0.35)", borderRadius: 9, color: "#818cf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              ↗ Ouvrir sur GitLab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Badge qui distingue la source de la MR
function SourceBadge({ source }: { source: "ia" | "explorer" }) {
  const cfg = source === "ia"
    ? { bg: "rgba(91,99,245,0.12)",  text: "#818cf8", label: "🤖 IA" }
    : { bg: "rgba(34,197,94,0.1)",   text: "#22c55e", label: "🔭 Explorer" };
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontWeight: 700, padding: "2px 9px", borderRadius: 20, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", border: `1px solid ${cfg.text}33`, marginTop: 4, display: "inline-block" }}>
      {cfg.label}
    </span>
  );
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  auto_merge: { label: "🤖 Auto",     color: "#60a5fa" },
  tests:      { label: "🧪 Tests",    color: "#8b5cf6" },
  diff:       { label: "⇄ Diff",      color: "#f59e0b" },
  force:      { label: "⚠️ Force",    color: "#ef4444" },
  explorer:   { label: "🔭 Explorer", color: "#22c55e" },
};

export default function AdminMRsPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [mrs, setMrs]         = useState<UnifiedMR[]>([]);
  const [search, setSearch]   = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ action: () => Promise<void>; msg: string } | null>(null);
  const [detail, setDetail]   = useState<UnifiedMR | null>(null);

  const showToast = (msg: string, ok = true) => setToast({ msg, ok });

  const load = async () => {
    setLoading(true); setError("");
    try {
      const all: UnifiedMR[] = [];

      // ── 1. MR créées par l'IA (route admin existante) ────────────
      try {
        const mrRes = await axios.get(`${API}/admin/merge-requests`, { headers: getHeaders() });
        for (const m of mrRes.data) {
          all.push({
            id:             m.id,
            source:         "ia",
            projet_nom:     m.projet_nom || "—",
            user_email:     m.user_email || "—",
            titre:          m.titre || "—",
            statut:         m.statut,
            type_mr:        m.type_mr || "auto_merge",
            branche_source: m.branche_source || "—",
            branche_cible:  m.branche_cible  || "—",
            created_at:     m.created_at?.split("T")[0] || "",
            mr_url:         m.mr_url,
          });
        }
      } catch {}

      // ── 2. MR créées via l'Explorateur ───────────────────────────
      try {
        const expRes = await axios.get(`${API}/admin/mr-explorations`, { headers: getHeaders() });
        for (const m of expRes.data) {
          all.push({
            id:             m.id,
            source:         "explorer",
            projet_nom:     m.projet_nom || "—",
            user_email:     m.user_email || "—",
            titre:          m.titre || "—",
            statut:         m.statut,
            type_mr:        "explorer",
            branche_source: m.branche_source || "—",
            branche_cible:  m.branche_cible  || "—",
            created_at:     m.created_at?.split("T")[0] || "",
            mr_url:         m.mr_url,
            mr_iid_gitlab:  m.mr_iid_gitlab,
            description:    m.description,
          });
        }
      } catch {}

      // Tri par date décroissante
      all.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
      setMrs(all);
    } catch {
      setError("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Actions sur les MR IA ────────────────────────────────────────
  const closeMR_IA = async (m: UnifiedMR) => {
    const isDiff = m.type_mr === "auto_merge" || m.type_mr === "diff" || m.type_mr === "force";
    const ep = isDiff
      ? `${API}/merge-requests-diff/${m.id}/close`
      : `${API}/merge-requests/${m.id}/close`;
    await axios.put(ep, {}, { headers: getHeaders() });
    setMrs(prev => prev.map(r => r.id === m.id && r.source === "ia" ? { ...r, statut: "closed" } : r));
    showToast("MR fermée avec succès.");
  };

  const reopenMR_IA = async (m: UnifiedMR) => {
    const isDiff = m.type_mr === "auto_merge" || m.type_mr === "diff" || m.type_mr === "force";
    const ep = isDiff
      ? `${API}/merge-requests-diff/${m.id}/reopen`
      : `${API}/merge-requests/${m.id}/reopen`;
    await axios.put(ep, {}, { headers: getHeaders() });
    setMrs(prev => prev.map(r => r.id === m.id && r.source === "ia" ? { ...r, statut: "opened" } : r));
    showToast("MR réouverte avec succès.");
  };

  // ── Actions sur les MR Explorer ──────────────────────────────────
  const updateStatutExplorer = async (m: UnifiedMR, statut: string) => {
    await axios.patch(`${API}/admin/mr-explorations/${m.id}/statut`, { statut }, { headers: getHeaders() });
    setMrs(prev => prev.map(r => r.id === m.id && r.source === "explorer" ? { ...r, statut } : r));
    showToast(`Statut mis à jour : ${statut}`);
  };

  const deleteExplorerMR = async (m: UnifiedMR) => {
    await axios.delete(`${API}/admin/mr-explorations/${m.id}`, { headers: getHeaders() });
    setMrs(prev => prev.filter(r => !(r.id === m.id && r.source === "explorer")));
    showToast("MR Explorer supprimée.");
  };

  const runConfirm = async (action: () => Promise<void>) => {
    try { await action(); }
    catch { showToast("Erreur lors de l'opération.", false); }
    setConfirm(null);
  };

  // ── Filtrage ─────────────────────────────────────────────────────
  const filtered = mrs.filter(m =>
    (filterSource === "all" || m.source === filterSource) &&
    (filterStatut === "all" || m.statut === filterStatut) &&
    (filterType   === "all" || m.type_mr === filterType) &&
    (
      m.projet_nom?.toLowerCase().includes(search.toLowerCase()) ||
      m.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      m.titre?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const opened   = mrs.filter(m => m.statut === "opened").length;
  const merged   = mrs.filter(m => m.statut === "merged").length;
  const closed   = mrs.filter(m => m.statut === "closed").length;
  const fromIA   = mrs.filter(m => m.source === "ia").length;
  const fromExp  = mrs.filter(m => m.source === "explorer").length;

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @keyframes spin   { to { transform:rotate(360deg) } }
      `}</style>

      {loading ? <Loader message="Chargement des merge requests..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex: 1, background: theme.bg, overflowY: "auto", display: "flex", flexDirection: "column", transition: "background 0.3s" }}>
          <PageHeader icon="⊕" title="Merge Requests" count={filtered.length} sub="Toutes les MR — créées par l'IA et via l'Explorateur" onRefresh={load} />

          <div style={{ padding: "24px 36px", flex: 1 }}>

            {/* ── MÉTRIQUES ─────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Total MR",        value: mrs.length, color: "#5b63f5" },
                { label: "Ouvertes",         value: opened,     color: "#60a5fa" },
                { label: "Fusionnées",       value: merged,     color: "#22c55e" },
                { label: "Fermées",          value: closed,     color: "#6b7280" },
                { label: "🤖 Via IA",        value: fromIA,     color: "#818cf8" },
                { label: "🔭 Via Explorer",  value: fromExp,    color: "#34d399" },
              ].map(m => (
                <div key={m.label} style={{ background: `${m.color}10`, border: `1px solid ${m.color}28`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* ── FILTRES ───────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

                {/* Source */}
                {[
                  { v: "all",      l: "Toutes" },
                  { v: "ia",       l: "🤖 IA" },
                  { v: "explorer", l: "🔭 Explorer" },
                ].map(f => (
                  <button key={f.v} onClick={() => setFilterSource(f.v)} style={{
                    padding: "6px 13px",
                    border: `1px solid ${filterSource === f.v ? "rgba(91,99,245,0.4)" : theme.cardBorder}`,
                    background: filterSource === f.v ? "rgba(91,99,245,0.12)" : "transparent",
                    borderRadius: 8, color: filterSource === f.v ? "#818cf8" : theme.textFaint,
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>{f.l}</button>
                ))}

                <span style={{ color: theme.cardBorder, padding: "0 4px", alignSelf: "center" }}>|</span>

                {/* Statut */}
                {[
                  { v: "all",    l: "Tout statut" },
                  { v: "opened", l: "Ouvertes" },
                  { v: "merged", l: "Fusionnées" },
                  { v: "closed", l: "Fermées" },
                ].map(f => (
                  <button key={f.v} onClick={() => setFilterStatut(f.v)} style={{
                    padding: "6px 13px",
                    border: `1px solid ${filterStatut === f.v ? "rgba(96,165,250,0.4)" : theme.cardBorder}`,
                    background: filterStatut === f.v ? "rgba(96,165,250,0.1)" : "transparent",
                    borderRadius: 8, color: filterStatut === f.v ? "#60a5fa" : theme.textFaint,
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>{f.l}</button>
                ))}

                <span style={{ color: theme.cardBorder, padding: "0 4px", alignSelf: "center" }}>|</span>

                {/* Type */}
                {["all", "auto_merge", "tests", "diff", "force", "explorer"].map(t => (
                  <button key={t} onClick={() => setFilterType(t)} style={{
                    padding: "6px 13px",
                    border: `1px solid ${filterType === t ? "rgba(245,158,11,0.4)" : theme.cardBorder}`,
                    background: filterType === t ? "rgba(245,158,11,0.08)" : "transparent",
                    borderRadius: 8, color: filterType === t ? "#f59e0b" : theme.textFaint,
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>
                    {t === "all" ? "Tout type" : TYPE_LABELS[t]?.label || t}
                  </button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Projet, email, titre..." />
            </div>

            {/* ── TABLEAU ───────────────────────────────────────── */}
            <DataTable>
              <thead><tr>
                <TH>ID</TH>
                <TH center>Source</TH>
                <TH>Projet</TH>
                <TH>Utilisateur</TH>
                <TH>Titre</TH>
                <TH center>Type</TH>
                <TH>Branches</TH>
                <TH center>Statut</TH>
                <TH>Date</TH>
                <TH center>Actions</TH>
              </tr></thead>
              <tbody>
                {filtered.map((m, i) => {
                  const tc = TYPE_LABELS[m.type_mr];
                  const isOpened = m.statut === "opened";
                  const isMerged = m.statut === "merged";
                  return (
                    <tr key={`${m.source}-${m.id}`} style={{ background: i % 2 === 0 ? "transparent" : `${theme.cardBorder}15`, animation: "fadeIn 0.25s ease backwards", animationDelay: `${i * 0.03}s` }}>
                      <TD><span style={{ color: theme.textFaint, fontSize: 10 }}>#{m.id}</span></TD>
                      <TD center><SourceBadge source={m.source} /></TD>
                      <TD><b style={{ color: theme.text, fontSize: 12 }}>📁 {m.projet_nom}</b></TD>
                      <TD><span style={{ color: "#818cf8", fontSize: 11 }}>{m.user_email}</span></TD>
                      <TD>
                        <div style={{ maxWidth: 200 }}>
                          {m.mr_url ? (
                            <a href={m.mr_url} target="_blank" rel="noreferrer" style={{ color: "#5b63f5", textDecoration: "none", fontSize: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {m.mr_iid_gitlab ? `!${m.mr_iid_gitlab} ` : ""}{m.titre}
                            </a>
                          ) : (
                            <span style={{ color: theme.textMuted, fontSize: 12 }}>{m.titre}</span>
                          )}
                        </div>
                      </TD>
                      <TD center>
                        {tc ? (
                          <span style={{ background: `${tc.color}18`, color: tc.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, border: `1px solid ${tc.color}30`, whiteSpace: "nowrap" }}>
                            {tc.label}
                          </span>
                        ) : (
                          <span style={{ color: theme.textFaint, fontSize: 11 }}>{m.type_mr}</span>
                        )}
                      </TD>
                      <TD>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <code style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>
                            {m.branche_source?.slice(0, 22)}
                          </code>
                          <span style={{ color: theme.textFaint, fontSize: 9, textAlign: "center" }}>→</span>
                          <code style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>
                            {m.branche_cible}
                          </code>
                        </div>
                      </TD>
                      <TD center><StatusBadge status={m.statut} /></TD>
                      <TD><span style={{ color: theme.textFaint, fontSize: 11 }}>{m.created_at}</span></TD>
                      <TD center>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>

                          {/* Bouton Détails */}
                          <button onClick={() => setDetail(m)} style={btnStyle(theme.accent, false)}>
                            Détails
                          </button>

                          {/* Actions IA */}
                          {m.source === "ia" && !isMerged && (
                            isOpened ? (
                              <button onClick={() => setConfirm({ action: () => closeMR_IA(m), msg: `Fermer la MR "${m.titre}" ?` })} style={btnStyle("#f87171", false)}>
                                Fermer
                              </button>
                            ) : (
                              <button onClick={() => setConfirm({ action: () => reopenMR_IA(m), msg: `Rouvrir la MR "${m.titre}" ?` })} style={btnStyle("#22c55e", false)}>
                                Rouvrir
                              </button>
                            )
                          )}

                          {/* Actions Explorer */}
                          {m.source === "explorer" && (
                            <>
                              {isOpened && (
                                <>
                                  <button onClick={() => setConfirm({ action: () => updateStatutExplorer(m, "merged"), msg: `Marquer la MR comme fusionnée ?` })} style={btnStyle("#22c55e", false)}>
                                    Fusionner
                                  </button>
                                  <button onClick={() => setConfirm({ action: () => updateStatutExplorer(m, "closed"), msg: `Fermer la MR "${m.titre}" ?` })} style={btnStyle("#9ca3af", false)}>
                                    Fermer
                                  </button>
                                </>
                              )}
                              {!isOpened && (
                                <button onClick={() => setConfirm({ action: () => updateStatutExplorer(m, "opened"), msg: `Rouvrir la MR "${m.titre}" ?` })} style={btnStyle("#60a5fa", false)}>
                                  Rouvrir
                                </button>
                              )}
                              <button onClick={() => setConfirm({ action: () => deleteExplorerMR(m), msg: `Supprimer la MR Explorer "${m.titre}" ?` })} style={btnStyle("#f87171", false)}>
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </TD>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <EmptyRow cols={10} message="Aucune merge request disponible" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          msg={confirm.msg}
          onConfirm={() => runConfirm(confirm.action)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {detail && <DetailModal m={detail} onClose={() => setDetail(null)} />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}

// ── Petit helper style pour les boutons d'action ──────────────────
function btnStyle(color: string, outline: boolean): React.CSSProperties {
  return {
    padding: "5px 11px",
    background: `${color}18`,
    border: `1px solid ${color}33`,
    borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600,
    color, fontFamily: "'JetBrains Mono',monospace",
    transition: "all 0.15s", whiteSpace: "nowrap",
  };
}

