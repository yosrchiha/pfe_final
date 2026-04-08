"use client";

import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

// ── TYPES ──────────────────────────────────────────────────────────
interface Stats {
  total_users: number; active_users: number; total_depots: number;
  admin_count: number; total_analyses: number; analyses_ok: number;
  total_mr: number; total_diffs: number;
}
interface UserItem {
  id: number; email: string; username: string; role: string;
  is_active: boolean; created_at: string; depot_count: number;
}
interface DepotItem {
  id: number; nom: string; project_url: string; branche: string;
  user_id: number; user_email: string; created_at: string;
  analyses_count: number; is_active: boolean;
}
interface Analyse {
  id: number; depot_id: number; depot_nom: string; user_email: string;
  branche: string; score_qualite: number; score_securite: number;
  score_performance: number; statut: string; created_at: string;
  nb_vulns: number; vulnerabilites?: any[];
}
interface MR {
  id: number; projet_nom: string; user_email: string; titre: string;
  statut: string; type_mr: string; branche_source: string;
  branche_cible: string; created_at: string; mr_url?: string;
}
interface AnalyseDiff {
  id: number; projet_nom: string; user_email: string;
  from_branch: string; to_branch: string;
  score_qualite: number; score_securite: number;
  resultat_statut: string; created_at: string;
}
interface TestGenere {
  id: number; projet_nom: string; user_email: string;
  langage: string; framework: string; nb_tests: number;
  statut: string; created_at: string;
}

// ── HELPERS ────────────────────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 80 ? "#16a34a" : s >= 60 ? "#d97706" : "#dc2626";
}
function scoreBg(s: number) {
  return s >= 80 ? "#f0fdf4" : s >= 60 ? "#fffbeb" : "#fef2f2";
}

