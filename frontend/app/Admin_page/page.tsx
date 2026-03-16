"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  DoughnutController,
  BarController,
} from "chart.js";
import styles from "./admin.module.css";

Chart.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  DoughnutController, BarController
);

const API = "http://127.0.0.1:8000";

const COLORS = {
  accent:  "#5b63f5",
  accent2: "#818cf8",
  green:   "#22c55e",
  orange:  "#f97316",
  red:     "#f87171",
  purple:  "#a855f7",
  teal:    "#2dd4bf",
};

interface Stats { total_users: number; active_users: number; total_depots: number; admin_count: number; }
interface User  { id: number; email: string; username: string | null; role: string; is_active: boolean; created_at: string | null; depot_count: number; }
interface Depot { id: number; nom: string; url_branche_principale: string | null; proprietaire_id: number; owner_email: string | null; created_at: string | null; }

// ── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, labels, colors, total, centerLabel }: {
  data: number[]; labels: string[]; colors: string[]; total: number; centerLabel: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors.map(c => c + "bb"), borderColor: colors, borderWidth: 2, hoverOffset: 8 }],
      },
      options: {
        cutout: "72%",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0c0f1a", borderColor: "#1c2035", borderWidth: 1,
            titleColor: "#f1f3fc", bodyColor: "#a8b0d0",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont:  { family: "JetBrains Mono", size: 11 },
            padding: 12,
            callbacks: { label: (ctx) => `  ${ctx.label} : ${ctx.parsed} (${total > 0 ? Math.round(ctx.parsed/total*100) : 0}%)` },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [JSON.stringify(data)]);

  return (
    <div className={styles.chartWrapDonut}>
      <canvas ref={ref} />
      <div className={styles.donutCenter}>
        <div className={styles.donutCenterVal}>{total}</div>
        <div className={styles.donutCenterLabel}>{centerLabel}</div>
      </div>
    </div>
  );
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ labels, data, color }: { labels: string[]; data: number[]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{ data, backgroundColor: color + "55", borderColor: color, borderWidth: 2, borderRadius: 6, borderSkipped: false as any }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0c0f1a", borderColor: "#1c2035", borderWidth: 1,
            titleColor: "#f1f3fc", bodyColor: "#a8b0d0",
            titleFont: { family: "JetBrains Mono", size: 11 },
            bodyFont:  { family: "JetBrains Mono", size: 11 },
            padding: 12,
          },
        },
        scales: {
          x: { grid: { color: "#1c2035" }, ticks: { color: "#5a6080", font: { family: "JetBrains Mono", size: 10 } }, border: { color: "#1c2035" } },
          y: { grid: { color: "#1c2035" }, ticks: { color: "#5a6080", font: { family: "JetBrains Mono", size: 10 }, stepSize: 1 }, border: { color: "#1c2035" }, beginAtZero: true },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [JSON.stringify(data)]);
  return <div style={{ position: "relative", height: 200 }}><canvas ref={ref} /></div>;
}

