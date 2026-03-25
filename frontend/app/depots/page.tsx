"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ── Interface dépôts analysés ─────────────────────────
interface DepotAnalyse {
  id          : number;
  nom         : string;
  project_url : string;
  branche     : string;
  created_at  : string;
}

// ── Interface analyse ────────────────────────────────
interface Analyse {
  id                : number;
  branche           : string;
  score_qualite     : number;
  score_securite    : number;
  score_performance : number;
  vulnerabilites    : any[];
  recommandations   : any[];
  statut            : string;
  created_at        : string;
}

const API = "http://127.0.0.1:8000";

export default function DepotsPage() {
  const router = useRouter();

  // ── États liste dépôts ────────────────────────────
  const [depots,  setDepots]  = useState<DepotAnalyse[]>([]);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  // ── États modal token ─────────────────────────────
  const [modalDepot,   setModalDepot]   = useState<DepotAnalyse | null>(null);
  const [modalToken,   setModalToken]   = useState("");
  const [modalError,   setModalError]   = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMode,    setModalMode]    = useState<"analyse" | "relancer">("analyse");

  // ── États vue analyses ────────────────────────────
  const [vueAnalyse,    setVueAnalyse]    = useState(false);
  const [analyses,      setAnalyses]      = useState<Analyse[]>([]);
  const [depotVu,       setDepotVu]       = useState<DepotAnalyse | null>(null);
  const [analyseDetail, setAnalyseDetail] = useState<Analyse | null>(null);
  const [loadingA,      setLoadingA]      = useState(false);

  // ── Charger les dépôts analysés de l'user ────────
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const me = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userId = me.data.id;
        const res = await axios.get(`${API}/analyses/depots-user/${userId}`);
        setDepots(res.data);
      } catch { setDepots([]); }
      finally { setLoading(false); }
    };
    fetch();
    window.addEventListener("focus", fetch);
    return () => window.removeEventListener("focus", fetch);
  }, []);

  const filtered = depots.filter(d =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    d.project_url.toLowerCase().includes(search.toLowerCase())
  );

  // ── Supprimer localement ──────────────────────────
  const handleDelete = (id: number) => {
    if (!confirm("Supprimer ce projet de la liste ?")) return;
    setDepots(prev => prev.filter(d => d.id !== id));
  };

  // ── Ouvrir modal pour voir analyses ──────────────
  const ouvrirModalAnalyse = (depot: DepotAnalyse) => {
    setModalDepot(depot);
    setModalToken("");
    setModalError("");
    setModalMode("analyse");
  };

  // ── Ouvrir modal pour relancer une analyse ────────
  const ouvrirModalRelancer = (depot: DepotAnalyse) => {
    setModalDepot(depot);
    setModalToken("");
    setModalError("");
    setModalMode("relancer");
  };

  // ── Valider token → charger analyses ─────────────
  const validerToken = async () => {
    if (!modalToken.trim()) {
      setModalError("Le token GitLab est requis");
      return;
    }
    setModalLoading(true);
    setModalError("");

    try {
      if (modalMode === "relancer") {
        // Relancer une nouvelle analyse
        await axios.post(`${API}/analyses/lancer`, {
          nom_projet    : modalDepot!.nom,
          gitlab_token  : modalToken,
          project_url   : modalDepot!.project_url,
          branche       : modalDepot!.branche,
          owasp_enabled : true,
          auto_tests    : false,
          auto_mr       : false,
          seuil_qualite : 60,
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
      } else {
        // Juste vérifier le token — on essaie de récupérer les analyses
        // Si elles existent on les affiche directement
      }

      // Charger les analyses du dépôt
      setLoadingA(true);
      const res = await axios.get(`${API}/analyses/depot/${modalDepot!.id}`);
      setAnalyses(res.data);
      setDepotVu(modalDepot);
      setModalDepot(null);
      setVueAnalyse(true);
      setAnalyseDetail(null);

    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (typeof detail === "string") setModalError(detail);
      else setModalError("Token invalide ou projet introuvable");
    } finally {
      setModalLoading(false);
      setLoadingA(false);
    }
  };

  // ── Couleurs ──────────────────────────────────────
  const c = (s: number) => {
    if (!s && s !== 0) return "#444";
    if (s >= 75) return "#00d4aa";
    if (s >= 50) return "#ffd166";
    return "#ff6b6b";
  };

  const cSev = (s: string) => {
    if (s === "CRITIQUE") return "#ff6b6b";
    if (s === "HAUTE")    return "#f97316";
    if (s === "MOYENNE")  return "#ffd166";
    return "#00d4aa";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page { min-height: 100vh; background: #0d0e12; font-family: 'Inter', sans-serif; color: #c9cad6; padding: 32px; }

        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .back-btn { background: transparent; border: 1px solid #1c1d26; border-radius: 7px; color: #555; font-size: 16px; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .back-btn:hover { border-color: #333; color: #aaa; }
        .page-title { font-size: 20px; font-weight: 700; color: #fff; }
        .page-sub   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; margin-top: 3px; }
        .btn-add { padding: 8px 18px; background: #6c63ff; border: none; border-radius: 7px; color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .btn-add:hover { background: #5b52e0; }

        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .sum-card { background: #111218; border: 1px solid #1c1d26; border-radius: 10px; padding: 16px 18px; }
        .sum-val { font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
        .sum-lbl { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }

        .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .search-wrap { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #444; font-size: 14px; pointer-events: none; }
        .search-input { width: 100%; background: #111218; border: 1px solid #1c1d26; border-radius: 8px; padding: 9px 12px 9px 34px; color: #e8e8f0; font-family: 'JetBrains Mono', monospace; font-size: 12px; outline: none; transition: border-color 0.15s; }
        .search-input::placeholder { color: #333; }
        .search-input:focus { border-color: #6c63ff55; }
        .count-label { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; white-space: nowrap; }

        .table-wrap { background: #111218; border: 1px solid #1c1d26; border-radius: 12px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 700px; }
        thead tr { border-bottom: 1px solid #1c1d26; background: #0d0e12; }
        th { padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace; white-space: nowrap; }
        tbody tr { border-bottom: 1px solid #1c1d2650; transition: background 0.12s; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: #16172060; }
        td { padding: 14px 16px; vertical-align: middle; }

        .cell-id  { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; }
        .cell-nom { font-size: 14px; font-weight: 600; color: #e8e8f0; }
        .cell-url { font-size: 11px; color: #6c63ff; font-family: 'JetBrains Mono', monospace; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tag { font-size: 10px; font-family: 'JetBrains Mono', monospace; padding: 2px 8px; border-radius: 4px; }
        .tag-branch { color: #00d4aa; background: #00d4aa10; border: 1px solid #00d4aa20; }
        .tag-date   { color: #555; background: #ffffff05; border: 1px solid #1c1d26; }
        .status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; border-radius: 20px; padding: 3px 9px; font-family: 'JetBrains Mono', monospace; color: #00d4aa; background: #00d4aa12; border: 1px solid #00d4aa20; }
        .status-dot { width: 5px; height: 5px; border-radius: 50%; background: #00d4aa; animation: blink 2s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

        .actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .btn-voir    { padding: 5px 11px; background: transparent; border: 1px solid #6c63ff40; border-radius: 6px; color: #9b91ff; font-size: 11px; font-family: 'Inter'; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-voir:hover { background: #6c63ff15; border-color: #6c63ff80; color: #fff; }
        .btn-relancer { padding: 5px 11px; background: transparent; border: 1px solid #ffd16640; border-radius: 6px; color: #ffd166; font-size: 11px; font-family: 'Inter'; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-relancer:hover { background: #ffd16615; }
        .btn-delete  { padding: 5px 10px; background: transparent; border: 1px solid #ff6b6b30; border-radius: 6px; color: #ff6b6b; font-size: 12px; cursor: pointer; transition: all 0.15s; }
        .btn-delete:hover { background: #ff6b6b10; border-color: #ff6b6b60; }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 20px; gap: 12px; }
        .empty-icon { font-size: 36px; opacity: 0.1; }
        .empty-txt  { font-size: 12px; color: #444; font-family: 'JetBrains Mono', monospace; }

        /* ── MODAL ────────────────────────────────── */
        .modal-overlay { position: fixed; inset: 0; background: #00000090; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: #111218; border: 1px solid #1c1d26; border-radius: 14px; padding: 28px; width: 100%; max-width: 420px; }
        .modal-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .modal-sub   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; margin-bottom: 20px; }
        .modal-label { font-size: 11px; color: #666; font-weight: 500; margin-bottom: 6px; display: block; }
        .modal-input { width: 100%; background: #0d0e12; border: 1px solid #1c1d26; border-radius: 8px; padding: 10px 14px; color: #e8e8f0; font-family: 'JetBrains Mono', monospace; font-size: 13px; outline: none; transition: border-color 0.15s; margin-bottom: 8px; }
        .modal-input:focus { border-color: #6c63ff55; }
        .modal-input::placeholder { color: #2e2f3e; }
        .modal-hint  { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; margin-bottom: 16px; }
        .modal-error { font-size: 10px; color: #ff6b6b; font-family: 'JetBrains Mono', monospace; margin-bottom: 12px; background: #ff6b6b10; padding: 8px 10px; border-radius: 6px; border: 1px solid #ff6b6b20; }
        .modal-actions { display: flex; gap: 8px; }
        .modal-cancel  { flex: 1; padding: 9px; background: transparent; border: 1px solid #1c1d26; border-radius: 7px; color: #666; font-family: 'Inter'; font-size: 13px; cursor: pointer; }
        .modal-cancel:hover { border-color: #333; color: #aaa; }
        .modal-confirm { flex: 2; padding: 9px; background: #6c63ff; border: none; border-radius: 7px; color: #fff; font-family: 'Inter'; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .modal-confirm:hover:not(:disabled) { background: #5b52e0; }
        .modal-confirm:disabled { background: #444; cursor: not-allowed; }

        /* ── VUE ANALYSES ────────────────────────── */
        .vue-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 12px; color: #555; font-family: 'JetBrains Mono', monospace; }
        .vue-breadcrumb span { color: #444; }
        .vue-breadcrumb strong { color: #9b91ff; }
        .btn-retour { padding: 6px 14px; background: transparent; border: 1px solid #1c1d26; border-radius: 7px; color: #666; font-family: 'JetBrains Mono', monospace; font-size: 10px; cursor: pointer; transition: all 0.15s; }
        .btn-retour:hover { border-color: #6c63ff55; color: #9b91ff; }

        .analyses-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
        .analyse-card { background: #111218; border: 1px solid #1c1d26; border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.15s; }
        .analyse-card:hover { border-color: #6c63ff50; transform: translateY(-2px); box-shadow: 0 8px 24px #00000040; }

        .analyse-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .analyse-date { font-size: 11px; color: #555; font-family: 'JetBrains Mono', monospace; }
        .statut-ok  { font-size: 9px; font-family: 'JetBrains Mono', monospace; padding: 3px 8px; border-radius: 20px; color: #00d4aa; background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .statut-err { font-size: 9px; font-family: 'JetBrains Mono', monospace; padding: 3px 8px; border-radius: 20px; color: #ff6b6b; background: #ff6b6b0d; border: 1px solid #ff6b6b20; }

        .scores-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
        .score-mini { background: #0d0e12; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #1c1d26; }
        .score-mini-val  { font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--sc); }
        .score-mini-lbl  { font-size: 8px; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
        .score-mini-bar  { height: 2px; background: #1c1d26; border-radius: 1px; overflow: hidden; margin-top: 6px; }
        .score-mini-fill { height: 2px; border-radius: 1px; background: var(--sc); }

        .vuln-row { display: flex; align-items: center; justify-content: space-between; }
        .vuln-chip { font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono', monospace; padding: 3px 10px; border-radius: 20px; }
        .v-zero { color: #00d4aa; background: #00d4aa0d; border: 1px solid #00d4aa20; }
        .v-some { color: #ff6b6b; background: #ff6b6b0d; border: 1px solid #ff6b6b20; }
        .voir-detail { font-size: 9px; color: #444; font-family: 'JetBrains Mono', monospace; }

        /* ── DETAIL ──────────────────────────────── */
        .detail-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 11px; color: #555; font-family: 'JetBrains Mono', monospace; flex-wrap: wrap; }

        .scores-big { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
        .score-big-card { background: #111218; border: 1px solid #1c1d26; border-radius: 10px; padding: 18px; text-align: center; }
        .score-big-val  { font-size: 44px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--sc); line-height: 1; margin-bottom: 5px; }
        .score-big-lbl  { font-size: 9px; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .score-big-bar  { height: 3px; background: #1c1d26; border-radius: 2px; overflow: hidden; }
        .score-big-fill { height: 3px; border-radius: 2px; background: var(--sc); }

        .sect-lbl { font-size: 9px; font-weight: 600; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #1c1d26; }

        .vuln-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
        .vuln-item { background: #111218; border: 1px solid #1c1d26; border-left: 3px solid var(--vc); border-radius: 8px; padding: 12px; }
        .vuln-item-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .vuln-sev  { font-size: 8px; font-weight: 700; font-family: 'JetBrains Mono', monospace; padding: 2px 8px; border-radius: 20px; background: var(--vc); color: #000; }
        .vuln-type { font-size: 11px; font-weight: 700; color: #e8e8f0; }
        .vuln-loc  { font-size: 9px; color: #444; font-family: 'JetBrains Mono', monospace; margin-bottom: 5px; }
        .vuln-fix  { font-size: 11px; color: #7880a0; background: #0d0e12; padding: 7px 10px; border-radius: 6px; }

        .reco-list { display: flex; flex-direction: column; gap: 8px; }
        .reco-item { background: #111218; border: 1px solid #1c1d26; border-radius: 8px; padding: 12px; }
        .reco-titre { font-size: 11px; font-weight: 700; color: #00d4aa; margin-bottom: 4px; }
        .reco-desc  { font-size: 11px; color: #7880a0; }

        .clean-badge { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: #00d4aa0d; border: 1px solid #00d4aa20; border-radius: 8px; color: #00d4aa; font-size: 12px; font-weight: 700; margin-bottom: 20px; }

        .spin { display: inline-block; width: 12px; height: 12px; border: 2px solid #ffffff30; border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="page">

        {/* ── TOPBAR ── */}
        <div className="topbar">
          <div className="topbar-left">
            <button className="back-btn" onClick={() => {
              if (analyseDetail) setAnalyseDetail(null);
              else if (vueAnalyse) setVueAnalyse(false);
              else router.push("/dashboard");
            }}>←</button>
            <div>
              <div className="page-title">
                {analyseDetail
                  ? `Détail — ${depotVu?.nom}`
                  : vueAnalyse
                  ? `Analyses — ${depotVu?.nom}`
                  : "Mes projets GitLab"}
              </div>
              <div className="page-sub">
                {analyseDetail
                  ? `${new Date(analyseDetail.created_at).toLocaleDateString("fr-FR")} · branche ${analyseDetail.branche}`
                  : vueAnalyse
                  ? `${analyses.length} analyse(s) réalisée(s)`
                  : "Projets analysés par l'IA · table depots_analyse"}
              </div>
            </div>
          </div>
          <button className="btn-add" onClick={() => router.push("/analyse")}>
            + Nouvelle analyse
          </button>
        </div>

        {/* ════════════════════════════════════════════
            VUE 1 — LISTE DES PROJETS
        ════════════════════════════════════════════ */}
        {!vueAnalyse && !analyseDetail && (
          <>
            <div className="summary">
              <div className="sum-card">
                <div className="sum-val">{depots.length}</div>
                <div className="sum-lbl">Projets analysés</div>
              </div>
              <div className="sum-card">
                <div className="sum-val" style={{ color: "#00d4aa" }}>
                  {[...new Set(depots.map(d => d.branche))].length}
                </div>
                <div className="sum-lbl">Branches</div>
              </div>
              <div className="sum-card">
                <div className="sum-val" style={{ color: "#6c63ff" }}>IA</div>
                <div className="sum-lbl">Analysé par LLM</div>
              </div>
            </div>

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
              <span className="count-label">
                {filtered.length} projet{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="table-wrap">
              {loading ? (
                <div className="empty">
                  <div className="spin"/>
                  <div className="empty-txt">Chargement...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">◈</div>
                  <div className="empty-txt">
                    {depots.length === 0
                      ? "Aucun projet analysé — lance ta première analyse !"
                      : "Aucun résultat pour cette recherche"}
                  </div>
                  {depots.length === 0 && (
                    <button className="btn-add" style={{ marginTop: 10 }} onClick={() => router.push("/analyse")}>
                      + Analyser un projet
                    </button>
                  )}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nom du projet</th>
                      <th>URL GitLab</th>
                      <th>Branche</th>
                      <th>Date ajout</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => (
                      <tr key={d.id}>

                        <td><span className="cell-id">#{d.id}</span></td>

                        <td><span className="cell-nom">{d.nom}</span></td>

                        <td><span className="cell-url">{d.project_url}</span></td>

                        <td><span className="tag tag-branch">{d.branche}</span></td>

                        <td>
                          <span className="tag tag-date">
                            {new Date(d.created_at).toLocaleDateString("fr-FR")}
                          </span>
                        </td>

                        <td>
                          <span className="status-badge">
                            <div className="status-dot"/>
                            analysé
                          </span>
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="btn-voir"
                              onClick={() => ouvrirModalAnalyse(d)}
                            >
                              ◎ Voir analyses
                            </button>
                            <button
                              className="btn-relancer"
                              onClick={() => ouvrirModalRelancer(d)}
                            >
                              ↺ Relancer
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => handleDelete(d.id)}
                            >
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
          </>
        )}

        {/* ════════════════════════════════════════════
            VUE 2 — LISTE DES ANALYSES D'UN PROJET
        ════════════════════════════════════════════ */}
        {vueAnalyse && !analyseDetail && (
          <>
            <div className="vue-breadcrumb">
              <button className="btn-retour" onClick={() => setVueAnalyse(false)}>
                ← Retour
              </button>
              <span>Projets</span>
              <span>›</span>
              <strong>{depotVu?.nom}</strong>
              <span>›</span>
              <span>{analyses.length} analyse(s)</span>
            </div>

            {loadingA ? (
              <div className="empty">
                <div className="spin"/>
                <div className="empty-txt">Chargement des analyses...</div>
              </div>
            ) : analyses.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">◎</div>
                <div className="empty-txt">Aucune analyse pour ce projet</div>
                <button className="btn-add" style={{ marginTop: 10 }} onClick={() => ouvrirModalRelancer(depotVu!)}>
                  + Lancer une analyse
                </button>
              </div>
            ) : (
              <div className="analyses-grid">
                {analyses.map(a => {
                  const v = a.vulnerabilites?.length || 0;
                  return (
                    <div
                      key={a.id}
                      className="analyse-card"
                      onClick={() => setAnalyseDetail(a)}
                    >
                      <div className="analyse-card-top">
                        <span className="analyse-date">
                          {new Date(a.created_at).toLocaleDateString("fr-FR")} · {a.branche}
                        </span>
                        <span className={a.statut === "termine" ? "statut-ok" : "statut-err"}>
                          {a.statut}
                        </span>
                      </div>

                      <div className="scores-mini">
                        {[
                          { label: "Qualité",     val: a.score_qualite },
                          { label: "Sécurité",    val: a.score_securite },
                          { label: "Performance", val: a.score_performance },
                        ].map(s => (
                          <div key={s.label} className="score-mini" style={{ "--sc": c(s.val) } as any}>
                            <div className="score-mini-val">{s.val ?? "—"}</div>
                            <div className="score-mini-lbl">{s.label}</div>
                            <div className="score-mini-bar">
                              <div className="score-mini-fill" style={{ width: `${s.val ?? 0}%` }}/>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="vuln-row">
                        <span className={`vuln-chip ${v === 0 ? "v-zero" : "v-some"}`}>
                          {v === 0 ? "✓ Code propre" : `⚠ ${v} vulnérabilité(s)`}
                        </span>
                        <span className="voir-detail">Voir le détail →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════
            VUE 3 — DETAIL D'UNE ANALYSE
        ════════════════════════════════════════════ */}
        {analyseDetail && (
          <>
            <div className="detail-breadcrumb">
              <button className="btn-retour" onClick={() => setAnalyseDetail(null)}>
                ← Retour
              </button>
              <span>Projets › {depotVu?.nom} › Analyse du</span>
              <strong style={{ color: "#9b91ff" }}>
                {new Date(analyseDetail.created_at).toLocaleDateString("fr-FR")}
              </strong>
            </div>

            {/* Scores */}
            <div className="scores-big">
              {[
                { label: "Qualité",     val: analyseDetail.score_qualite },
                { label: "Sécurité",    val: analyseDetail.score_securite },
                { label: "Performance", val: analyseDetail.score_performance },
              ].map(s => (
                <div key={s.label} className="score-big-card" style={{ "--sc": c(s.val) } as any}>
                  <div className="score-big-val">{s.val ?? "—"}</div>
                  <div className="score-big-lbl">{s.label}</div>
                  <div className="score-big-bar">
                    <div className="score-big-fill" style={{ width: `${s.val ?? 0}%` }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Vulnérabilités */}
            {analyseDetail.vulnerabilites?.length > 0 ? (
              <>
                <div className="sect-lbl">
                  ⚠ Vulnérabilités ({analyseDetail.vulnerabilites.length})
                </div>
                <div className="vuln-list">
                  {analyseDetail.vulnerabilites.map((v: any, i: number) => (
                    <div key={i} className="vuln-item" style={{ "--vc": cSev(v.severite) } as any}>
                      <div className="vuln-item-top">
                        <span className="vuln-sev">{v.severite}</span>
                        <span className="vuln-type">{v.type}</span>
                      </div>
                      <div className="vuln-loc">📄 {v.fichier} — ligne {v.ligne}</div>
                      <div className="vuln-fix">💡 {v.suggestion}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="clean-badge">✅ Aucune vulnérabilité détectée — Code propre !</div>
            )}

            {/* Recommandations */}
            {analyseDetail.recommandations?.length > 0 && (
              <>
                <div className="sect-lbl">
                  ✓ Recommandations ({analyseDetail.recommandations.length})
                </div>
                <div className="reco-list">
                  {analyseDetail.recommandations.map((r: any, i: number) => (
                    <div key={i} className="reco-item">
                      <div className="reco-titre">{r.titre}</div>
                      <div className="reco-desc">{r.description}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════
          MODAL — Saisir le token GitLab
      ════════════════════════════════════════════ */}
      {modalDepot && (
        <div className="modal-overlay" onClick={() => setModalDepot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {modalMode === "relancer" ? "↺ Relancer une analyse" : "◎ Voir les analyses"}
            </div>
            <div className="modal-sub">
              {modalDepot.nom} · {modalDepot.project_url}
            </div>

            <label className="modal-label">Token d'accès personnel GitLab</label>
            <input
              className="modal-input"
              type="password"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={modalToken}
              onChange={e => setModalToken(e.target.value)}
              onKeyDown={e => e.key === "Enter" && validerToken()}
              autoFocus
            />
            <div className="modal-hint">
              GitLab → Settings → Access Tokens → scopes : api, read_repository
            </div>

            {modalError && (
              <div className="modal-error">⚠️ {modalError}</div>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setModalDepot(null)}>
                Annuler
              </button>
              <button
                className="modal-confirm"
                onClick={validerToken}
                disabled={modalLoading}
              >
                {modalLoading
                  ? <><span className="spin"/> Validation en cours...</>
                  : modalMode === "relancer"
                  ? "Lancer l'analyse"
                  : "Valider et voir"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}