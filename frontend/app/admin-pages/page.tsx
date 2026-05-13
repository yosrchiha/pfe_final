"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "./AdminLayout";
import { API, getHeaders, StatCard, DataTable, TH, TD, ScorePill, StatusBadge, EmptyRow, Loader, ErrorState } from "./adminUtils";
import type { Stats, Analyse, UserItem } from "./adminUtils";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats>({ total_users: 0, active_users: 0, total_depots: 0, admin_count: 0, total_analyses: 0, analyses_ok: 0, total_mr: 0, total_diffs: 0 });
  const [recentAnalyses, setRecentAnalyses] = useState<Analyse[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserItem[]>([]);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: getHeaders() }),
        axios.get(`${API}/admin/users`, { headers: getHeaders() }),
      ]);
      setStats(statsRes.data);
      setRecentUsers(usersRes.data.slice(-5).reverse());
    } catch (e: any) {
      setError(e?.response?.status === 403 ? "Accès refusé — admin requis." : "Erreur de chargement.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout>
      {loading ? <Loader message="Chargement du dashboard..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex: 1, background: "#07090f", overflowY: "auto" }}>

          {/* TOP BAR */}
          <div style={{ padding: "28px 36px 24px", borderBottom: "1px solid #1e2235", background: "#0a0c14" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, color: "#5b63f5", fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 6 }}>
                  ● ADMINISTRATEUR
                </p>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f3fc", letterSpacing: "-0.03em" }}>
                  Tableau de bord
                </h1>
                <p style={{ fontSize: 12, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>
                  Supervision complète de la plateforme AuditIA
                </p>
              </div>
              <button onClick={load} style={{
                padding: "10px 20px", background: "rgba(91,99,245,0.1)", border: "1px solid rgba(91,99,245,0.25)",
                borderRadius: 10, color: "#818cf8", fontSize: 12, fontFamily: "'JetBrains Mono',monospace",
                fontWeight: 600, cursor: "pointer",
              }}>↻ Actualiser</button>
            </div>
          </div>

          <div style={{ padding: "28px 36px" }}>

            {/* STAT GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 32 }}>
              <StatCard icon="◈" value={stats.total_users}   label="Utilisateurs"   sub={`${stats.active_users} actifs`}       accent="#5b63f5" />
              <StatCard icon="▣" value={stats.total_depots}  label="Dépôts GitLab"  sub="tous projets"                         accent="#0ea5e9" />
              <StatCard icon="◉" value={stats.total_analyses}label="Analyses IA"    sub="branche complète"                     accent="#22c55e" />
              <StatCard icon="⇄" value={stats.total_diffs}   label="Analyses Diff"  sub="comparaisons"                         accent="#ec4899" />
              <StatCard icon="⊕" value={stats.total_mr}      label="Merge Requests" sub="créées par l'IA"                      accent="#f59e0b" />
              <StatCard icon="◎" value={stats.analyses_ok}   label="Tests générés"  sub="par le LLM"                           accent="#8b5cf6" />
              <StatCard icon="👑" value={stats.admin_count}  label="Administrateurs" sub="accès complet"                       accent="#ef4444" />
              <StatCard icon="✓"  value={stats.total_analyses ? `${Math.round(stats.analyses_ok / stats.total_analyses * 100)}%` : "—"}
                                  label="Taux réussite"    sub="analyses terminées"                       accent="#14b8a6" />
            </div>

            {/* QUICK ACTIONS */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 11, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14 }}>
                Actions rapides
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                {[
                  { href: "/admin/users",       icon: "◈", label: "Gérer utilisateurs", desc: "Activer, désactiver, rôles" },
                  { href: "/admin/depots",       icon: "▣", label: "Voir les dépôts",    desc: "Tous les projets GitLab" },
                  { href: "/admin/new-analyse",  icon: "▶", label: "Lancer analyse",     desc: "Analyse IA complète" },
                  { href: "/admin/new-diff",     icon: "⇌", label: "Comparer branches",  desc: "Analyse diff IA" },
                  { href: "/admin/explorer",     icon: "⊞", label: "Explorer le code",   desc: "Parcourir les fichiers" },
                  { href: "/admin/stats",        icon: "◈", label: "Statistiques",       desc: "Métriques globales" },
                ].map(a => (
                  <a key={a.href} href={a.href} style={{
                    display: "block", padding: "16px 18px", background: "#0a0c14",
                    border: "1px solid #1e2235", borderRadius: 12, textDecoration: "none",
                    transition: "border-color 0.18s, background 0.18s", cursor: "pointer",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(91,99,245,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(91,99,245,0.06)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2235"; (e.currentTarget as HTMLElement).style.background = "#0a0c14"; }}
                  >
                    <span style={{ fontSize: 20, display: "block", marginBottom: 10 }}>{a.icon}</span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f3fc" }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: "#5a6080", fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{a.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* RECENT USERS */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f3fc" }}>Derniers utilisateurs</p>
                <a href="/admin/users" style={{ fontSize: 11, color: "#5b63f5", fontFamily: "'JetBrains Mono',monospace", textDecoration: "none" }}>Voir tout →</a>
              </div>
              <DataTable>
                <thead><tr>
                  <TH>Email</TH><TH>Username</TH><TH>Rôle</TH><TH>Statut</TH><TH>Dépôts</TH>
                </tr></thead>
                <tbody>
                  {recentUsers.map(u => (
                    <tr key={u.id}>
                      <TD><b style={{ color: "#f1f3fc" }}>{u.email}</b></TD>
                      <TD><code style={{ color: "#818cf8" }}>@{u.username}</code></TD>
                      <TD center>
                        <span style={{ background: u.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(96,165,250,0.12)", color: u.role === "admin" ? "#f59e0b" : "#60a5fa", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                          {u.role === "admin" ? "admin" : "user"}
                        </span>
                      </TD>
                      <TD center>
                        <span style={{ color: u.is_active ? "#22c55e" : "#f87171", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                          {u.is_active ? "● actif" : "○ inactif"}
                        </span>
                      </TD>
                      <TD center><b style={{ color: "#5b63f5" }}>{u.depot_count}</b></TD>
                    </tr>
                  ))}
                  {recentUsers.length === 0 && <EmptyRow cols={5} message="Aucun utilisateur" />}
                </tbody>
              </DataTable>
            </div>

          </div>
        </div>
      )}
    </AdminLayout>
  );
}

