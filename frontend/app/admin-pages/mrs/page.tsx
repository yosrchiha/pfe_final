"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, StatusBadge, EmptyRow, Loader, ErrorState, SearchInput } from "../adminUtils";
import type { MR, UserItem } from "../adminUtils";

export default function AdminMRsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [mrs, setMrs]         = useState<MR[]>([]);
  const [search, setSearch]   = useState("");
  const [filterType, setFilterType] = useState("all");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const usersRes = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      const all: MR[] = [];
      for (const u of usersRes.data as UserItem[]) {
        try {
          const dr = await axios.get(`${API}/analyses/depots-user/${u.id}`, { headers: getHeaders() });
          for (const d of dr.data) {
            try {
              const mrRes = await axios.get(`${API}/merge-requests/depot/${d.id}`, { headers: getHeaders() });
              for (const m of mrRes.data) {
                all.push({ 
                  id: m.id, 
                  projet_nom: d.nom, 
                  user_email: u.email, 
                  titre: m.titre || "—", 
                  statut: m.statut, 
                  type_mr: m.type_mr, 
                  branche_source: m.branche_source, 
                  branche_cible: m.branche_cible, 
                  created_at: m.created_at?.split("T")[0] || "", 
                  mr_url: m.mr_url 
                });
              }
            } catch {}
          }
        } catch {}
      }
      setMrs(all);
    } catch { setError("Erreur de chargement."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Actions : Fermer / Rouvrir une MR ───────────────────────────
  const closeMR = async (mr: MR) => {
    if (!confirm(`Fermer la MR "${mr.titre}" ?`)) return;
    try {
      // Déterminer si c'est une MR de diff ou normale
      const isDiff = mr.type_mr === "auto_merge" || mr.type_mr === "diff" || mr.type_mr === "force";
      const endpoint = isDiff 
        ? `${API}/merge-requests-diff/${mr.id}/close`
        : `${API}/merge-requests/${mr.id}/close`;
      
      await axios.put(endpoint, {}, { headers: getHeaders() });
      alert("✅ Merge Request fermée avec succès");
      load(); // Recharger la liste
    } catch (err: any) {
      alert(`Erreur: ${err.response?.data?.detail || err.message}`);
    }
  };

  const reopenMR = async (mr: MR) => {
    if (!confirm(`Rouvrir la MR "${mr.titre}" ?`)) return;
    try {
      const isDiff = mr.type_mr === "auto_merge" || mr.type_mr === "diff" || mr.type_mr === "force";
      const endpoint = isDiff 
        ? `${API}/merge-requests-diff/${mr.id}/reopen`
        : `${API}/merge-requests/${mr.id}/reopen`;
      
      await axios.put(endpoint, {}, { headers: getHeaders() });
      alert("✅ Merge Request réouverte avec succès");
      load(); // Recharger la liste
    } catch (err: any) {
      alert(`Erreur: ${err.response?.data?.detail || err.message}`);
    }
  };

  const filtered = mrs.filter(m =>
    (filterType === "all" || m.type_mr === filterType) &&
    (m.projet_nom?.toLowerCase().includes(search.toLowerCase()) ||
     m.user_email?.toLowerCase().includes(search.toLowerCase()) ||
     m.titre?.toLowerCase().includes(search.toLowerCase()))
  );

  const opened = mrs.filter(m => m.statut === "opened").length;
  const merged = mrs.filter(m => m.statut === "merged").length;
  const closed = mrs.filter(m => m.statut === "closed").length;

  const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    auto_merge: { label: "🤖 Auto", color: "#60a5fa" },
    tests:      { label: "🧪 Tests", color: "#8b5cf6" },
    diff:       { label: "⇄ Diff",  color: "#f59e0b" },
    force:      { label: "⚠️ Force", color: "#ef4444" },
  };

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .action-btn { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-right: 6px; border: none; }
        .action-close { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
        .action-close:hover { background: #fee2e2; }
        .action-reopen { background: #ecfdf5; color: #10b981; border: 1px solid #bbf7d0; }
        .action-reopen:hover { background: #d1fae5; }
        .action-sync { background: #eef2ff; color: #6366f1; border: 1px solid #c7d2fe; }
        .action-sync:hover { background: #e0e7ff; }
      `}</style>

      {loading ? <Loader message="Chargement des merge requests..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex: 1, background: "#07090f", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <PageHeader icon="⊕" title="Merge Requests" count={filtered.length} sub="Merge requests créées par l'IA" onRefresh={load} />

          <div style={{ padding: "24px 36px", flex: 1 }}>
            {/* STATS CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Total MR",   value: mrs.length, color: "#5b63f5" },
                { label: "Ouvertes",   value: opened,     color: "#60a5fa" },
                { label: "Fusionnées", value: merged,     color: "#22c55e" },
                { label: "Fermées",    value: closed,     color: "#6b7280" },
              ].map(m => (
                <div key={m.label} style={{ background: `${m.color}10`, border: `1px solid ${m.color}28`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: "#a8b0d0", fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* FILTRES */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {["all", "auto_merge", "tests", "diff", "force"].map(t => (
                  <button key={t} onClick={() => setFilterType(t)} style={{
                    padding: "6px 14px", border: `1px solid ${filterType === t ? "rgba(91,99,245,0.4)" : "#1e2235"}`,
                    background: filterType === t ? "rgba(91,99,245,0.12)" : "transparent",
                    borderRadius: 8, color: filterType === t ? "#818cf8" : "#5a6080",
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>
                    {t === "all" ? "Tous" : TYPE_LABELS[t]?.label || t}
                  </button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Projet, email ou titre..." />
            </div>

            {/* TABLEAU */}
            <DataTable>
              <thead>
                <tr>
                  <TH>ID</TH><TH>Projet</TH><TH>Utilisateur</TH><TH>Titre</TH>
                  <TH center>Type</TH><TH>Source → Cible</TH><TH center>Statut</TH><TH>Date</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const tc = TYPE_LABELS[m.type_mr];
                  const isOpened = m.statut === "opened";
                  const isMerged = m.statut === "merged";
                  return (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)", animation: "fadeIn 0.25s ease backwards", animationDelay: `${i * 0.03}s` }}>
                      <TD><span style={{ color: "#3a4060", fontSize: 10 }}>#{m.id}</span></TD>
                      <TD><b style={{ color: "#f1f3fc" }}>📁 {m.projet_nom}</b></TD>
                      <TD><span style={{ color: "#818cf8", fontSize: 11 }}>{m.user_email}</span></TD>
                      <TD>
                        {m.mr_url ? (
                          <a href={m.mr_url} target="_blank" rel="noreferrer" style={{ color: "#5b63f5", textDecoration: "none", fontSize: 12 }}>{m.titre}</a>
                        ) : (
                          <span style={{ color: "#a8b0d0", fontSize: 12 }}>{m.titre}</span>
                        )}
                      </TD>
                      <TD center>
                        {tc ? (
                          <span style={{ background: `${tc.color}18`, color: tc.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, border: `1px solid ${tc.color}30` }}>
                            {tc.label}
                          </span>
                        ) : (
                          <span style={{ color: "#5a6080", fontSize: 11 }}>{m.type_mr}</span>
                        )}
                      </TD>
                      <TD>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <code style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "2px 6px", borderRadius: 5, fontSize: 10 }}>{m.branche_source?.slice(0, 20)}</code>
                          <span style={{ color: "#3a4060" }}>→</span>
                          <code style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", padding: "2px 6px", borderRadius: 5, fontSize: 10 }}>{m.branche_cible}</code>
                        </div>
                      </TD>
                      <TD center><StatusBadge status={m.statut} /></TD>
                      <TD><span style={{ color: "#5a6080", fontSize: 11 }}>{m.created_at}</span></TD>
                      <TD center>
                        {!isMerged && (
                          <>
                            {isOpened ? (
                              <button className="action-btn action-close" onClick={() => closeMR(m)}>
                                Fermer
                              </button>
                            ) : (
                              <button className="action-btn action-reopen" onClick={() => reopenMR(m)}>
                                Rouvrir
                              </button>
                            )}
                          </>
                        )}
                        {isMerged && (
                          <span style={{ fontSize: 10, color: "#6b7280" }}>Fusionnée</span>
                        )}
                      </TD>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <EmptyRow cols={9} message="Aucune merge request disponible" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}