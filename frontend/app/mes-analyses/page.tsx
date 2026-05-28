"use client";

import { MouseEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

interface AnalyseGlobale {
  id: number;
  depot_analyse_id: number;
  depot_nom: string;
  project_url: string;
  branche: string;
  score_qualite: number | null;
  score_securite: number | null;
  score_performance: number | null;
  vulnerabilites: any[];
  recommandations: any[];
  nb_vulnerabilites: number;
  nb_critiques: number;
  nb_hautes: number;
  statut: string;
  modele_llm?: string | null;
  owasp_enabled?: boolean;
  auto_tests?: boolean;
  auto_mr?: boolean;
  created_at: string;
}

type Vue = "cartes" | "tableau";
type Tri = "recent" | "ancien" | "securite_asc" | "securite_desc" | "vulns_desc";

export default function MesAnalysesPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [analyses, setAnalyses] = useState<AnalyseGlobale[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");
  const [search, setSearch] = useState("");
  const [projet, setProjet] = useState("tous");
  const [branche, setBranche] = useState("toutes");
  const [statut, setStatut] = useState("tous");
  const [risque, setRisque] = useState("tous");
  const [tri, setTri] = useState<Tri>("recent");
  const [vue, setVue] = useState<Vue>("cartes");

  // Suppression d'une analyse
  const [analyseASupprimer, setAnalyseASupprimer] = useState<AnalyseGlobale | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  const D = {
    bg: theme.bg,
    card: theme.bgSecondary,
    cardElevated: isDark ? "#181e2b" : "#ffffff",
    border: theme.border,
    text: theme.text,
    muted: theme.textMuted,
    faint: theme.textFaint,
    soft: isDark ? "#1e2538" : "#f1f5f9",
    softText: isDark ? "#cbd5e1" : "#475569",
    hero: isDark
      ? "linear-gradient(125deg, rgba(99,102,241,.16), rgba(15,17,23,.88) 46%, rgba(16,185,129,.09))"
      : "linear-gradient(125deg, #eef2ff, #ffffff 48%, #ecfdf5)",
  };

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const chargerAnalyses = async () => {
    setLoading(true);
    setErreur("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await axios.get(`${API}/analyses/historique/mes-analyses`, {
        headers: headers(),
      });
      setAnalyses(res.data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      setErreur("Impossible de charger l'historique des analyses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerAnalyses();
  }, []);

  const projets = useMemo(
    () => Array.from(new Set(analyses.map(a => a.depot_nom))).sort(),
    [analyses]
  );

  const branches = useMemo(
    () => Array.from(new Set(
      analyses
        .filter(a => projet === "tous" || a.depot_nom === projet)
        .map(a => a.branche)
    )).sort(),
    [analyses, projet]
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();

    const resultat = analyses.filter(a => {
      const correspondRecherche =
        !term ||
        a.depot_nom.toLowerCase().includes(term) ||
        a.project_url.toLowerCase().includes(term) ||
        a.branche.toLowerCase().includes(term);

      const correspondProjet = projet === "tous" || a.depot_nom === projet;
      const correspondBranche = branche === "toutes" || a.branche === branche;
      const correspondStatut = statut === "tous" || a.statut === statut;

      const correspondRisque =
        risque === "tous" ||
        (risque === "critique" && a.nb_critiques > 0) ||
        (risque === "eleve" && a.nb_critiques === 0 && a.nb_hautes > 0) ||
        (risque === "vulnerable" && a.nb_vulnerabilites > 0) ||
        (risque === "propre" && a.nb_vulnerabilites === 0);

      return correspondRecherche && correspondProjet && correspondBranche &&
        correspondStatut && correspondRisque;
    });

    return resultat.sort((a, b) => {
      switch (tri) {
        case "ancien":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "securite_asc":
          return (a.score_securite ?? -1) - (b.score_securite ?? -1);
        case "securite_desc":
          return (b.score_securite ?? -1) - (a.score_securite ?? -1);
        case "vulns_desc":
          return b.nb_vulnerabilites - a.nb_vulnerabilites;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [analyses, search, projet, branche, statut, risque, tri]);

  const stats = useMemo(() => {
    const terminees = analyses.filter(a => a.statut === "termine");
    const scoreSecurite = terminees.length
      ? Math.round(terminees.reduce((sum, a) => sum + (a.score_securite ?? 0), 0) / terminees.length)
      : 0;
    return {
      total: analyses.length,
      depots: new Set(analyses.map(a => a.depot_analyse_id)).size,
      terminees: terminees.length,
      vulns: analyses.reduce((sum, a) => sum + a.nb_vulnerabilites, 0),
      critiques: analyses.reduce((sum, a) => sum + a.nb_critiques, 0),
      securite: scoreSecurite,
    };
  }, [analyses]);

  const scoreColor = (value: number | null) => {
    if (value === null || value === undefined) return "#94a3b8";
    if (value >= 75) return "#10b981";
    if (value >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const statutStyle = (value: string) => {
    if (value === "termine") return { label: "Terminée", color: "#10b981", bg: "rgba(16,185,129,.12)" };
    if (value === "erreur") return { label: "Erreur", color: "#ef4444", bg: "rgba(239,68,68,.12)" };
    if (value === "en_cours") return { label: "En cours", color: "#6366f1", bg: "rgba(99,102,241,.12)" };
    return { label: value || "En attente", color: "#f59e0b", bg: "rgba(245,158,11,.12)" };
  };

  const ouvrirRapport = (analyse: AnalyseGlobale) => {
    sessionStorage.setItem("rapport", JSON.stringify({
      ...analyse,
      analyse_id: analyse.id,
      depot_analyse_id: analyse.depot_analyse_id,
    }));
    sessionStorage.setItem("nomProjet", analyse.depot_nom);
    sessionStorage.setItem("projectUrl", analyse.project_url);
    sessionStorage.setItem("branche", analyse.branche || "main");
    sessionStorage.setItem("autoTests", String(analyse.auto_tests ?? false));
    router.push(`/analyse/rapport?analyse_id=${analyse.id}`);
  };

  const afficherToast = (message: string, ok = true) => {
    setToast({ message, ok });
    window.setTimeout(() => setToast(null), 3500);
  };

  const ouvrirSuppression = (
    event: MouseEvent<HTMLButtonElement>,
    analyse: AnalyseGlobale
  ) => {
    event.stopPropagation();
    setAnalyseASupprimer(analyse);
  };

  const confirmerSuppressionAnalyse = async () => {
    if (!analyseASupprimer) return;
    const idSupprime = analyseASupprimer.id;

    setDeleteLoading(true);
    try {
      await axios.delete(
        `${API}/analyses/historique/mes-analyses/${idSupprime}`,
        { headers: headers() }
      );

      setAnalyses(prev => prev.filter(a => a.id !== idSupprime));
      setAnalyseASupprimer(null);
      afficherToast("Analyse supprimée avec succès.");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      afficherToast(
        typeof detail === "string" ? detail : "Erreur lors de la suppression de l'analyse.",
        false
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const reinitialiserFiltres = () => {
    setSearch("");
    setProjet("tous");
    setBranche("toutes");
    setStatut("tous");
    setRisque("tous");
    setTri("recent");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes rotate { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(9px); } to { opacity:1; transform:none; } }

        .history-page {
          min-height: 100vh;
          background: ${D.bg};
          color: ${D.text};
          font-family: 'Inter', system-ui, sans-serif;
          padding: 27px 38px 46px;
          transition: background .3s ease, color .3s ease;
        }
        .container { max-width: 1480px; margin: 0 auto; }
        .nav {
          display:flex; justify-content:space-between; align-items:center;
          margin-bottom: 22px; gap: 14px;
        }
        .nav-left { display:flex; align-items:center; gap:12px; }
        .logo {
          width:40px;height:40px;border-radius:13px;display:grid;place-items:center;
          background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;
          font-weight:800; box-shadow:0 11px 28px rgba(99,102,241,.27);
        }
        .breadcrumb { font-size:12px; font-weight:750; color:${D.faint}; text-transform:uppercase; letter-spacing:.09em; }
        .nav-actions { display:flex;align-items:center;gap:9px; }
        .btn {
          height:42px;border-radius:12px;padding:0 15px;border:1px solid ${D.border};
          background:${D.card};color:${D.muted};font-weight:650;font-size:13px;cursor:pointer;
          display:inline-flex;align-items:center;gap:7px;transition:.17s ease;
        }
        .btn:hover { transform:translateY(-1px);border-color:rgba(99,102,241,.45);color:#6366f1; }
        .btn.primary {
          color:#fff;border:none;background:linear-gradient(135deg,#6366f1,#7c3aed);
          box-shadow:0 12px 27px rgba(99,102,241,.24);
        }
        .btn.primary:hover { color:#fff; box-shadow:0 15px 34px rgba(99,102,241,.33); }
        .hero {
          background:${D.hero}; border:1px solid ${D.border};
          border-radius:28px;padding:28px 30px;margin-bottom:20px;
          display:flex;justify-content:space-between;align-items:flex-end;gap:20px;
        }
        .tag {
          display:inline-flex;gap:8px;align-items:center;padding:7px 12px;border-radius:100px;
          color:#6366f1;background:${isDark ? "rgba(99,102,241,.14)" : "#eef2ff"};
          font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:13px;
        }
        .hero h1 { font-size:34px;letter-spacing:-.05em;margin:0 0 9px;font-weight:800; }
        .hero h1 span {
          background:linear-gradient(100deg,#6366f1,#8b5cf6);
          -webkit-background-clip:text;color:transparent;
        }
        .hero p { margin:0;color:${D.muted};font-size:14px;line-height:1.65;max-width:660px; }
        .hero-result {
          padding:14px 18px;border-radius:17px;background:${D.card};
          border:1px solid ${D.border};min-width:172px;text-align:center;
        }
        .hero-result strong { display:block;font-size:29px;letter-spacing:-.04em;color:#6366f1; }
        .hero-result span { font-size:11px;color:${D.faint};font-weight:700; }
        .metrics {
          display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px;
        }
        .metric {
          background:${D.card};border:1px solid ${D.border};border-radius:18px;padding:16px 15px;
          transition:.17s ease;
        }
        .metric:hover { transform:translateY(-2px);border-color:rgba(99,102,241,.35); }
        .metric div:first-child { font-size:25px;font-weight:800;letter-spacing:-.045em;margin-bottom:6px; }
        .metric div:last-child { font-size:11px;font-weight:650;color:${D.faint}; }
        .filters {
          padding:17px;background:${D.card};border:1px solid ${D.border};border-radius:20px;
          margin-bottom:21px;
        }
        .filters-top {
          display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;
        }
        .filters-title { font-size:15px;font-weight:730; }
        .filter-grid {
          display:grid;grid-template-columns:2fr repeat(4,1fr) 1.15fr;gap:10px;
        }
        .field { position:relative; }
        .field.search span {
          position:absolute;left:13px;top:50%;transform:translateY(-50%);color:${D.faint};
        }
        .control {
          height:44px;width:100%;padding:0 12px;border:1px solid ${D.border};
          border-radius:12px;background:${D.bg};color:${D.text};font-size:13px;outline:none;
        }
        .field.search .control { padding-left:39px; }
        .control:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.10); }
        .view-switch {
          display:flex;border:1px solid ${D.border};border-radius:11px;padding:3px;background:${D.bg};
        }
        .switch-btn {
          border:0;background:transparent;border-radius:8px;color:${D.faint};
          padding:7px 12px;cursor:pointer;font-weight:650;font-size:12px;
        }
        .switch-btn.active { background:${D.card};color:#6366f1;box-shadow:0 1px 4px rgba(0,0,0,.08); }
        .cards {
          display:grid;grid-template-columns:repeat(auto-fill,minmax(370px,1fr));gap:16px;
        }
        .analysis-card {
          background:${D.card};border:1px solid ${D.border};border-radius:21px;padding:19px;
          cursor:pointer;transition:.17s ease;animation:fadeUp .22s ease both;position:relative;overflow:hidden;
        }
        .analysis-card::before {
          content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
          background:linear-gradient(180deg,#6366f1,#8b5cf6);
        }
        .analysis-card:hover {
          transform:translateY(-3px);border-color:rgba(99,102,241,.38);
          box-shadow:${isDark ? "0 18px 45px rgba(0,0,0,.22)" : "0 18px 42px rgba(15,23,42,.08)"};
        }
        .card-top { display:flex;justify-content:space-between;gap:12px;margin-bottom:14px; }
        .project { min-width:0; }
        .project-name { font-size:15px;font-weight:730;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .project-url {
          color:${D.faint};font-size:11px;font-family:ui-monospace,monospace;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;
        }
        .status-pill {
          border-radius:100px;padding:5px 9px;font-size:10px;font-weight:750;height:fit-content;white-space:nowrap;
        }
        .meta { display:flex;gap:7px;flex-wrap:wrap;margin-bottom:15px; }
        .pill {
          font-size:11px;font-weight:650;color:${D.softText};background:${D.soft};
          border-radius:100px;padding:6px 10px;
        }
        .score-row { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px; }
        .score {
          border:1px solid ${D.border};background:${D.bg};border-radius:13px;padding:10px;text-align:center;
        }
        .score strong { display:block;font-size:20px;line-height:1;font-weight:800; }
        .score span { display:block;margin-top:5px;font-size:10px;color:${D.faint};font-weight:650; }
        .risk {
          padding:10px 12px;border-radius:11px;display:flex;justify-content:space-between;
          align-items:center;font-size:12px;font-weight:650;
        }
        .card-actions { display:flex; gap:8px; margin-top:12px; }
        .card-action {
          flex:1; height:38px; border-radius:11px; font-size:12px; font-weight:700;
          cursor:pointer; border:1px solid ${D.border}; background:${D.bg}; color:${D.muted};
          transition:.16s ease;
        }
        .card-action:hover { transform:translateY(-1px); }
        .card-action.open { color:#6366f1; }
        .card-action.open:hover { border-color:rgba(99,102,241,.40); background:rgba(99,102,241,.08); }
        .card-action.delete { color:#ef4444; }
        .card-action.delete:hover { border-color:rgba(239,68,68,.40); background:rgba(239,68,68,.08); }
        .card-action:disabled { cursor:not-allowed; opacity:.45; transform:none; }
        .table-actions { display:flex; align-items:center; gap:7px; }
        .mini-action {
          border:1px solid ${D.border}; background:${D.bg}; height:34px; padding:0 11px;
          border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; transition:.15s ease;
        }
        .mini-action.open { color:#6366f1; }
        .mini-action.delete { color:#ef4444; }
        .mini-action:hover { transform:translateY(-1px); }
        .mini-action.delete:hover { border-color:rgba(239,68,68,.38); background:rgba(239,68,68,.08); }
        .mini-action:disabled { opacity:.45; cursor:not-allowed; transform:none; }
        .modal-layer {
          position:fixed; inset:0; z-index:1200; padding:20px;
          background:rgba(2,6,23,.62); backdrop-filter:blur(7px);
          display:flex; align-items:center; justify-content:center;
        }
        .delete-modal {
          width:min(465px,100%); background:${D.cardElevated}; border:1px solid ${D.border};
          border-radius:25px; padding:27px; text-align:center;
          box-shadow:0 28px 70px rgba(0,0,0,.27); animation:fadeUp .18s ease;
        }
        .delete-icon {
          width:66px;height:66px;margin:0 auto 16px;border-radius:21px;
          background:rgba(239,68,68,.10);color:#ef4444;
          display:grid;place-items:center;font-size:29px;
        }
        .delete-modal h3 { margin:0 0 8px;font-size:20px;letter-spacing:-.035em; }
        .delete-modal p { margin:0;color:${D.muted};font-size:13px;line-height:1.6; }
        .delete-target {
          background:${D.bg}; border:1px solid ${D.border}; border-radius:13px;
          padding:12px 14px; margin:18px 0; text-align:left;
        }
        .delete-target strong { display:block;font-size:13px;margin-bottom:5px;color:${D.text}; }
        .delete-target span { display:block;font-size:11px;color:${D.faint}; }
        .delete-warning {
          padding:11px 13px;border-radius:12px;text-align:left;
          color:${isDark ? "#fca5a5" : "#b91c1c"}; background:rgba(239,68,68,.08);
          border:1px solid rgba(239,68,68,.23); font-size:12px;line-height:1.55;margin-bottom:19px;
        }
        .modal-buttons { display:flex;gap:10px; }
        .modal-buttons .btn { flex:1;justify-content:center; }
        .danger-btn {
          flex:1;height:42px;border:0;border-radius:12px;background:#ef4444;color:#fff;
          font-size:13px;font-weight:750;cursor:pointer;
        }
        .danger-btn:disabled { opacity:.62;cursor:not-allowed; }
        .toast {
          position:fixed; right:25px; bottom:24px; z-index:1300; color:#fff;
          border-radius:14px; padding:13px 18px; font-size:13px; font-weight:650;
          display:flex; align-items:center; gap:8px; animation:fadeUp .18s ease;
          box-shadow:0 16px 40px rgba(0,0,0,.2);
        }
        .table-wrap { border:1px solid ${D.border};background:${D.card};border-radius:21px;overflow:auto; }
        table { width:100%;border-collapse:collapse;min-width:1080px; }
        th {
          padding:14px 16px;text-align:left;font-size:11px;color:${D.faint};
          font-weight:750;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid ${D.border};
        }
        td { padding:13px 16px;border-bottom:1px solid ${D.border};font-size:13px; }
        tbody tr { cursor:pointer;transition:.13s ease; }
        tbody tr:hover { background:${isDark ? "rgba(99,102,241,.06)" : "#f8faff"}; }
        .empty {
          text-align:center;border:1px dashed ${D.border};background:${D.card};
          border-radius:22px;padding:68px 20px;color:${D.faint};
        }
        .empty strong { display:block;color:${D.text};font-size:18px;margin:13px 0 7px; }
        .spinner {
          width:34px;height:34px;border-radius:50%;border:3px solid ${D.border};
          border-top-color:#6366f1;animation:rotate .65s linear infinite;margin:0 auto 14px;
        }
        @media (max-width:1180px) {
          .metrics { grid-template-columns:repeat(3,1fr); }
          .filter-grid { grid-template-columns:repeat(3,1fr); }
          .field.search { grid-column:span 3; }
        }
        @media (max-width:760px) {
          .history-page { padding:18px 14px 40px; }
          .hero { flex-direction:column;align-items:flex-start;padding:22px; }
          .hero h1 { font-size:28px; }
          .metrics { grid-template-columns:repeat(2,1fr); }
          .filters-top, .nav { flex-direction:column;align-items:flex-start; }
          .filter-grid { grid-template-columns:1fr; }
          .field.search { grid-column:auto; }
          .cards { grid-template-columns:1fr; }
        }
      `}</style>

      <main className="history-page">
        <div className="container">
          <nav className="nav">
            <div className="nav-left">
              <div className="logo">A</div>
              <div className="breadcrumb">AuditIA / Analyses</div>
            </div>
            <div className="nav-actions">
              <ThemeToggle />
              <button className="btn" onClick={() => router.push("/depots")}>← Dépôts</button>
              <button className="btn primary" onClick={() => router.push("/analyse")}>＋ Nouvelle analyse</button>
            </div>
          </nav>

          <section className="hero">
            <div>
              <div className="tag">◎ Historique intelligent</div>
              <h1>Toutes vos <span>analyses IA</span></h1>
              <p>
                Consultez les résultats de tous vos dépôts, filtrez par projet ou branche
                et ouvrez instantanément chaque rapport détaillé.
              </p>
            </div>
            <div className="hero-result">
              <strong>{filtered.length}</strong>
              <span>résultat{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          </section>

          <section className="metrics">
            {[
              { label: "Analyses totales", value: stats.total, color: "#6366f1" },
              { label: "Dépôts couverts", value: stats.depots, color: "#8b5cf6" },
              { label: "Terminées", value: stats.terminees, color: "#10b981" },
              { label: "Score sécurité moy.", value: stats.securite ? `${stats.securite}/100` : "—", color: scoreColor(stats.securite) },
              { label: "Vulnérabilités", value: stats.vulns, color: stats.vulns ? "#f59e0b" : "#10b981" },
              { label: "Critiques", value: stats.critiques, color: stats.critiques ? "#ef4444" : "#10b981" },
            ].map(s => (
              <div className="metric" key={s.label}>
                <div style={{ color: s.color }}>{s.value}</div>
                <div>{s.label}</div>
              </div>
            ))}
          </section>

          <section className="filters">
            <div className="filters-top">
              <div className="filters-title">Filtrer les analyses</div>
              <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                <button className="btn" onClick={reinitialiserFiltres}>Réinitialiser</button>
                <button className="btn" onClick={chargerAnalyses}>↻ Actualiser</button>
                <div className="view-switch">
                  <button className={`switch-btn ${vue === "cartes" ? "active" : ""}`} onClick={() => setVue("cartes")}>▦ Cartes</button>
                  <button className={`switch-btn ${vue === "tableau" ? "active" : ""}`} onClick={() => setVue("tableau")}>☰ Tableau</button>
                </div>
              </div>
            </div>

            <div className="filter-grid">
              <div className="field search">
                <span>⌕</span>
                <input
                  className="control"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nom du projet, URL ou branche..."
                />
              </div>
              <select className="control" value={projet} onChange={e => { setProjet(e.target.value); setBranche("toutes"); }}>
                <option value="tous">Tous les projets</option>
                {projets.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="control" value={branche} onChange={e => setBranche(e.target.value)}>
                <option value="toutes">Toutes les branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select className="control" value={statut} onChange={e => setStatut(e.target.value)}>
                <option value="tous">Tous les statuts</option>
                <option value="termine">Terminées</option>
                <option value="en_cours">En cours</option>
                <option value="erreur">En erreur</option>
              </select>
              <select className="control" value={risque} onChange={e => setRisque(e.target.value)}>
                <option value="tous">Tous les risques</option>
                <option value="critique">Critiques</option>
                <option value="eleve">Hautes sans critique</option>
                <option value="vulnerable">Avec vulnérabilités</option>
                <option value="propre">Code propre</option>
              </select>
              <select className="control" value={tri} onChange={e => setTri(e.target.value as Tri)}>
                <option value="recent">Plus récentes</option>
                <option value="ancien">Plus anciennes</option>
                <option value="securite_asc">Sécurité croissante</option>
                <option value="securite_desc">Sécurité décroissante</option>
                <option value="vulns_desc">Plus vulnérables</option>
              </select>
            </div>
          </section>

          {loading ? (
            <div className="empty">
              <div className="spinner" />
              Chargement des analyses...
            </div>
          ) : erreur ? (
            <div className="empty">
              <div style={{ fontSize: 35 }}>⚠</div>
              <strong>Chargement impossible</strong>
              <div style={{ marginBottom: 18 }}>{erreur}</div>
              <button className="btn primary" onClick={chargerAnalyses}>Réessayer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 38 }}>◎</div>
              <strong>Aucune analyse trouvée</strong>
              <div style={{ marginBottom: 18 }}>
                {analyses.length === 0 ? "Lancez votre première analyse pour alimenter cet historique." : "Aucun résultat ne correspond à vos filtres."}
              </div>
              {analyses.length === 0
                ? <button className="btn primary" onClick={() => router.push("/analyse")}>＋ Nouvelle analyse</button>
                : <button className="btn" onClick={reinitialiserFiltres}>Effacer les filtres</button>}
            </div>
          ) : vue === "cartes" ? (
            <div className="cards">
              {filtered.map((a, index) => {
                const etat = statutStyle(a.statut);
                const critical = a.nb_critiques > 0;
                const danger = a.nb_vulnerabilites > 0;
                return (
                  <article
                    className="analysis-card"
                    key={a.id}
                    style={{ animationDelay: `${index * 20}ms` }}
                    onClick={() => ouvrirRapport(a)}
                  >
                    <div className="card-top">
                      <div className="project">
                        <div className="project-name">📁 {a.depot_nom}</div>
                        <div className="project-url">{a.project_url}</div>
                      </div>
                      <span className="status-pill" style={{ color: etat.color, background: etat.bg }}>{etat.label}</span>
                    </div>

                    <div className="meta">
                      <span className="pill">⎇ {a.branche}</span>
                      <span className="pill">◷ {new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                      {a.modele_llm && <span className="pill">IA {a.modele_llm}</span>}
                    </div>

                    <div className="score-row">
                      {[
                        { label: "Qualité", value: a.score_qualite },
                        { label: "Sécurité", value: a.score_securite },
                        { label: "Performance", value: a.score_performance },
                      ].map(item => (
                        <div className="score" key={item.label}>
                          <strong style={{ color: scoreColor(item.value) }}>{item.value ?? "—"}</strong>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    <div
                      className="risk"
                      style={{
                        color: critical ? "#ef4444" : danger ? "#f59e0b" : "#10b981",
                        background: critical ? "rgba(239,68,68,.10)" : danger ? "rgba(245,158,11,.11)" : "rgba(16,185,129,.10)",
                      }}
                    >
                      <span>
                        {critical
                          ? `⛔ ${a.nb_critiques} critique(s) · ${a.nb_vulnerabilites} vulnérabilité(s)`
                          : danger
                            ? `⚠ ${a.nb_vulnerabilites} vulnérabilité(s)`
                            : "✓ Aucun risque détecté"}
                      </span>
                      <span>Rapport disponible</span>
                    </div>

                    <div className="card-actions">
                      <button
                        className="card-action open"
                        onClick={event => {
                          event.stopPropagation();
                          ouvrirRapport(a);
                        }}
                      >
                        📄 Ouvrir le rapport
                      </button>
                      <button
                        className="card-action delete"
                        disabled={a.statut === "en_cours"}
                        title={a.statut === "en_cours" ? "Une analyse en cours ne peut pas être supprimée." : "Supprimer cette analyse"}
                        onClick={event => ouvrirSuppression(event, a)}
                      >
                        🗑 Supprimer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Projet</th>
                    <th>Branche</th>
                    <th>Date</th>
                    <th>Qualité</th>
                    <th>Sécurité</th>
                    <th>Performance</th>
                    <th>Vulnérabilités</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const etat = statutStyle(a.statut);
                    return (
                      <tr key={a.id} onClick={() => ouvrirRapport(a)}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{a.depot_nom}</div>
                          <div style={{ color: D.faint, fontSize: 11, marginTop: 3 }}>{a.project_url}</div>
                        </td>
                        <td><span className="pill">{a.branche}</span></td>
                        <td style={{ color: D.muted }}>{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                        <td style={{ color: scoreColor(a.score_qualite), fontWeight: 800 }}>{a.score_qualite ?? "—"}</td>
                        <td style={{ color: scoreColor(a.score_securite), fontWeight: 800 }}>{a.score_securite ?? "—"}</td>
                        <td style={{ color: scoreColor(a.score_performance), fontWeight: 800 }}>{a.score_performance ?? "—"}</td>
                        <td style={{ color: a.nb_vulnerabilites ? "#ef4444" : "#10b981", fontWeight: 700 }}>
                          {a.nb_vulnerabilites}
                        </td>
                        <td><span className="status-pill" style={{ color: etat.color, background: etat.bg }}>{etat.label}</span></td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="mini-action open"
                              onClick={event => {
                                event.stopPropagation();
                                ouvrirRapport(a);
                              }}
                            >
                              Ouvrir
                            </button>
                            <button
                              className="mini-action delete"
                              disabled={a.statut === "en_cours"}
                              onClick={event => ouvrirSuppression(event, a)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {analyseASupprimer && (
        <div className="modal-layer" onClick={() => !deleteLoading && setAnalyseASupprimer(null)}>
          <div className="delete-modal" onClick={event => event.stopPropagation()}>
            <div className="delete-icon">🗑</div>
            <h3>Supprimer cette analyse ?</h3>
            <p>Cette opération retire uniquement cette analyse de votre historique.</p>

            <div className="delete-target">
              <strong>{analyseASupprimer.depot_nom}</strong>
              <span>
                Branche {analyseASupprimer.branche} · Analyse du {new Date(analyseASupprimer.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>

            <div className="delete-warning">
              Les scores, vulnérabilités, recommandations, rapports PDF, issues,
              tests et merge requests enregistrés dans l'application pour cette analyse
              seront supprimés définitivement.
            </div>

            <div className="modal-buttons">
              <button className="btn" disabled={deleteLoading} onClick={() => setAnalyseASupprimer(null)}>
                Annuler
              </button>
              <button className="danger-btn" disabled={deleteLoading} onClick={confirmerSuppressionAnalyse}>
                {deleteLoading ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" style={{ background: toast.ok ? "#0f172a" : "#ef4444" }}>
          <span>{toast.ok ? "✓" : "✕"}</span>
          {toast.message}
        </div>
      )}
    </>
  );
}