function ScorePill({ score }: { score: number }) {
  return (
    <span style={{ background: scoreBg(score), color: scoreColor(score), fontWeight: 700, padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>
      {score}/100
    </span>
  );
}

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  termine:          { bg: "#f0fdf4", color: "#16a34a", label: "Terminé" },
  en_cours:         { bg: "#eff6ff", color: "#2563eb", label: "En cours" },
  erreur:           { bg: "#fef2f2", color: "#dc2626", label: "Erreur" },
  opened:           { bg: "#eff6ff", color: "#2563eb", label: "Ouverte" },
  merged:           { bg: "#f0fdf4", color: "#16a34a", label: "Fusionnée" },
  closed:           { bg: "#f3f4f6", color: "#6b7280", label: "Fermée" },
  merge_autorise:   { bg: "#f0fdf4", color: "#16a34a", label: "Autorisé" },
  merge_bloque:     { bg: "#fef2f2", color: "#dc2626", label: "Bloqué" },
  merge_autorise_force: { bg: "#fef3c7", color: "#d97706", label: "Auto forcé" },
  pousse:           { bg: "#f0fdf4", color: "#16a34a", label: "Poussé" },
  genere:           { bg: "#eff6ff", color: "#2563eb", label: "Généré" },
  aucun_changement: { bg: "#f3f4f6", color: "#6b7280", label: "Aucun changement" },
  inconnu:          { bg: "#f3f4f6", color: "#6b7280", label: "Inconnu" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { bg: "#f3f4f6", color: "#6b7280", label: status };
  return (
    <span style={{ background: s.bg, color: s.color, fontWeight: 600, padding: "3px 10px", borderRadius: 20, fontSize: 12, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function StatCard({ icon, value, label, sub, color }: { icon: string; value: number | string; label: string; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: color + "1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "11px 14px", background: "#f8fafc", color: "#64748b", fontWeight: 700, textAlign: "left", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}
    </th>
  );
}
function TD({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <td style={{ padding: "11px 14px", color: "#1e293b", borderBottom: "1px solid #f1f5f9", textAlign: center ? "center" : "left", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: "center", padding: "32px", color: "#94a3b8", fontSize: 13 }}>
        {message}
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════════
export default function AdminPage() {
  type Tab = "overview" | "users" | "depots" | "analyses" | "diffs" | "tests" | "mrs" | "stats";
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<Stats>({ total_users: 0, active_users: 0, total_depots: 0, admin_count: 0, total_analyses: 0, analyses_ok: 0, total_mr: 0, total_diffs: 0 });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [depots, setDepots] = useState<DepotItem[]>([]);
  const [analyses, setAnalyses] = useState<Analyse[]>([]);
  const [diffs, setDiffs] = useState<AnalyseDiff[]>([]);
  const [tests, setTests] = useState<TestGenere[]>([]);
  const [mrs, setMrs] = useState<MR[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDepot, setSelectedDepot] = useState<DepotItem | null>(null);
  const [depotAnalyses, setDepotAnalyses] = useState<Analyse[]>([]);
  const [showDepotModal, setShowDepotModal] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  // ── Chargement centralisé ──────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Stats
      const statsRes = await axios.get(`${API}/admin/stats`, { headers: getHeaders() });
      setStats(statsRes.data);

      // 2. Utilisateurs
      const usersRes = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      setUsers(usersRes.data);

      // 3. Tous les dépôts d'analyse simple
      const allDepots: DepotItem[] = [];
      for (const user of usersRes.data) {
        try {
          const depotsRes = await axios.get(`${API}/analyses/depots-user/${user.id}`, { headers: getHeaders() });
          for (const depot of depotsRes.data) {
            // Compter les analyses du dépôt
            let analysesCount = 0;
            try {
              const aRes = await axios.get(`${API}/analyses/depot/${depot.id}`, { headers: getHeaders() });
              analysesCount = aRes.data.length;
            } catch {}
            allDepots.push({
              id: depot.id,
              nom: depot.nom,
              project_url: depot.project_url,
              branche: depot.branche,
              user_id: user.id,
              user_email: user.email,
              created_at: depot.created_at?.split("T")[0] || "",
              analyses_count: analysesCount,
              is_active: true,
            });
          }
        } catch {}
      }
      setDepots(allDepots);

      // 4. Toutes les analyses (route admin)
      const allAnalyses: Analyse[] = [];
      for (const depot of allDepots) {
        try {
          const aRes = await axios.get(`${API}/analyses/depot/${depot.id}`, { headers: getHeaders() });
          for (const a of aRes.data) {
            allAnalyses.push({
              id: a.id,
              depot_id: depot.id,
              depot_nom: depot.nom,
              user_email: depot.user_email,
              branche: a.branche || "—",
              score_qualite: a.score_qualite || 0,
              score_securite: a.score_securite || 0,
              score_performance: a.score_performance || 0,
              statut: a.statut,
              created_at: a.created_at?.split("T")[0] || "",
              nb_vulns: a.vulnerabilites?.length || 0,
              vulnerabilites: a.vulnerabilites,
            });
          }
        } catch {}
      }
      setAnalyses(allAnalyses);

      // 5. Analyses Diff - avec correction des données
      const allDiffs: AnalyseDiff[] = [];
      for (const user of usersRes.data) {
        try {
          const depotsDiffRes = await axios.get(`${API}/depots/user/${user.id}`, { headers: getHeaders() });
          for (const depot of depotsDiffRes.data) {
            try {
              const compRes = await axios.get(`${API}/comparaisons/depot/${depot.id}`, { headers: getHeaders() });
              for (const comp of compRes.data) {
                try {
                  const aRes = await axios.get(`${API}/comparaisons/${comp.id}/analyses`, { headers: getHeaders() });
                  for (const a of aRes.data) {
                    allDiffs.push({
                      id: a.id,
                      projet_nom: depot.nom,
                      user_email: user.email,
                      from_branch: comp.from_branch,
                      to_branch: comp.to_branch,
                      score_qualite: a.score_qualite || 0,
                      score_securite: a.score_securite || 0,
                      resultat_statut: a.resultat_statut || a.statut,
                      created_at: a.created_at || "",
                    });
                  }
                } catch {}
              }
            } catch {}
          }
        } catch {}
      }
      setDiffs(allDiffs);

      // 6. Merge Requests
      const allMR: MR[] = [];
      for (const depot of allDepots) {
        try {
          const mrRes = await axios.get(`${API}/merge-requests/depot/${depot.id}`, { headers: getHeaders() });
          for (const m of mrRes.data) {
            allMR.push({
              id: m.id,
              projet_nom: depot.nom,
              user_email: depot.user_email,
              titre: m.titre || "—",
              statut: m.statut,
              type_mr: m.type_mr,
              branche_source: m.branche_source,
              branche_cible: m.branche_cible,
              created_at: m.created_at?.split("T")[0] || "",
              mr_url: m.mr_url,
            });
          }
        } catch {}
      }
      setMrs(allMR);

      // 7. Tests générés
      const allTests: TestGenere[] = [];
      for (const depot of allDepots) {
        try {
          const tRes = await axios.get(`${API}/tests/depot/${depot.id}`, { headers: getHeaders() });
          for (const t of tRes.data) {
            allTests.push({
              id: t.id,
              projet_nom: depot.nom,
              user_email: depot.user_email,
              langage: t.langage || "—",
              framework: t.framework || "—",
              nb_tests: t.nb_tests || 0,
              statut: t.statut,
              created_at: t.created_at?.split("T")[0] || "",
            });
          }
        } catch {}
      }
      setTests(allTests);

    } catch (err: any) {
      console.error("Erreur chargement admin:", err);
      if (err?.response?.status === 403) {
        setError("Accès refusé — vous devez être administrateur.");
      } else {
        setError("Erreur de chargement des données.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Actions utilisateur ────────────────────────────────────────
  async function toggleUser(id: number, active: boolean) {
    try {
      await axios.patch(`${API}/admin/users/${id}/active`, { is_active: !active }, { headers: getHeaders() });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !active } : u));
    } catch (_) {}
  }

  async function changeRole(id: number, role: string) {
    const nr = role === "admin" ? "user" : "admin";
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role: nr }, { headers: getHeaders() });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: nr } : u));
    } catch (_) {}
  }

  async function deleteUser(id: number) {
    if (!confirm("Supprimer cet utilisateur et tous ses dépôts ?")) return;
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: getHeaders() });
      setUsers(prev => prev.filter(u => u.id !== id));
      loadData(); // Recharger les données
    } catch (_) {}
  }

  // ── Actions dépôts ────────────────────────────────────────────
  async function deleteDepot(depotId: number) {
    if (!confirm("Supprimer ce dépôt et toutes ses analyses ?")) return;
    try {
      await axios.delete(`${API}/admin/depots/${depotId}`, { headers: getHeaders() });
      setDepots(prev => prev.filter(d => d.id !== depotId));
      loadData();
    } catch (_) {}
  }

  async function viewDepotAnalyses(depot: DepotItem) {
    setSelectedDepot(depot);
    const analysesDepot = analyses.filter(a => a.depot_id === depot.id);
    setDepotAnalyses(analysesDepot);
    setShowDepotModal(true);
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredDepots = depots.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    d.user_email.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: "overview" as Tab, icon: "🏠", label: "Vue d'ensemble" },
    { id: "users"    as Tab, icon: "👥", label: `Utilisateurs (${users.length})` },
    { id: "depots"   as Tab, icon: "📁", label: `Dépôts (${depots.length})` },
    { id: "analyses" as Tab, icon: "🔍", label: `Analyses (${analyses.length})` },
    { id: "diffs"    as Tab, icon: "⚡", label: `Analyse Diff (${diffs.length})` },
    { id: "tests"    as Tab, icon: "🧪", label: `Tests (${tests.length})` },
    { id: "mrs"      as Tab, icon: "🔀", label: `Merge Requests (${mrs.length})` },
    { id: "stats"    as Tab, icon: "📊", label: "Statistiques" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 44, height: 44, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#64748b", fontSize: 14 }}>Chargement du panneau admin...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 36, textAlign: "center", border: "1px solid #fee2e2" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
          <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{error}</p>
          <button onClick={loadData} style={{ padding: "9px 20px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🛡️</div>
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 800 }}>Panneau Administration</h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>AuditPlatform · PFE 2025 · Neopolis</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={loadData} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 28px", display: "flex", gap: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "13px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#6366f1" : "#64748b", borderBottom: `3px solid ${tab === t.id ? "#6366f1" : "transparent"}`, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "28px", maxWidth: 1400, margin: "0 auto" }}>

        {/* VUE D'ENSEMBLE */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 28 }}>
              <StatCard icon="👥" value={stats.total_users}   label="Utilisateurs"    sub={`${stats.active_users} actifs`}     color="#6366f1" />
              <StatCard icon="🗂️" value={stats.total_depots}  label="Dépôts GitLab"  sub="tous utilisateurs"                  color="#0ea5e9" />
              <StatCard icon="🔍" value={analyses.length}     label="Analyses IA"     sub="branche complète"                   color="#22c55e" />
              <StatCard icon="⚡" value={diffs.length}        label="Analyses Diff"   sub="comparaison branches"               color="#ec4899" />
              <StatCard icon="🔀" value={mrs.length}          label="Merge Requests"  sub="créées par l'IA"                    color="#f59e0b" />
              <StatCard icon="🧪" value={tests.length}        label="Tests générés"   sub="par le LLM"                         color="#8b5cf6" />
              <StatCard icon="👑" value={stats.admin_count}   label="Admins"          sub="accès complet"                      color="#ef4444" />
              <StatCard icon="✅" value={`${analyses.length ? Math.round(analyses.filter(a => a.statut === "termine").length / analyses.length * 100) : 0}%`} label="Taux succès" sub="analyses terminées" color="#14b8a6" />
            </div>

            <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 12 }}>Dernières analyses IA</p>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>Dépôt</TH><TH>Utilisateur</TH><TH>Qualité</TH><TH>Sécurité</TH><TH>Perf.</TH><TH>Vulns</TH><TH>Statut</TH><TH>Date</TH></tr></thead>
                  <tbody>
                    {analyses.slice(0, 10).map((a, i) => (
                      <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><b>📁 {a.depot_nom}</b></TD>
                        <TD><span style={{ color: "#6366f1", fontSize: 12 }}>{a.user_email}</span></TD>
                        <TD center><ScorePill score={a.score_qualite} /></TD>
                        <TD center><ScorePill score={a.score_securite} /></TD>
                        <TD center><ScorePill score={a.score_performance} /></TD>
                        <TD center><span style={{ background: a.nb_vulns > 5 ? "#fef2f2" : a.nb_vulns > 0 ? "#fffbeb" : "#f0fdf4", color: a.nb_vulns > 5 ? "#dc2626" : a.nb_vulns > 0 ? "#d97706" : "#16a34a", fontWeight: 700, padding: "2px 10px", borderRadius: 20, fontSize: 12 }}>{a.nb_vulns} vulns</span></TD>
                        <TD center><StatusBadge status={a.statut} /></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{a.created_at}</span></TD>
                      </tr>
                    ))}
                    {analyses.length === 0 && <EmptyRow cols={8} message="Aucune analyse disponible" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* UTILISATEURS */}
        {tab === "users" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: "#0f172a" }}>👥 Utilisateurs ({filteredUsers.length})</p>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher email ou username..."
                style={{ padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, width: 260, outline: "none" }} />
            </div>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>ID</TH><TH>Email</TH><TH>Username</TH><TH>Rôle</TH><TH>Statut</TH><TH>Dépôts</TH><TH>Créé le</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><span style={{ color: "#94a3b8", fontSize: 11 }}>#{u.id}</span></TD>
                        <TD><b>{u.email}</b></TD>
                        <TD><code style={{ background: "#f1f5f9", padding: "2px 7px", borderRadius: 6, fontSize: 12 }}>@{u.username}</code></TD>
                        <TD center><span style={{ background: u.role === "admin" ? "#fef3c7" : "#eff6ff", color: u.role === "admin" ? "#d97706" : "#2563eb", fontWeight: 700, padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>{u.role === "admin" ? "👑 Admin" : "👤 User"}</span></TD>
                        <TD center><span style={{ background: u.is_active ? "#f0fdf4" : "#fef2f2", color: u.is_active ? "#16a34a" : "#dc2626", fontWeight: 600, padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>{u.is_active ? "✅ Actif" : "❌ Inactif"}</span></TD>
                        <TD center><b style={{ color: "#6366f1" }}>{u.depot_count}</b></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{u.created_at?.split("T")[0]}</span></TD>
                        <TD>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            <button onClick={() => toggleUser(u.id, u.is_active)} style={{ padding: "4px 10px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600, background: u.is_active ? "#fef2f2" : "#f0fdf4", color: u.is_active ? "#dc2626" : "#16a34a" }}>{u.is_active ? "Désactiver" : "Activer"}</button>
                            <button onClick={() => changeRole(u.id, u.role)} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600, background: "#fff", color: "#475569" }}>{u.role === "admin" ? "→ User" : "→ Admin"}</button>
                            <button onClick={() => deleteUser(u.id)} style={{ padding: "4px 10px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#dc2626" }}>Supprimer</button>
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && <EmptyRow cols={8} message="Aucun utilisateur trouvé" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DÉPÔTS (NOUVEAU) */}
        {tab === "depots" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: "#0f172a" }}>📁 Dépôts d'analyse ({filteredDepots.length})</p>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dépôt ou utilisateur..."
                style={{ padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, width: 260, outline: "none" }} />
            </div>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>ID</TH><TH>Nom</TH><TH>URL</TH><TH>Branche</TH><TH>Utilisateur</TH><TH>Analyses</TH><TH>Date</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {filteredDepots.map((d, i) => (
                      <tr key={d.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><span style={{ color: "#94a3b8", fontSize: 11 }}>#{d.id}</span></TD>
                        <TD><b>{d.nom}</b></TD>
                        <TD><code style={{ fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{d.project_url}</code></TD>
                        <TD><code style={{ background: "#f1f5f9", padding: "2px 7px", borderRadius: 6, fontSize: 11 }}>{d.branche}</code></TD>
                        <TD><span style={{ color: "#6366f1", fontSize: 12 }}>{d.user_email}</span></TD>
                        <TD center><b style={{ color: "#6366f1" }}>{d.analyses_count}</b></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{d.created_at}</span></TD>
                        <TD>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={() => viewDepotAnalyses(d)} style={{ padding: "4px 10px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600, background: "#eff6ff", color: "#2563eb" }}>📊 Voir analyses</button>
                            <button onClick={() => deleteDepot(d.id)} style={{ padding: "4px 10px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#dc2626" }}>🗑 Supprimer</button>
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {filteredDepots.length === 0 && <EmptyRow cols={8} message="Aucun dépôt trouvé" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ANALYSES IA */}
        {tab === "analyses" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 16 }}>🔍 Toutes les Analyses IA ({analyses.length})</p>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>ID</TH><TH>Dépôt</TH><TH>Utilisateur</TH><TH>Branche</TH><TH>Qualité</TH><TH>Sécurité</TH><TH>Perf.</TH><TH>Vulns</TH><TH>Statut</TH><TH>Date</TH></tr></thead>
                  <tbody>
                    {analyses.map((a, i) => (
                      <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><span style={{ color: "#94a3b8", fontSize: 11 }}>#{a.id}</span></TD>
                        <TD><b>📁 {a.depot_nom}</b></TD>
                        <TD><span style={{ color: "#6366f1", fontSize: 12 }}>{a.user_email}</span></TD>
                        <TD><code style={{ background: "#f1f5f9", padding: "2px 7px", borderRadius: 6, fontSize: 11 }}>{a.branche}</code></TD>
                        <TD center><ScorePill score={a.score_qualite} /></TD>
                        <TD center><ScorePill score={a.score_securite} /></TD>
                        <TD center><ScorePill score={a.score_performance} /></TD>
                        <TD center><span style={{ background: a.nb_vulns > 5 ? "#fef2f2" : a.nb_vulns > 0 ? "#fffbeb" : "#f0fdf4", color: a.nb_vulns > 5 ? "#dc2626" : a.nb_vulns > 0 ? "#d97706" : "#16a34a", fontWeight: 700, padding: "2px 8px", borderRadius: 20, fontSize: 12 }}>{a.nb_vulns}</span></TD>
                        <TD center><StatusBadge status={a.statut} /></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{a.created_at}</span></TD>
                      </tr>
                    ))}
                    {analyses.length === 0 && <EmptyRow cols={10} message="Aucune analyse disponible" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ANALYSES DIFF */}
        {tab === "diffs" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 16 }}>⚡ Analyses de Diff entre Branches ({diffs.length})</p>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>ID</TH><TH>Projet</TH><TH>Utilisateur</TH><TH>Branche source</TH><TH>Branche cible</TH><TH>Qualité</TH><TH>Sécurité</TH><TH>Décision IA</TH><TH>Date</TH></tr></thead>
                  <tbody>
                    {diffs.map((d, i) => (
                      <tr key={d.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><span style={{ color: "#94a3b8", fontSize: 11 }}>#{d.id}</span></TD>
                        <TD><b>📁 {d.projet_nom || "Projet inconnu"}</b></TD>
                        <TD><span style={{ color: "#6366f1", fontSize: 12 }}>{d.user_email || "Inconnu"}</span></TD>
                        <TD><code style={{ background: "#fef3c7", padding: "2px 7px", borderRadius: 6, fontSize: 11, color: "#92400e" }}>{d.from_branch || "—"}</code></TD>
                        <TD><code style={{ background: "#dbeafe", padding: "2px 7px", borderRadius: 6, fontSize: 11, color: "#1e40af" }}>{d.to_branch || "—"}</code></TD>
                        <TD center><ScorePill score={d.score_qualite} /></TD>
                        <TD center><ScorePill score={d.score_securite} /></TD>
                        <TD center><StatusBadge status={d.resultat_statut} /></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{d.created_at?.split(" ")[0] || d.created_at?.split("T")[0] || ""}</span></TD>
                      </tr>
                    ))}
                    {diffs.length === 0 && <EmptyRow cols={9} message="Aucune analyse de diff disponible" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TESTS GÉNÈRES */}
        {tab === "tests" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 16 }}>🧪 Tests Unitaires Générés ({tests.length})</p>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>ID</TH><TH>Projet</TH><TH>Utilisateur</TH><TH>Langage</TH><TH>Framework</TH><TH>Nb tests</TH><TH>Statut</TH><TH>Date</TH></tr></thead>
                  <tbody>
                    {tests.map((t, i) => (
                      <tr key={t.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><span style={{ color: "#94a3b8", fontSize: 11 }}>#{t.id}</span></TD>
                        <TD><b>📁 {t.projet_nom}</b></TD>
                        <TD><span style={{ color: "#6366f1", fontSize: 12 }}>{t.user_email}</span></TD>
                        <TD><span style={{ background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{t.langage}</span></TD>
                        <TD><code style={{ background: "#f1f5f9", padding: "2px 7px", borderRadius: 6, fontSize: 12 }}>{t.framework}</code></TD>
                        <TD center><b style={{ color: "#8b5cf6", fontSize: 15 }}>{t.nb_tests}</b></TD>
                        <TD center><StatusBadge status={t.statut} /></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{t.created_at}</span></TD>
                      </tr>
                    ))}
                    {tests.length === 0 && <EmptyRow cols={8} message="Aucun test généré disponible" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MERGE REQUESTS */}
        {tab === "mrs" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 16 }}>🔀 Merge Requests ({mrs.length})</p>
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><TH>ID</TH><TH>Projet</TH><TH>Utilisateur</TH><TH>Titre</TH><TH>Type</TH><TH>Source</TH><TH>Cible</TH><TH>Statut</TH><TH>Date</TH></tr></thead>
                  <tbody>
                    {mrs.map((m, i) => (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <TD><span style={{ color: "#94a3b8", fontSize: 11 }}>#{m.id}</span></TD>
                        <TD><b>📁 {m.projet_nom}</b></TD>
                        <TD><span style={{ color: "#6366f1", fontSize: 12 }}>{m.user_email}</span></TD>
                        <TD>{m.mr_url ? <a href={m.mr_url} target="_blank" rel="noreferrer" style={{ color: "#6366f1", textDecoration: "none" }}>{m.titre}</a> : <span>{m.titre}</span>}</TD>
                        <TD center><span style={{ background: m.type_mr === "auto_merge" ? "#dbeafe" : m.type_mr === "tests" ? "#f3e8ff" : "#fef3c7", color: m.type_mr === "auto_merge" ? "#1e40af" : m.type_mr === "tests" ? "#6b21a8" : "#92400e", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{m.type_mr === "auto_merge" ? "🤖 Auto" : m.type_mr === "tests" ? "🧪 Tests" : "⚡ Diff"}</span></TD>
                        <TD><code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 5, fontSize: 11, color: "#92400e" }}>{m.branche_source?.slice(0, 20)}</code></TD>
                        <TD><code style={{ background: "#dbeafe", padding: "2px 6px", borderRadius: 5, fontSize: 11, color: "#1e40af" }}>{m.branche_cible}</code></TD>
                        <TD center><StatusBadge status={m.statut} /></TD>
                        <TD><span style={{ color: "#94a3b8", fontSize: 12 }}>{m.created_at}</span></TD>
                      </tr>
                    ))}
                    {mrs.length === 0 && <EmptyRow cols={9} message="Aucune Merge Request disponible" />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STATISTIQUES */}
        {tab === "stats" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 20 }}>📊 Statistiques globales</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
              {/* Décisions diff */}
              <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>⚡ Décisions Analyse Diff IA</p>
                {[
                  { label: "Merge autorisé",   value: diffs.filter(d => d.resultat_statut === "merge_autorise").length, color: "#16a34a", bg: "#f0fdf4" },
                  { label: "Merge bloqué",     value: diffs.filter(d => d.resultat_statut === "merge_bloque").length,   color: "#dc2626", bg: "#fef2f2" },
                  { label: "Auto forcé",       value: diffs.filter(d => d.resultat_statut === "merge_autorise_force").length, color: "#d97706", bg: "#fef3c7" },
                  { label: "Aucun changement", value: diffs.filter(d => d.resultat_statut === "aucun_changement").length, color: "#6b7280", bg: "#f3f4f6" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: item.bg, borderRadius: 9, marginBottom: 6 }}>
                    <span style={{ color: item.color, fontWeight: 600, fontSize: 13 }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 800, fontSize: 20 }}>{item.value}</span>
                  </div>
                ))}
                {diffs.length === 0 && <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", marginTop: 8 }}>Aucune analyse diff effectuée</p>}
              </div>

              {/* KPIs */}
              <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>🏆 Indicateurs clés</p>
                {[
                  { label: "Taux analyses réussies",    value: analyses.length ? `${Math.round(analyses.filter(a => a.statut === "termine").length / analyses.length * 100)}%` : "—", color: "#22c55e" },
                  { label: "Score qualité moyen",       value: analyses.length ? `${Math.round(analyses.reduce((s, a) => s + a.score_qualite, 0) / analyses.length)}/100` : "—", color: "#6366f1" },
                  { label: "Score sécurité moyen",      value: analyses.length ? `${Math.round(analyses.reduce((s, a) => s + a.score_securite, 0) / analyses.length)}/100` : "—", color: "#0ea5e9" },
                  { label: "Taux merge autorisé",       value: diffs.length ? `${Math.round(diffs.filter(d => d.resultat_statut === "merge_autorise" || d.resultat_statut === "merge_autorise_force").length / diffs.length * 100)}%` : "—", color: "#f59e0b" },
                  { label: "Tests générés total",       value: tests.reduce((s, t) => s + t.nb_tests, 0).toString(), color: "#8b5cf6" },
                  { label: "Dépôts par utilisateur",    value: stats.total_users ? `${(stats.total_depots / stats.total_users).toFixed(1)} moy.` : "—", color: "#ec4899" },
                ].map((kpi, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < 5 ? "1px solid #f1f5f9" : "none" }}>
                    <span style={{ fontSize: 12, color: "#475569" }}>{kpi.label}</span>
                    <b style={{ color: kpi.color, fontSize: 14 }}>{kpi.value}</b>
                  </div>
                ))}
              </div>

              {/* Répartition utilisateurs */}
              <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>👥 Répartition utilisateurs</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: "Admins", value: users.filter(u => u.role === "admin").length, color: "#f59e0b", icon: "👑" },
                    { label: "Users",  value: users.filter(u => u.role === "user").length,  color: "#6366f1", icon: "👤" },
                    { label: "Actifs", value: users.filter(u => u.is_active).length,        color: "#22c55e", icon: "✅" },
                  ].map((item, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", padding: "14px 6px", background: `${item.color}15`, borderRadius: 10, border: `2px solid ${item.color}33` }}>
                      <div style={{ fontSize: 22 }}>{item.icon}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DÉTAIL ANALYSES D'UN DÉPÔT */}
      {showDepotModal && selectedDepot && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, maxWidth: 900, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 35px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: 20, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedDepot.nom}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{selectedDepot.user_email} · {selectedDepot.branche}</p>
              </div>
              <button onClick={() => setShowDepotModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontWeight: 600, marginBottom: 16 }}>📊 Analyses du dépôt ({depotAnalyses.length})</p>
              {depotAnalyses.length === 0 ? (
                <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Aucune analyse pour ce dépôt</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>ID</th>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>Date</th>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>Qualité</th>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>Sécurité</th>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>Performance</th>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>Vulns</th>
                      <th style={{ textAlign: "left", padding: 10, background: "#f8fafc", fontSize: 11 }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depotAnalyses.map(a => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 10, fontSize: 12 }}>#{a.id}</td>
                        <td style={{ padding: 10, fontSize: 12 }}>{a.created_at}</td>
                        <td style={{ padding: 10, fontSize: 12 }}><ScorePill score={a.score_qualite} /></td>
                        <td style={{ padding: 10, fontSize: 12 }}><ScorePill score={a.score_securite} /></td>
                        <td style={{ padding: 10, fontSize: 12 }}><ScorePill score={a.score_performance} /></td>
                        <td style={{ padding: 10, fontSize: 12, textAlign: "center" }}>{a.nb_vulns}</td>
                        <td style={{ padding: 10, fontSize: 12 }}><StatusBadge status={a.statut} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => deleteDepot(selectedDepot.id)} style={{ padding: "8px 16px", background: "#fef2f2", border: "none", borderRadius: 8, color: "#dc2626", fontWeight: 600, cursor: "pointer" }}>🗑 Supprimer ce dépôt</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}