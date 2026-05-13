"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import {
  API, getHeaders, PageHeader, DataTable, TH, TD,
  EmptyRow, Loader, ErrorState, SearchInput, ActionBtn,
} from "../adminUtils";
import { useTheme } from "../ThemeContext";

interface Correction {
  id: number;
  user_id: number;
  user_email: string;
  projet_nom: string;
  fichier_path: string;
  branche: string;
  vuln_type: string;
  vuln_severite: string;
  vuln_ligne: number;
  vuln_suggestion: string | null;
  statut: string;
  created_at: string | null;
  pushed_at: string | null;
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

function DetailModal({ c, onClose }: { c: Correction; onClose: () => void }) {
  const { theme } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: "28px 32px", maxWidth: 520, width: "92%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>Correction #{c.id}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textFaint, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {[
          ["Utilisateur",    c.user_email],
          ["Projet",         c.projet_nom],
          ["Fichier",        c.fichier_path],
          ["Branche",        c.branche],
          ["Type de vuln.",  c.vuln_type],
          ["Sévérité",       c.vuln_severite],
          ["Ligne",          String(c.vuln_ligne)],
          ["Statut",         c.statut],
          ["Appliquée le",   c.created_at?.split("T")[0] || "—"],
          ["Poussée le",     c.pushed_at?.split("T")[0] || "—"],
        ].map(([label, val]) => (
          <div key={label} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", minWidth: 130 }}>{label}</span>
            <span style={{ fontSize: 12, color: theme.textMuted, wordBreak: "break-all" }}>{val}</span>
          </div>
        ))}
        {c.vuln_suggestion && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>Suggestion IA</div>
            <div style={{ background: theme.bg, border: `1px solid ${theme.cardBorder}`, borderRadius: 8, padding: 12, fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
              {c.vuln_suggestion}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SEVERITE_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  high:     { bg: "rgba(248,113,113,0.12)",  text: "#f87171" },
  medium:   { bg: "rgba(245,158,11,0.12)",   text: "#f59e0b" },
  low:      { bg: "rgba(96,165,250,0.12)",   text: "#60a5fa" },
  info:     { bg: "rgba(107,114,128,0.12)",  text: "#9ca3af" },
};

function SeveriteBadge({ sev }: { sev: string }) {
  const s = SEVERITE_COLORS[sev?.toLowerCase()] || { bg: "rgba(91,99,245,0.12)", text: "#818cf8" };
  return (
    <span style={{ background: s.bg, color: s.text, fontWeight: 700, padding: "3px 10px", borderRadius: 20, fontSize: 11, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace", border: `1px solid ${s.text}33`, textTransform: "capitalize" }}>
      {sev}
    </span>
  );
}

const STATUT_CORR: Record<string, { bg: string; text: string; label: string }> = {
  appliquee: { bg: "rgba(96,165,250,0.12)",  text: "#60a5fa", label: "Appliquée" },
  poussee:   { bg: "rgba(34,197,94,0.12)",   text: "#22c55e", label: "Poussée" },
  annulee:   { bg: "rgba(248,113,113,0.12)", text: "#f87171", label: "Annulée" },
};

function StatutCorrBadge({ statut }: { statut: string }) {
  const s = STATUT_CORR[statut] || { bg: "rgba(107,114,128,0.12)", text: "#9ca3af", label: statut };
  return (
    <span style={{ background: s.bg, color: s.text, fontWeight: 600, padding: "3px 10px", borderRadius: 20, fontSize: 11, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace", border: `1px solid ${s.text}33` }}>
      {s.label}
    </span>
  );
}

export default function AdminCorrectionsPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [data, setData]       = useState<Correction[]>([]);
  const [search, setSearch]   = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterSev, setFilterSev]       = useState("all");
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; msg: string } | null>(null);
  const [detail, setDetail]   = useState<Correction | null>(null);

  const showToast = (msg: string, ok = true) => setToast({ msg, ok });

  const load = async () => {
    setLoading(true); setError("");
    try {
      const r = await axios.get(`${API}/admin/corrections`, { headers: getHeaders() });
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? "Accès refusé." : "Erreur de chargement.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API}/admin/corrections/${id}`, { headers: getHeaders() });
      setData(prev => prev.filter(c => c.id !== id));
      showToast("Correction supprimée.");
    } catch { showToast("Erreur lors de la suppression.", false); }
    setConfirm(null);
  };

  const handleStatut = async (id: number, statut: string) => {
    try {
      await axios.patch(`${API}/admin/corrections/${id}/statut`, { statut }, { headers: getHeaders() });
      setData(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      showToast(`Statut mis à jour : ${STATUT_CORR[statut]?.label || statut}`);
    } catch { showToast("Erreur lors de la mise à jour.", false); }
  };

  const filtered = data.filter(c =>
    (filterStatut === "all" || c.statut === filterStatut) &&
    (filterSev    === "all" || c.vuln_severite?.toLowerCase() === filterSev) &&
    (
      c.projet_nom.toLowerCase().includes(search.toLowerCase()) ||
      c.user_email.toLowerCase().includes(search.toLowerCase()) ||
      c.vuln_type.toLowerCase().includes(search.toLowerCase())
    )
  );

  const poussees  = data.filter(c => c.statut === "poussee").length;
  const annulees  = data.filter(c => c.statut === "annulee").length;
  const critiques = data.filter(c => c.vuln_severite?.toLowerCase() === "critical" || c.vuln_severite?.toLowerCase() === "high").length;

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @keyframes spin   { to { transform:rotate(360deg) } }
      `}</style>

      {loading ? <Loader message="Chargement des corrections..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex: 1, background: theme.bg, overflowY: "auto", display: "flex", flexDirection: "column", transition: "background 0.3s" }}>
          <PageHeader icon="🩹" title="Corrections IA" count={filtered.length} sub="Corrections de vulnérabilités appliquées via l'explorateur" onRefresh={load} />

          <div style={{ padding: "24px 36px", flex: 1 }}>
            {/* MÉTRIQUES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Total corrections",   value: data.length,  color: "#5b63f5" },
                { label: "Appliquées",           value: data.filter(c => c.statut === "appliquee").length, color: "#60a5fa" },
                { label: "Poussées sur GitLab",  value: poussees,     color: "#22c55e" },
                { label: "Annulées",             value: annulees,     color: "#f87171" },
                { label: "Critical / High",      value: critiques,    color: "#f59e0b" },
                { label: "Projets concernés",    value: new Set(data.map(c => c.projet_nom)).size, color: "#ec4899" },
              ].map(m => (
                <div key={m.label} style={{ background: `${m.color}10`, border: `1px solid ${m.color}28`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* FILTRES */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { value: "all",      label: "Tous" },
                  { value: "appliquee", label: "Appliquées" },
                  { value: "poussee",  label: "Poussées" },
                  { value: "annulee",  label: "Annulées" },
                ].map(f => (
                  <button key={f.value} onClick={() => setFilterStatut(f.value)} style={{
                    padding: "6px 14px",
                    border: `1px solid ${filterStatut === f.value ? "rgba(91,99,245,0.4)" : theme.cardBorder}`,
                    background: filterStatut === f.value ? "rgba(91,99,245,0.12)" : "transparent",
                    borderRadius: 8, color: filterStatut === f.value ? "#818cf8" : theme.textFaint,
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>{f.label}</button>
                ))}
                <span style={{ color: theme.cardBorder, padding: "0 4px" }}>|</span>
                {[
                  { value: "all",      label: "Toute sévérité" },
                  { value: "critical", label: "Critical" },
                  { value: "high",     label: "High" },
                  { value: "medium",   label: "Medium" },
                  { value: "low",      label: "Low" },
                ].map(f => (
                  <button key={f.value} onClick={() => setFilterSev(f.value)} style={{
                    padding: "6px 14px",
                    border: `1px solid ${filterSev === f.value ? "rgba(245,158,11,0.4)" : theme.cardBorder}`,
                    background: filterSev === f.value ? "rgba(245,158,11,0.1)" : "transparent",
                    borderRadius: 8, color: filterSev === f.value ? "#f59e0b" : theme.textFaint,
                    fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  }}>{f.label}</button>
                ))}
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Projet, email, type vuln..." />
            </div>

            {/* TABLE */}
            <DataTable>
              <thead><tr>
                <TH>ID</TH>
                <TH>Utilisateur</TH>
                <TH>Projet / Fichier</TH>
                <TH>Type Vuln.</TH>
                <TH center>Sévérité</TH>
                <TH center>Ligne</TH>
                <TH center>Statut</TH>
                <TH>Date</TH>
                <TH center>Actions</TH>
              </tr></thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "transparent" : `${theme.cardBorder}15`, animation: "fadeIn 0.25s ease backwards", animationDelay: `${i * 0.03}s` }}>
                    <TD><span style={{ color: theme.textFaint, fontSize: 10 }}>#{c.id}</span></TD>
                    <TD><span style={{ color: "#818cf8", fontSize: 11 }}>{c.user_email}</span></TD>
                    <TD>
                      <div>
                        <b style={{ color: theme.text, fontSize: 12 }}>📁 {c.projet_nom}</b>
                        <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{c.fichier_path}</div>
                        <code style={{ background: "rgba(91,99,245,0.08)", color: "#818cf8", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>{c.branche}</code>
                      </div>
                    </TD>
                    <TD>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: theme.textMuted }}>
                        {c.vuln_type}
                      </span>
                    </TD>
                    <TD center><SeveriteBadge sev={c.vuln_severite} /></TD>
                    <TD center>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#f59e0b", fontWeight: 700, fontSize: 12 }}>
                        L.{c.vuln_ligne}
                      </span>
                    </TD>
                    <TD center><StatutCorrBadge statut={c.statut} /></TD>
                    <TD><span style={{ color: theme.textFaint, fontSize: 11 }}>{c.created_at?.split("T")[0] || "—"}</span></TD>
                    <TD center>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                        <ActionBtn color="blue" onClick={() => setDetail(c)}>Détails</ActionBtn>
                        {c.statut === "appliquee" && (
                          <ActionBtn color="green" onClick={() => handleStatut(c.id, "poussee")}>Marquer poussée</ActionBtn>
                        )}
                        {c.statut !== "annulee" && (
                          <ActionBtn color="gray" onClick={() => handleStatut(c.id, "annulee")}>Annuler</ActionBtn>
                        )}
                        <ActionBtn color="red" onClick={() => setConfirm({ id: c.id, msg: `Supprimer la correction #${c.id} du projet "${c.projet_nom}" ?` })}>
                          Supprimer
                        </ActionBtn>
                      </div>
                    </TD>
                  </tr>
                ))}
                {filtered.length === 0 && <EmptyRow cols={9} message="Aucune correction trouvée" />}
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
      {detail && <DetailModal c={detail} onClose={() => setDetail(null)} />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
