"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";

interface Depot {
  id: number;
  nom: string;
  url_branche_principale: string;
  url_branche_developpement: string;
  token_gitlab: string;
  proprietaire_id: number;
}

const menuItems = [
  { key: "dashboard",      label: "Vue d'ensemble",  icon: "▦" },
  { key: "repositories",   label: "Dépôts",           icon: "◈" },
  { key: "analyses",       label: "Analyses",         icon: "◎" },
  { key: "issues",         label: "Issues",           icon: "◇" },
  { key: "merge_requests", label: "Merge Requests",   icon: "⟁" },
  { key: "pipelines",      label: "Pipelines",        icon: "⊞" },
  { key: "settings",       label: "Configuration",    icon: "⊙" },
];

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [username, setUsername] = useState("Utilisateur");

  // Sauvegarde token depuis URL (OAuth GitLab)
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) localStorage.setItem("token", token);
  }, []);

  // Récupère user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get("http://127.0.0.1:8000/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsername(res.data.username ?? "Utilisateur");
        localStorage.setItem("user_id", String(res.data.id));
      } catch {}
    };
    fetchUser();
  }, []);

  // Récupère les dépôts
  useEffect(() => {
    const fetchDepots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get("http://127.0.0.1:8000/depots/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDepots(res.data);
      } catch (err) {
        console.error("Erreur récupération dépôts:", err);
      }
    };
    fetchDepots();
    window.addEventListener("focus", fetchDepots);
    return () => window.removeEventListener("focus", fetchDepots);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    router.push("/login");
  };

  const stats = [
    { label: "Dépôts actifs",       value: depots.length,  color: "#00d4aa" },
    { label: "Score qualité moyen", value: 0,              color: "#9b91ff" },
    { label: "Vulnérabilités",      value: 0,              color: "#ff6b6b" },
    { label: "Tests générés",       value: 0,              color: "#ffd166" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .root { display: flex; height: 100vh; background: #0d0e12; color: #c9cad6; font-family: 'Inter', sans-serif; }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 220px; min-width: 220px; background: #111218;
          border-right: 1px solid #1c1d26;
          display: flex; flex-direction: column; padding: 24px 0;
        }
        .logo {
          display: flex; align-items: center; gap: 10px;
          padding: 0 20px 24px; border-bottom: 1px solid #1c1d26;
        }
        .logo-box {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, #6c63ff, #00d4aa);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #000; flex-shrink: 0;
        }
        .logo-name { font-size: 14px; font-weight: 700; color: #fff; }
        .logo-tag  { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; }

        .nav { padding: 16px 12px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .nav-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 7px;
          background: transparent; border: none;
          color: #555; font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 500;
          cursor: pointer; width: 100%; text-align: left; transition: all 0.15s;
        }
        .nav-btn:hover { background: #1a1b24; color: #aaa; }
        .nav-btn.active { background: #1e1f2e; color: #fff; border-left: 2px solid #6c63ff; padding-left: 8px; }
        .nav-icon { font-size: 14px; width: 18px; text-align: center; }

        .sidebar-bottom {
          padding: 12px; border-top: 1px solid #1c1d26;
          display: flex; flex-direction: column; gap: 6px;
        }
        .user-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 7px; cursor: pointer;
          transition: background 0.15s;
        }
        .user-row:hover { background: #1a1b24; }
        .avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #6c63ff, #00d4aa);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #000; flex-shrink: 0;
        }
        .u-name { font-size: 12px; font-weight: 600; color: #bbb; }
        .u-role { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; }
        .btn-logout-side {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 7px; background: transparent;
          border: 1px solid #ff6b6b20; color: #ff6b6b;
          font-family: 'Inter', sans-serif; font-size: 12px;
          cursor: pointer; transition: all 0.15s; width: 100%;
        }
        .btn-logout-side:hover { background: #ff6b6b10; border-color: #ff6b6b40; }

        /* ── MAIN ── */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 28px; border-bottom: 1px solid #1c1d26;
          background: #0d0e12; flex-shrink: 0;
        }
        .page-title { font-size: 18px; font-weight: 700; color: #fff; }
        .page-sub   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
        .btn-add {
          padding: 8px 18px; background: #6c63ff; border: none; border-radius: 7px;
          color: #fff; font-family: 'Inter', sans-serif; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .btn-add:hover { background: #5b52e0; }

        .content { flex: 1; overflow-y: auto; padding: 28px; scrollbar-width: thin; scrollbar-color: #1c1d26 transparent; }

        /* ── STATS ── */
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
        .stat { background: #111218; border: 1px solid #1c1d26; border-radius: 10px; padding: 18px 20px; position: relative; overflow: hidden; }
        .stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--c); }
        .stat-val { font-size: 30px; font-weight: 700; color: var(--c); letter-spacing: -0.02em; margin-bottom: 4px; }
        .stat-lbl { font-size: 11px; color: #555; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; }

        /* ── SECTION ── */
        .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; }
        .section-count { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; }

        /* ── DEPOT CARDS ── */
        .depot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

        .depot-card {
          background: #111218; border: 1px solid #1c1d26;
          border-radius: 12px; padding: 20px;
          transition: border-color 0.15s, transform 0.15s;
          display: flex; flex-direction: column; gap: 14px;
        }
        .depot-card:hover { border-color: #6c63ff50; transform: translateY(-2px); box-shadow: 0 8px 30px #00000040; }

        .depot-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .depot-icon {
          width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
          background: linear-gradient(135deg, #6c63ff20, #00d4aa20);
          border: 1px solid #6c63ff25;
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .depot-title-block { flex: 1; }
        .depot-name { font-size: 15px; font-weight: 700; color: #e8e8f0; margin-bottom: 2px; }
        .depot-id   { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; }

        .status-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; color: #00d4aa; background: #00d4aa12;
          border: 1px solid #00d4aa20; border-radius: 20px; padding: 3px 9px;
          font-family: 'JetBrains Mono', monospace; white-space: nowrap;
        }
        .blink { width: 5px; height: 5px; background: #00d4aa; border-radius: 50%; animation: blink 2s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* DIVIDER */
        .card-divider { height: 1px; background: #1c1d26; }

        /* BRANCHES */
        .branches { display: flex; flex-direction: column; gap: 7px; }
        .branch-row { display: flex; align-items: center; gap: 8px; }
        .branch-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .branch-lbl { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; width: 88px; flex-shrink: 0; }
        .branch-url {
          font-size: 11px; color: #6c63ff; font-family: 'JetBrains Mono', monospace;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
        }
        .branch-badge {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          padding: 2px 7px; border-radius: 4px; white-space: nowrap; flex-shrink: 0;
        }
        .badge-main { color: #00d4aa; background: #00d4aa10; border: 1px solid #00d4aa20; }
        .badge-dev  { color: #9b91ff;  background: #6c63ff10;  border: 1px solid #6c63ff20; }

        /* OWNER */
        .depot-footer { display: flex; align-items: center; justify-content: space-between; }
        .owner-tag {
          font-size: 10px; color: #ffd166; background: #ffd16610;
          border: 1px solid #ffd16620; border-radius: 5px; padding: 2px 8px;
          font-family: 'JetBrains Mono', monospace;
        }
        .btn-compare-card {
          padding: 5px 12px; background: transparent;
          border: 1px solid #6c63ff40; border-radius: 6px;
          color: #9b91ff; font-size: 11px; font-family: 'Inter', sans-serif;
          font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .btn-compare-card:hover { background: #6c63ff15; border-color: #6c63ff80; color: #fff; }

        /* EMPTY */
        .empty {
          grid-column: 1/-1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 60px; gap: 12px;
        }
        .empty-icon { font-size: 40px; opacity: 0.1; }
        .empty-txt  { font-size: 12px; color: #444; font-family: 'JetBrains Mono', monospace; }

        /* PLACEHOLDER */
        .placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; opacity: 0.3; }
        .placeholder-icon { font-size: 40px; }
        .placeholder-txt  { font-size: 11px; color: #555; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; }
      `}</style>

      <div className="root">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-box">A</div>
            <div>
              <div className="logo-name">AuditPlatform</div>
              <div className="logo-tag">GitLab · LLM</div>
            </div>
          </div>

          <nav className="nav">
            {menuItems.map((item) => (
              <button
                key={item.key}
                className={`nav-btn ${activeMenu === item.key ? "active" : ""}`}
                onClick={() => {
                  if (item.key === "repositories") router.push("/depots");
                  else setActiveMenu(item.key);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            {/* Profil cliquable */}
            <div className="user-row" onClick={() => router.push("/profile")}>
              <div className="avatar">{username[0]?.toUpperCase() ?? "U"}</div>
              <div>
                <div className="u-name">{username}</div>
                <div className="u-role">admin</div>
              </div>
            </div>
            {/* Bouton déconnexion */}
            <button className="btn-logout-side" onClick={handleLogout}>
              <span>⎋</span> Déconnexion
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="main">
          <header className="topbar">
            <div>
              <div className="page-title">{menuItems.find((m) => m.key === activeMenu)?.label}</div>
              <div className="page-sub">
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            <button className="btn-add" onClick={() => router.push("/add-repository")}>
              + comparer deux depots
            </button>
            <button className="btn-add" onClick={() => router.push("/Exploreformpage")}>
              + Ajouter un dépôt
            </button>
          </header>

          <div className="content">
            {activeMenu === "dashboard" && (
              <>
                {/* Stats */}
                <div className="stats">
                  {stats.map((s, i) => (
                    <div className="stat" key={i} style={{ "--c": s.color } as React.CSSProperties}>
                      <div className="stat-val">{s.value}</div>
                      <div className="stat-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Section dépôts */}
                <div className="section-head">
                  <div className="section-title">Dépôts connectés</div>
                  <span className="section-count">
                    {depots.length} dépôt{depots.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="depot-grid">
                  {depots.length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">◈</div>
                      <div className="empty-txt">Aucun dépôt configuré</div>
                      <button className="btn-add" style={{ marginTop: 8 }} onClick={() => router.push("/add-depot")}>
                        + Connecter un dépôt
                      </button>
                    </div>
                  ) : (
                    depots.map((depot) => (
                      <div key={depot.id} className="depot-card">

                        {/* Header */}
                        <div className="depot-header">
                          <div className="depot-icon">◈</div>
                          <div className="depot-title-block">
                            <div className="depot-name">{depot.nom}</div>
                            <div className="depot-id">ID #{depot.id} · user #{depot.proprietaire_id}</div>
                          </div>
                          <div className="status-pill">
                            <div className="blink" />
                            actif
                          </div>
                        </div>

                        <div className="card-divider" />

                        {/* Branches */}
                        <div className="branches">
                          <div className="branch-row">
                            <div className="branch-dot" style={{ background: "#00d4aa" }} />
                            <span className="branch-lbl">principale</span>
                            <span className="branch-url">{depot.url_branche_principale}</span>
                            <span className="branch-badge badge-main">main</span>
                          </div>
                          <div className="branch-row">
                            <div className="branch-dot" style={{ background: "#9b91ff" }} />
                            <span className="branch-lbl">développement</span>
                            <span className="branch-url">{depot.url_branche_developpement}</span>
                            <span className="branch-badge badge-dev">dev</span>
                          </div>
                        </div>

                        <div className="card-divider" />

                        {/* Footer */}
                        <div className="depot-footer">
                          <span className="owner-tag">user #{depot.proprietaire_id}</span>
                          <button
                            className="btn-compare-card"
                            onClick={() => router.push("/depots")}
                          >
                            ⟁ Voir détails
                          </button>
                        </div>

                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {activeMenu !== "dashboard" && (
              <div className="placeholder">
                <div className="placeholder-icon">{menuItems.find((m) => m.key === activeMenu)?.icon}</div>
                <div className="placeholder-txt">{menuItems.find((m) => m.key === activeMenu)?.label} — en développement</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}