// ── Legend ───────────────────────────────────────────────────────────────────
function ChartLegend({ items }: { items: { label: string; value: number; color: string; total: number }[] }) {
  return (
    <div className={styles.legend}>
      {items.map(item => (
        <div key={item.label} className={styles.legendRow}>
          <div className={styles.legendDot} style={{ background: item.color }} />
          <span className={styles.legendLabel}>{item.label}</span>
          <span className={styles.legendVal}>{item.value}</span>
          <span className={styles.legendPct}>{item.total > 0 ? Math.round(item.value / item.total * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab]       = useState<"overview"|"users"|"depots">("overview");
  const [stats, setStats]   = useState<Stats | null>(null);
  const [users, setUsers]   = useState<User[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDepots, setUserDepots]     = useState<Depot[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [sR, uR, dR] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/depots`),
      ]);
      setStats(sR.data); setUsers(uR.data); setDepots(dR.data);
    } catch {}
  };

  const openUser = async (u: User) => {
    setSelectedUser(u);
    try { const r = await axios.get(`${API}/admin/users/${u.id}/depots`); setUserDepots(r.data); }
    catch { setUserDepots([]); }
  };

  const toggleActive = async (u: User) => {
    await axios.patch(`${API}/admin/users/${u.id}/active`, { is_active: !u.is_active });
    const upd = { ...u, is_active: !u.is_active };
    setUsers(p => p.map(x => x.id===u.id ? upd : x));
    if (selectedUser?.id===u.id) setSelectedUser(upd);
    loadAll();
  };

  const toggleRole = async (u: User) => {
    const r = u.role==="admin" ? "user" : "admin";
    await axios.patch(`${API}/admin/users/${u.id}/role`, { role: r });
    const upd = { ...u, role: r };
    setUsers(p => p.map(x => x.id===u.id ? upd : x));
    if (selectedUser?.id===u.id) setSelectedUser(upd);
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await axios.delete(`${API}/admin/users/${id}`);
    setUsers(p => p.filter(x => x.id!==id));
    if (selectedUser?.id===id) setSelectedUser(null);
    loadAll();
  };

  const deleteDepot = async (id: number) => {
    if (!confirm("Supprimer ce dépôt ?")) return;
    await axios.delete(`${API}/admin/depots/${id}`);
    setDepots(p => p.filter(x => x.id!==id));
    setUserDepots(p => p.filter(x => x.id!==id));
    loadAll();
  };

  // Données charts
  const adminCount    = stats?.admin_count ?? 0;
  const userCount     = (stats?.total_users ?? 0) - adminCount;
  const activeCount   = stats?.active_users ?? 0;
  const inactiveCount = (stats?.total_users ?? 0) - activeCount;
  const totalUsers    = stats?.total_users ?? 0;
  const totalDepots   = stats?.total_depots ?? 0;
  const topUsers      = [...users].filter(u => u.depot_count > 0).sort((a,b) => b.depot_count - a.depot_count).slice(0, 6);

  const filteredUsers  = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || (u.username||"").toLowerCase().includes(search.toLowerCase()));
  const filteredDepots = depots.filter(d => d.nom.toLowerCase().includes(search.toLowerCase()) || (d.owner_email||"").toLowerCase().includes(search.toLowerCase()));

  const statCards = [
    { label: "Utilisateurs",  val: stats?.total_users ?? 0,  mod: "Blue",   icon: "👥" },
    { label: "Actifs",         val: stats?.active_users ?? 0, mod: "Green",  icon: "✅" },
    { label: "Dépôts total",   val: stats?.total_depots ?? 0, mod: "Orange", icon: "📁" },
    { label: "Admins",         val: stats?.admin_count ?? 0,  mod: "Purple", icon: "🛡" },
  ];

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <span className={styles.topLogo}>⬡</span>
        <span className={styles.topTitle}>Audit Platform</span>
        <span className={styles.topBadge}>ADMIN</span>
        <button className={styles.topBack} onClick={() => router.push("/dashboard")}>← Dashboard</button>
      </div>

      <div className={styles.body}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarSection}>Navigation</div>
          {[
            { key: "overview", icon: "▦", label: "Vue globale",   count: null },
            { key: "users",    icon: "👥", label: "Utilisateurs", count: users.length },
            { key: "depots",   icon: "📁", label: "Dépôts",       count: depots.length },
          ].map(item => (
            <div key={item.key}
              className={`${styles.navItem} ${tab===item.key ? styles.navItemActive : ""}`}
              onClick={() => { setTab(item.key as any); setSearch(""); }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.count !== null && <span className={styles.navBadge}>{item.count}</span>}
            </div>
          ))}
        </div>

        {/* Main */}
        <div className={styles.main}>

          {/* ════════════ OVERVIEW ════════════ */}
          {tab === "overview" && stats && (<>
            <div className={styles.pageTitle}>Vue d'ensemble</div>
            <div className={styles.pageSub}>Statistiques globales de la plateforme</div>

            {/* Stat cards */}
            <div className={styles.statsGrid}>
              {statCards.map(c => (
                <div key={c.label} className={`${styles.statCard} ${(styles as any)["statCard"+c.mod]}`}>
                  <div className={styles.statIcon}>{c.icon}</div>
                  <div className={`${styles.statVal} ${(styles as any)["statVal"+c.mod]}`}>{c.val}</div>
                  <div className={styles.statLabel}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Charts row 1 : 2 donuts */}
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Répartition des rôles</div>
                    <div className={styles.chartSub}>Admins vs Utilisateurs</div>
                  </div>
                  <span className={styles.chartBadge}>Rôles</span>
                </div>
                <DonutChart data={[adminCount, userCount]} labels={["Admins","Utilisateurs"]}
                  colors={[COLORS.accent, COLORS.teal]} total={totalUsers} centerLabel="total" />
                <ChartLegend items={[
                  { label: "Admins",       value: adminCount, color: COLORS.accent, total: totalUsers },
                  { label: "Utilisateurs", value: userCount,  color: COLORS.teal,   total: totalUsers },
                ]} />
              </div>

              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Statut des comptes</div>
                    <div className={styles.chartSub}>Actifs vs Inactifs</div>
                  </div>
                  <span className={styles.chartBadge}>Statuts</span>
                </div>
                <DonutChart data={[activeCount, inactiveCount]} labels={["Actifs","Inactifs"]}
                  colors={[COLORS.green, COLORS.red]} total={totalUsers} centerLabel="comptes" />
                <ChartLegend items={[
                  { label: "Actifs",   value: activeCount,   color: COLORS.green, total: totalUsers },
                  { label: "Inactifs", value: inactiveCount, color: COLORS.red,   total: totalUsers },
                ]} />
              </div>
            </div>

            {/* Chart : dépôts par user */}
            {topUsers.length > 0 && (
              <div className={styles.chartCard} style={{ marginBottom: 24 }}>
                <div className={styles.chartHeader}>
                  <div>
                    <div className={styles.chartTitle}>Dépôts par utilisateur</div>
                    <div className={styles.chartSub}>Top {topUsers.length} utilisateurs actifs</div>
                  </div>
                  <span className={styles.chartBadge}>Dépôts</span>
                </div>
                <BarChart
                  labels={topUsers.map(u => u.username || u.email.split("@")[0])}
                  data={topUsers.map(u => u.depot_count)}
                  color={COLORS.orange}
                />
              </div>
            )}

            {/* Chart : global */}
            <div className={styles.chartCard} style={{ marginBottom: 28 }}>
              <div className={styles.chartHeader}>
                <div>
                  <div className={styles.chartTitle}>Ressources globales</div>
                  <div className={styles.chartSub}>Utilisateurs vs Dépôts</div>
                </div>
                <span className={styles.chartBadge}>Global</span>
              </div>
              <DonutChart data={[totalUsers, totalDepots]} labels={["Utilisateurs","Dépôts"]}
                colors={[COLORS.accent2, COLORS.orange]} total={totalUsers+totalDepots} centerLabel="total" />
              <ChartLegend items={[
                { label: "Utilisateurs", value: totalUsers,  color: COLORS.accent2, total: totalUsers+totalDepots },
                { label: "Dépôts",       value: totalDepots, color: COLORS.orange,  total: totalUsers+totalDepots },
              ]} />
            </div>

            {/* Tableau derniers inscrits */}
            <div className={styles.sectionTitle}>Derniers inscrits</div>
            <div className={styles.tableWrap}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead className={styles.tableHead}>
                  <tr>{["ID","Email","Rôle","Statut","Dépôts"].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {users.slice(0, 6).map(u => (
                    <tr key={u.id} className={styles.tr} onClick={() => { setTab("users"); openUser(u); }}>
                      <td className={`${styles.td} ${styles.tdMono}`}>#{u.id}</td>
                      <td className={styles.td}>{u.email}</td>
                      <td className={styles.td}><span className={u.role==="admin" ? styles.badgeAdmin : styles.badgeUser}>{u.role}</span></td>
                      <td className={styles.td}><span className={u.is_active ? styles.badgeActive : styles.badgeInactive}>{u.is_active ? "actif" : "inactif"}</span></td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{u.depot_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* ════════════ USERS ════════════ */}
          {tab === "users" && (<>
            <div className={styles.pageTitle}>Utilisateurs</div>
            <div className={styles.pageSub}>{users.length} comptes enregistrés</div>
            <div className={styles.tableWrap}>
              <div className={styles.searchBar}>
                <input className={styles.searchInput} placeholder="Rechercher par email ou username..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                <span className={styles.searchCount}>{filteredUsers.length} résultats</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead className={styles.tableHead}>
                  <tr>{["ID","Email","Username","Rôle","Statut","Dépôts","Actions"].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={styles.tr} onClick={() => openUser(u)}>
                      <td className={`${styles.td} ${styles.tdMono}`}>#{u.id}</td>
                      <td className={styles.td}>{u.email}</td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{u.username||"—"}</td>
                      <td className={styles.td}><span className={u.role==="admin" ? styles.badgeAdmin : styles.badgeUser}>{u.role}</span></td>
                      <td className={styles.td}><span className={u.is_active ? styles.badgeActive : styles.badgeInactive}>{u.is_active ? "actif" : "inactif"}</span></td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{u.depot_count}</td>
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        <div className={styles.actions}>
                          <button className={styles.btnIcon} title={u.is_active ? "Désactiver" : "Activer"} onClick={() => toggleActive(u)}>{u.is_active ? "⏸" : "▶"}</button>
                          <button className={styles.btnIcon} title="Changer rôle" onClick={() => toggleRole(u)}>🛡</button>
                          <button className={styles.btnDanger} title="Supprimer" onClick={() => deleteUser(u.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length===0 && <tr><td colSpan={7} className={styles.empty}>Aucun utilisateur trouvé</td></tr>}
                </tbody>
              </table>
            </div>
          </>)}

          {/* ════════════ DEPOTS ════════════ */}
          {tab === "depots" && (<>
            <div className={styles.pageTitle}>Tous les dépôts</div>
            <div className={styles.pageSub}>{depots.length} dépôts sur la plateforme</div>
            <div className={styles.tableWrap}>
              <div className={styles.searchBar}>
                <input className={styles.searchInput} placeholder="Rechercher par nom ou propriétaire..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                <span className={styles.searchCount}>{filteredDepots.length} résultats</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead className={styles.tableHead}>
                  <tr>{["ID","Nom du dépôt","Branche","Propriétaire","Action"].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredDepots.map(d => (
                    <tr key={d.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdMono}`}>#{d.id}</td>
                      <td className={`${styles.td} ${styles.tdAccent}`}>{d.nom}</td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{d.url_branche_principale||"—"}</td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{d.owner_email||`#${d.proprietaire_id}`}</td>
                      <td className={styles.td}><button className={styles.btnDanger} onClick={() => deleteDepot(d.id)}>🗑</button></td>
                    </tr>
                  ))}
                  {filteredDepots.length===0 && <tr><td colSpan={5} className={styles.empty}>Aucun dépôt trouvé</td></tr>}
                </tbody>
              </table>
            </div>
          </>)}
        </div>
      </div>

      {/* Panel utilisateur */}
      {selectedUser && (
        <div className={styles.panel}>
          <button className={styles.panelClose} onClick={() => setSelectedUser(null)}>×</button>
          <div className={styles.panelTitle}>{selectedUser.username || selectedUser.email}</div>
          <div className={styles.panelSub}>Détails du compte</div>
          {[["ID",`#${selectedUser.id}`],["Email",selectedUser.email],["Username",selectedUser.username||"—"],["Rôle",selectedUser.role],["Statut",selectedUser.is_active?"Actif":"Inactif"],["Dépôts",String(selectedUser.depot_count)]].map(([k,v]) => (
            <div key={k} className={styles.infoRow}>
              <span className={styles.infoKey}>{k}</span>
              <span className={styles.infoVal}>{v}</span>
            </div>
          ))}
          <div className={styles.panelActions}>
            <button className={`${styles.panelBtn} ${selectedUser.is_active ? styles.panelBtnToggleOff : styles.panelBtnToggle}`} onClick={() => toggleActive(selectedUser)}>
              {selectedUser.is_active ? "⏸ Désactiver" : "▶ Activer"}
            </button>
            <button className={`${styles.panelBtn} ${styles.panelBtnRole}`} onClick={() => toggleRole(selectedUser)}>
              🛡 → {selectedUser.role==="admin" ? "user" : "admin"}
            </button>
          </div>
          <div className={styles.panelDepotTitle}>Dépôts ({userDepots.length})</div>
          {userDepots.length===0
            ? <div className={styles.empty}>Aucun dépôt</div>
            : userDepots.map(d => (
              <div key={d.id} className={styles.depotItem}>
                <div className={styles.depotName}>{d.nom}</div>
                <div className={styles.depotBranch}>{d.url_branche_principale||"—"}</div>
                <button className={styles.btnDeleteDepot} onClick={() => deleteDepot(d.id)}>🗑 Supprimer</button>
              </div>
            ))
          }
          <button className={styles.panelDeleteBtn} onClick={() => deleteUser(selectedUser.id)}>
            🗑 Supprimer l'utilisateur
          </button>
        </div>
      )}
    </div>
  );
}