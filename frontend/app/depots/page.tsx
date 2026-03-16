"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ✅ Interface alignée avec les vraies colonnes du backend
interface Depot {
  id: number;
  nom: string;
  url_branche_principale: string;
  url_branche_developpement: string;
  token_gitlab: string;
  proprietaire_id: number;
}

export default function DepotsPage() {
  const router = useRouter();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchDepots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        // Récupère TOUS les dépôts de tous les utilisateurs
        const res = await axios.get("http://127.0.0.1:8000/depots/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDepots(res.data);
      } catch (err: any) {
        if (err?.response?.status === 404) setDepots([]);
        else console.error(err);
      }
    };
    fetchDepots();
    window.addEventListener("focus", fetchDepots);
    return () => window.removeEventListener("focus", fetchDepots);
  }, []);

  const filtered = depots.filter((d) =>
    (d.nom ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.url_branche_principale ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.url_branche_developpement ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce dépôt ?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://127.0.0.1:8000/depots/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepots(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
  };

  const [comparing, setComparing] = useState<number | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [modalDepot, setModalDepot] = useState<Depot | null>(null);
  const [modalToken, setModalToken] = useState("");

  // Ouvre le modal pour saisir un token frais
  const openCompareModal = (depot: Depot) => {
    setModalDepot(depot);
    setModalToken("");
    setCompareError(null);
  };

  const handleCompare = async () => {
    if (!modalDepot) return;
    if (!modalToken.trim()) {
      setCompareError("Veuillez saisir un token GitLab valide.");
      return;
    }
    setComparing(modalDepot.id);
    setCompareError(null);
    try {
      // 1. Met à jour le token du dépôt
      const token = localStorage.getItem("token");
      await axios.put(`http://127.0.0.1:8000/depots/${modalDepot.id}`, {
        token_gitlab: modalToken.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 2. Lance la comparaison
      const res = await axios.get(`http://127.0.0.1:8000/depots/${modalDepot.id}/compare`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = encodeURIComponent(JSON.stringify(res.data));
      setModalDepot(null);
      router.push(`/difference?data=${data}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Erreur inconnue";
      setCompareError(`Erreur : ${msg}`);
    } finally {
      setComparing(null);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page { min-height: 100vh; background: #0d0e12; font-family: 'Inter', sans-serif; color: #c9cad6; padding: 32px; }

        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .back-btn {
          background: transparent; border: 1px solid #1c1d26; border-radius: 7px;
          color: #555; font-size: 16px; width: 34px; height: 34px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.15s;
        }
        .back-btn:hover { border-color: #333; color: #aaa; }
        .page-title { font-size: 20px; font-weight: 700; color: #fff; }
        .page-sub   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; margin-top: 3px; }
        .btn-add {
          padding: 8px 18px; background: #6c63ff; border: none; border-radius: 7px;
          color: #fff; font-family: 'Inter', sans-serif; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .btn-add:hover { background: #5b52e0; }

        /* SUMMARY */
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .sum-card { background: #111218; border: 1px solid #1c1d26; border-radius: 10px; padding: 16px 18px; }
        .sum-val { font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
        .sum-lbl { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }

        /* TOOLBAR */
        .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .search-wrap { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #444; font-size: 14px; pointer-events: none; }
        .search-input {
          width: 100%; background: #111218; border: 1px solid #1c1d26; border-radius: 8px;
          padding: 9px 12px 9px 34px; color: #e8e8f0; font-family: 'JetBrains Mono', monospace;
          font-size: 12px; outline: none; transition: border-color 0.15s;
        }
        .search-input::placeholder { color: #333; }
        .search-input:focus { border-color: #6c63ff55; }
        .count-label { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; white-space: nowrap; }

        /* TABLE */
        .table-wrap { background: #111218; border: 1px solid #1c1d26; border-radius: 12px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 800px; }

        thead tr { border-bottom: 1px solid #1c1d26; background: #0d0e12; }
        th {
          padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 600;
          color: #444; text-transform: uppercase; letter-spacing: 0.08em;
          font-family: 'JetBrains Mono', monospace; white-space: nowrap;
        }

        tbody tr { border-bottom: 1px solid #1c1d2650; transition: background 0.12s; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: #16172060; }
        td { padding: 14px 16px; vertical-align: middle; }

        /* CELLS */
        .cell-id   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; }
        .cell-nom  { font-size: 14px; font-weight: 600; color: #e8e8f0; }
        .cell-url  { font-size: 11px; color: #555; font-family: 'JetBrains Mono', monospace; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cell-url a { color: #6c63ff; text-decoration: none; }
        .cell-url a:hover { text-decoration: underline; }

        .branch-badge {
          display: inline-block; font-size: 10px; font-family: 'JetBrains Mono', monospace;
          padding: 2px 7px; border-radius: 4px; margin-top: 4px;
        }
        .badge-principale    { color: #00d4aa; background: #00d4aa10; border: 1px solid #00d4aa20; }
        .badge-developpement { color: #9b91ff; background: #6c63ff10; border: 1px solid #6c63ff20; }

        .token-cell { font-size: 11px; color: #333; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; }

        .owner-badge {
          font-size: 11px; color: #ffd166; background: #ffd16610;
          border: 1px solid #ffd16620; border-radius: 5px; padding: 2px 8px;
          font-family: 'JetBrains Mono', monospace;
        }

        .status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; border-radius: 20px; padding: 3px 9px;
          font-family: 'JetBrains Mono', monospace;
          color: #00d4aa; background: #00d4aa12; border: 1px solid #00d4aa20;
        }
        .status-dot { width: 5px; height: 5px; border-radius: 50%; background: #00d4aa; animation: blink 2s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* ACTIONS */
        .actions { display: flex; gap: 6px; align-items: center; }
        .btn-compare {
          padding: 5px 11px; background: transparent;
          border: 1px solid #6c63ff40; border-radius: 6px;
          color: #9b91ff; font-size: 11px; font-family: 'Inter', sans-serif;
          font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .btn-compare:hover { background: #6c63ff15; border-color: #6c63ff80; color: #fff; }
        .btn-delete {
          padding: 5px 10px; background: transparent;
          border: 1px solid #ff6b6b30; border-radius: 6px;
          color: #ff6b6b; font-size: 12px; cursor: pointer; transition: all 0.15s;
        }
        .btn-delete:hover { background: #ff6b6b10; border-color: #ff6b6b60; }

        /* EMPTY */
        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 20px; gap: 12px; }
        .empty-icon { font-size: 36px; opacity: 0.1; }
        .empty-txt  { font-size: 12px; color: #444; font-family: 'JetBrains Mono', monospace; }
        /* MODAL */
        .modal-overlay {
          position: fixed; inset: 0; background: #00000090; z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .modal {
          background: #111218; border: 1px solid #1c1d26; border-radius: 14px;
          padding: 28px; width: 100%; max-width: 420px;
        }
        .modal-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .modal-sub   { font-size: 11px; color: #444; font-family: "JetBrains Mono", monospace; margin-bottom: 20px; }
        .modal-label { font-size: 11px; color: #666; font-weight: 500; margin-bottom: 6px; display: block; }
        .modal-input {
          width: 100%; background: #0d0e12; border: 1px solid #1c1d26; border-radius: 8px;
          padding: 10px 14px; color: #e8e8f0; font-family: "JetBrains Mono", monospace;
          font-size: 13px; outline: none; transition: border-color 0.15s; margin-bottom: 12px;
        }
        .modal-input:focus { border-color: #6c63ff55; }
        .modal-input::placeholder { color: #2e2f3e; }
        .modal-hint { font-size: 10px; color: #444; font-family: "JetBrains Mono", monospace; margin-bottom: 20px; }
        .modal-actions { display: flex; gap: 8px; }
        .modal-cancel {
          flex: 1; padding: 9px; background: transparent; border: 1px solid #1c1d26;
          border-radius: 7px; color: #666; font-family: "Inter", sans-serif;
          font-size: 13px; cursor: pointer; transition: all 0.15s;
        }
        .modal-cancel:hover { border-color: #333; color: #aaa; }
        .modal-confirm {
          flex: 2; padding: 9px; background: #6c63ff; border: none; border-radius: 7px;
          color: #fff; font-family: "Inter", sans-serif; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .modal-confirm:hover { background: #5b52e0; }
        .modal-error { font-size: 11px; color: #ff6b6b; font-family: "JetBrains Mono", monospace; margin-bottom: 12px; }
      `}</style>

      <div className="page">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <button className="back-btn" onClick={() => router.push("/dashboard")}>←</button>
            <div>
              <div className="page-title">Dépôts GitLab</div>
              <div className="page-sub">Gérez et surveillez vos dépôts connectés</div>
            </div>
          </div>
          <button className="btn-add" onClick={() => router.push("/add-depot")}>
            + Ajouter un dépôt
          </button>
        </div>

        {/* Summary */}
        <div className="summary">
          <div className="sum-card">
            <div className="sum-val">{depots.length}</div>
            <div className="sum-lbl">Total dépôts</div>
          </div>
          <div className="sum-card">
            <div className="sum-val" style={{ color: "#00d4aa" }}>{depots.length}</div>
            <div className="sum-lbl">Actifs</div>
          </div>
          <div className="sum-card">
            <div className="sum-val" style={{ color: "#9b91ff" }}>
              {[...new Set(depots.map(d => d.proprietaire_id))].length}
            </div>
            <div className="sum-lbl">Propriétaires</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              type="text"
              placeholder="Rechercher par nom ou URL..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="count-label">{filtered.length} dépôt{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Error banner */}
        {compareError && (
          <div style={{ background: "#ff6b6b12", border: "1px solid #ff6b6b30", borderRadius: 8, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#ff6b6b", fontFamily: "JetBrains Mono, monospace" }}>{compareError}</span>
            <button onClick={() => setCompareError(null)} style={{ background: "transparent", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}
        {/* Table */}
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">◈</div>
              <div className="empty-txt">
                {depots.length === 0 ? "Aucun dépôt configuré" : "Aucun résultat"}
              </div>
              {depots.length === 0 && (
                <button className="btn-add" style={{ marginTop: 8 }} onClick={() => router.push("/add-depot")}>
                  + Connecter un dépôt
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#ID</th>
                  <th>Nom</th>
                  <th>Branche principale</th>
                  <th>Branche développement</th>
                  <th>Token GitLab</th>
                  <th>Propriétaire</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>

                    <td><span className="cell-id">#{d.id}</span></td>

                    <td><span className="cell-nom">{d.nom}</span></td>

                    <td>
                      <div className="cell-url">
                        <a href={d.url_branche_principale} target="_blank" rel="noreferrer">
                          {d.url_branche_principale}
                        </a>
                      </div>
                      <span className="branch-badge badge-principale">principale</span>
                    </td>

                    <td>
                      <div className="cell-url">
                        <a href={d.url_branche_developpement} target="_blank" rel="noreferrer">
                          {d.url_branche_developpement}
                        </a>
                      </div>
                      <span className="branch-badge badge-developpement">développement</span>
                    </td>

                    <td>
                      <span className="token-cell">
                        {d.token_gitlab ? d.token_gitlab.slice(0, 6) + "••••••••••" : "—"}
                      </span>
                    </td>

                    <td><span className="owner-badge">user #{d.proprietaire_id}</span></td>

                    <td>
                      <span className="status-badge">
                        <div className="status-dot" />
                        actif
                      </span>
                    </td>

                    <td>
                      <div className="actions">
                        <button
                          className="btn-compare"
                          onClick={() => openCompareModal(d)}
                          disabled={comparing === d.id}
                          style={{ opacity: comparing === d.id ? 0.6 : 1 }}
                        >
                          {comparing === d.id ? "⏳ Chargement..." : "⟁ Comparer"}
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(d.id)}>
                          ✕
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
      {/* MODAL token GitLab */}
      {modalDepot && (
        <div className="modal-overlay" onClick={() => setModalDepot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">⟁ Comparer les branches</div>
            <div className="modal-sub">{modalDepot.nom}</div>

            <label className="modal-label">Token GitLab valide</label>
            <input
              className="modal-input"
              type="password"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={modalToken}
              onChange={e => setModalToken(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCompare()}
              autoFocus
            />
            <div className="modal-hint">
              Settings → Access Tokens → scopes: read_api, read_repository
            </div>

            {compareError && <div className="modal-error">{compareError}</div>}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setModalDepot(null)}>Annuler</button>
              <button
                className="modal-confirm"
                onClick={handleCompare}
                disabled={comparing !== null}
              >
                {comparing !== null ? "⏳ Chargement..." : "Lancer la comparaison"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}