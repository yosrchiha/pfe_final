"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import {
  API, getHeaders, PageHeader, DataTable, TH, TD,
  StatusBadge, EmptyRow, Loader, ErrorState, SearchInput, ActionBtn,
} from "../adminUtils";
import { useTheme } from "../ThemeContext";

interface Exploration {
  id: number;
  user_id: number;
  user_email: string;
  projet_nom: string;
  projet_chemin: string;
  branche: string;
  total_fichiers: number;
  statut: string;
  created_at: string | null;
  updated_at: string | null;
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
      <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: "28px 32px", maxWidth: 380, width: "90%", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚠</div>
        <p style={{ color: theme.text, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ padding: "9px 22px", background: "transparent", border: `1px solid ${theme.cardBorder}`, borderRadius: 9, color: theme.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: "9px 22px", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    active:   { bg: "rgba(34,197,94,0.12)",  text: "#22c55e", label: "Active" },
    archived: { bg: "rgba(107,114,128,0.12)", text: "#9ca3af", label: "Archivée" },
  };
  const s = colors[statut] || { bg: "rgba(91,99,245,0.12)", text: "#818cf8", label: statut };
  return (
    <span style={{ background: s.bg, color: s.text, fontWeight: 600, padding: "3px 10px", borderRadius: 20, fontSize: 11, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace", border: `1px solid ${s.text}33` }}>
      {s.label}
    </span>
  );
}

export default function AdminExplorationsPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [data, setData]       = useState<Exploration[]>([]);
  const [search, setSearch]   = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; msg: string } | null>(null);

  const showToast = (msg: string, ok = true) => setToast({ msg, ok });

  const load = async () => {
    setLoading(true); setError("");
    try {
      const r = await axios.get(`${API}/admin/explorations`, { headers: getHeaders() });
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? "Accès refusé." : "Erreur de chargement.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API}/admin/explorations/${id}`, { headers: getHeaders() });
      setData(prev => prev.filter(e => e.id !== id));
      showToast("Exploration supprimée.");
    } catch { showToast("Erreur lors de la suppression.", false); }
    setConfirm(null);
  };

  const handleStatut = async (id: number, statut: string) => {
    try {
      await axios.patch(`${API}/admin/explorations/${id}/statut`, { statut }, { headers: getHeaders() });
      setData(prev => prev.map(e => e.id === id ? { ...e, statut } : e));
      showToast(`Statut mis à jour : ${statut}`);
    } catch { showToast("Erreur lors de la mise à jour.", false); }
  };

  const filtered = data.filter(e =>
    (filterStatut === "all" || e.statut === filterStatut) &&
    (
      e.projet_nom.toLowerCase().includes(search.toLowerCase()) ||
      e.user_email.toLowerCase().includes(search.toLowerCase()) ||
      e.branche.toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalFichiers = data.reduce((s, e) => s + (e.total_fichiers || 0), 0);
  const actives  = data.filter(e => e.statut === "active").length;
  const archived = data.filter(e => e.statut === "archived").length;

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @keyframes spin   { to { transform:rotate(360deg) } }
      `}</style>

      {loading ? <Loader message="Chargement des explorations..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex: 1, background: theme.bg, overflowY: "auto", display: "flex", flexDirection: "column", transition: "background 0.3s" }}>
          <PageHeader icon="🔭" title="Explorations" count={filtered.length} sub="Historique des explorations GitLab de tous les utilisateurs" onRefresh={load} />

          <div style={{ padding: "24px 36px", flex: 1 }}>
            {/* MÉTRIQUES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Total explorations", value: data.length,     color: "#5b63f5" },
                { label: "Actives",             value: actives,         color: "#22c55e" },
                { label: "Archivées",           value: archived,        color: "#9ca3af" },
                { label: "Fichiers explorés",   value: totalFichiers,   color: "#60a5fa" },
                { label: "Utilisateurs actifs", value: new Set(data.map(e => e.user_id)).size, color: "#f59e0b" },
                { label: "Projets uniques",     value: new Set(data.map(e => e.projet_chemin)).size, color: "#ec4899" },
              ].map(m => (
                <div key={m.label} style={{ background: `${m.color}10`, border: `1px solid ${m.color}28`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* FILTRES */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { value: "all",      label: "Tous" },
                  { value: "active",   label: "Actives" },
                  { value: "archived", label: "Archivées" },
                ].map(f => (
                  <button key={f.value} onClick={() => setFilterStatut(f.value)} style={{
                    padding: "6px 14px",
                    border: `1px solid ${filterStatut === f.value ? "rgba(91,99,245,0.4)" : theme.cardBorder}`,
                    background: filterStatut === f.value ? "rgba(91,99,245,0.12)" : "transparent",
                    borderRadius: 8, color: filterStatut === f.value ? "#818cf8" : theme.textFaint,
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>{f.label}</button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Projet, email, branche..." />
            </div>

            {/* TABLE */}
            <DataTable>
              <thead><tr>
                <TH>ID</TH>
                <TH>Utilisateur</TH>
                <TH>Projet</TH>
                <TH>Branche</TH>
                <TH center>Fichiers</TH>
                <TH center>Statut</TH>
                <TH>Date</TH>
                <TH center>Actions</TH>
              </tr></thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? "transparent" : `${theme.cardBorder}15`, animation: "fadeIn 0.25s ease backwards", animationDelay: `${i * 0.03}s` }}>
                    <TD><span style={{ color: theme.textFaint, fontSize: 10 }}>#{e.id}</span></TD>
                    <TD><span style={{ color: "#818cf8", fontSize: 11 }}>{e.user_email}</span></TD>
                    <TD>
                      <div>
                        <b style={{ color: theme.text, fontSize: 12 }}>📁 {e.projet_nom}</b>
                        <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 2, opacity: 0.7 }}>{e.projet_chemin}</div>
                      </div>
                    </TD>
                    <TD>
                      <code style={{ background: "rgba(91,99,245,0.1)", color: "#818cf8", padding: "2px 7px", borderRadius: 6, fontSize: 10 }}>
                        {e.branche}
                      </code>
                    </TD>
                    <TD center>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#60a5fa", fontSize: 12 }}>
                        {e.total_fichiers}
                      </span>
                    </TD>
                    <TD center><StatutBadge statut={e.statut} /></TD>
                    <TD><span style={{ color: theme.textFaint, fontSize: 11 }}>{e.created_at?.split("T")[0] || "—"}</span></TD>
                    <TD center>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                        {e.statut === "active" ? (
                          <ActionBtn color="gray" onClick={() => handleStatut(e.id, "archived")}>Archiver</ActionBtn>
                        ) : (
                          <ActionBtn color="green" onClick={() => handleStatut(e.id, "active")}>Réactiver</ActionBtn>
                        )}
                        <ActionBtn color="red" onClick={() => setConfirm({ id: e.id, msg: `Supprimer l'exploration #${e.id} du projet "${e.projet_nom}" ?` })}>
                          Supprimer
                        </ActionBtn>
                      </div>
                    </TD>
                  </tr>
                ))}
                {filtered.length === 0 && <EmptyRow cols={8} message="Aucune exploration trouvée" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          msg={confirm.msg}
          onConfirm={() => handleDelete(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
