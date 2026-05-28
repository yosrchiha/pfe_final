"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

// ── Types ────────────────────────────────────────────────
interface DepotAnalyse {
  id          : number;
  nom         : string;
  project_url : string;
  branche     : string;
  created_at  : string;
}

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

const API = "http://localhost:8000";

export default function DepotsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  // Palettes dynamiques
  const D = {
    bg:         theme.bg,
    card:       theme.bgSecondary,
    border:     theme.border,
    text:       theme.text,
    muted:      theme.textMuted,
    faint:      theme.textFaint,
    tag:        isDark ? "#1e2538" : "#f1f5f9",
    tagText:    isDark ? "#94a3b8" : "#475569",
    btnPrimary: isDark ? "#6366f1" : "#0f172a",
    btnSec:     isDark ? "#1e2538" : "#f1f5f9",
    rowHover:   isDark ? "#1a2030" : "#fef9f5",
    modalBg:    isDark ? "#141921" : "white",
  };

  // États
  const [depots,  setDepots]  = useState<DepotAnalyse[]>([]);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  // Modal analyse / relancer
  const [modalDepot,   setModalDepot]   = useState<DepotAnalyse | null>(null);
  const [modalToken,   setModalToken]   = useState("");
  const [modalError,   setModalError]   = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMode,    setModalMode]    = useState<"analyse" | "relancer">("analyse");

  // Modal MODIFIER
  const [editDepot,      setEditDepot]      = useState<DepotAnalyse | null>(null);
  const [editNom,        setEditNom]        = useState("");
  const [editUrl,        setEditUrl]        = useState("");
  const [editBranche,    setEditBranche]    = useState("");
  const [editLoading,    setEditLoading]    = useState(false);
  const [editError,      setEditError]      = useState("");
  const [editHasWarning, setEditHasWarning] = useState(false);
  const [editConfirmed,  setEditConfirmed]  = useState(false);

  // Modal SUPPRIMER
  const [deleteDepot,   setDeleteDepot]   = useState<DepotAnalyse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Vue analyses
  const [vueAnalyse,    setVueAnalyse]    = useState(false);
  const [analyses,      setAnalyses]      = useState<Analyse[]>([]);
  const [depotVu,       setDepotVu]       = useState<DepotAnalyse | null>(null);
  // analyseDetail supprimé — on navigue vers /analyse/rapport?analyse_id=X
  const [loadingA,      setLoadingA]      = useState(false);

  // Suivi d’une analyse relancée depuis cette page
  const [analyseEnCours, setAnalyseEnCours] = useState<{ id: number; nom: string; etape: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Chargement initial
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
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

  // Ouvrir modal modifier
  const ouvrirEdit = (depot: DepotAnalyse) => {
    setEditDepot(depot);
    setEditNom(depot.nom);
    setEditUrl(depot.project_url);
    setEditBranche(depot.branche);
    setEditError("");
    setEditHasWarning(false);
    setEditConfirmed(false);
  };

  const urlChanged    = editDepot ? editUrl.trim()     !== editDepot.project_url : false;
  const brancheChanged = editDepot ? editBranche.trim() !== editDepot.branche      : false;
  const isCritical    = urlChanged || brancheChanged;

  // Valider modification
  const validerEdit = async () => {
    if (!editDepot) return;
    if (!editNom.trim()) { setEditError("Le nom est requis."); return; }
    if (!editUrl.trim()) { setEditError("L'URL est requise."); return; }
    if (!editBranche.trim()) { setEditError("La branche est requise."); return; }

    if (isCritical && !editConfirmed) {
      setEditHasWarning(true);
      return;
    }

    setEditLoading(true);
    setEditError("");
    try {
      await axios.put(
        `${API}/analyses/depots/${editDepot.id}`,
        { nom: editNom.trim(), project_url: editUrl.trim(), branche: editBranche.trim() },
        { headers: getHeaders() }
      );

      setDepots(prev => prev.map(d =>
        d.id === editDepot.id
          ? { ...d, nom: editNom.trim(), project_url: editUrl.trim(), branche: editBranche.trim() }
          : d
      ));

      setEditDepot(null);
      showToast("Dépôt modifié avec succès.");


    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setEditError(typeof detail === "string" ? detail : "Erreur lors de la modification.");
    } finally {
      setEditLoading(false);
    }
  };

  // Supprimer dépôt
  const confirmerSupprimer = async () => {
    if (!deleteDepot) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/analyses/depots/${deleteDepot.id}`, { headers: getHeaders() });
      setDepots(prev => prev.filter(d => d.id !== deleteDepot.id));
      setDeleteDepot(null);
      showToast("Dépôt et toutes ses analyses supprimés.");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      showToast(typeof detail === "string" ? detail : "Erreur lors de la suppression.", false);
      setDeleteDepot(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Après une relance, suivre le traitement Celery puis ouvrir directement le rapport final.
  const suivreAnalyseRelancee = async (
    analyseId: number,
    depot: DepotAnalyse,
    tokenGitLab: string
  ) => {
    setAnalyseEnCours({ id: analyseId, nom: depot.nom, etape: "Analyse mise en file…" });

    try {
      for (let tentative = 0; tentative < 240; tentative++) {
        const statutRes = await axios.get(`${API}/analyses/${analyseId}/statut`, { headers: getHeaders() });
        const resultat = statutRes.data;
        setAnalyseEnCours({
          id: analyseId,
          nom: depot.nom,
          etape: resultat.etape_courante || resultat.statut || "Traitement en cours…"
        });

        if (resultat.statut === "termine") {
          let issuesList: any[] = [];
          try {
            const issuesRes = await axios.get(`${API}/issues/analyse/${analyseId}`, { headers: getHeaders() });
            issuesList = issuesRes.data || [];
          } catch {
            issuesList = [];
          }

          sessionStorage.setItem("rapport", JSON.stringify({
            ...resultat,
            analyse_id: analyseId,
            depot_analyse_id: depot.id,
            issues_gitlab: issuesList,
          }));
          sessionStorage.setItem("nomProjet", depot.nom);
          sessionStorage.setItem("token", tokenGitLab);
          sessionStorage.setItem("projectUrl", depot.project_url);
          sessionStorage.setItem("branche", depot.branche || "main");
          sessionStorage.setItem("autoTests", "false");
          sessionStorage.setItem("autoMr", "false");

          setAnalyseEnCours(null);
          showToast("Analyse terminée. Ouverture du rapport.");
          router.push(`/analyse/rapport?analyse_id=${analyseId}`);
          return;
        }

        if (resultat.statut === "erreur") {
          throw new Error("L’analyse a échoué côté serveur.");
        }

        await sleep(5000);
      }

      throw new Error("L’analyse prend trop de temps. Vérifiez Celery et Redis.");
    } catch (e: any) {
      setAnalyseEnCours(null);
      showToast(e?.message || "Impossible de suivre l’analyse relancée.", false);
    }
  };

  // Modal analyse / relancer
  const ouvrirModalAnalyse = (depot: DepotAnalyse) => {
    setModalDepot(depot);
    setModalToken("");
    setModalError("");
    setModalMode("analyse");
  };

  const ouvrirModalRelancer = (depot: DepotAnalyse) => {
    setModalDepot(depot);
    setModalToken("");
    setModalError("");
    setModalMode("relancer");
  };

  const validerToken = async () => {
    if (!modalDepot) return;
    if (!modalToken.trim()) {
      setModalError("Le token GitLab est requis");
      return;
    }

    const depotSelectionne = modalDepot;
    const tokenGitLab = modalToken.trim();
    setModalLoading(true);
    setModalError("");

    try {
      if (modalMode === "relancer") {
        const lancement = await axios.post(`${API}/analyses/lancer`, {
          nom_projet    : depotSelectionne.nom,
          gitlab_token  : tokenGitLab,
          project_url   : depotSelectionne.project_url,
          branche       : depotSelectionne.branche,
          owasp_enabled : true,
          auto_tests    : false,
          auto_mr       : false,
          seuil_qualite : 60,
        }, { headers: getHeaders() });

        const nouvelleAnalyseId = lancement.data?.analyse_id;
        if (!nouvelleAnalyseId) {
          throw new Error("L'analyse a été lancée mais aucun identifiant n'a été retourné.");
        }

        setModalDepot(null);
        setModalToken("");
        showToast("Analyse relancée. Préparation du nouveau rapport…");
        void suivreAnalyseRelancee(nouvelleAnalyseId, depotSelectionne, tokenGitLab);
        return;
      }

      setLoadingA(true);
      const res = await axios.get(`${API}/analyses/depot/${depotSelectionne.id}`, { headers: getHeaders() });
      setAnalyses(res.data);
      setDepotVu(depotSelectionne);
      setModalDepot(null);
      setVueAnalyse(true);

    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setModalError(typeof detail === "string" ? detail : (e.message || "Token invalide ou projet introuvable"));
    } finally {
      setModalLoading(false);
      setLoadingA(false);
    }
  };

  const colorScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const colorSeverite = (s: string) => {
    if (s === "CRITIQUE") return "#ef4444";
    if (s === "HAUTE")    return "#f97316";
    if (s === "MOYENNE")  return "#eab308";
    return "#10b981";
  };

  // Style du spinner
  const spinnerStyle = {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: D.border,
    borderTopColor: "#6366f1",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
    margin: "0 auto 12px"
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideToast {
          from { opacity: 0; transform: translateY(12px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: .45; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.08); }
        }

        .depots-modern {
          min-height: 100vh;
          background: ${D.bg};
          color: ${D.text};
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          position: relative;
          overflow-x: hidden;
          transition: background .3s ease, color .3s ease;
        }
        .depots-modern::before {
          content: "";
          position: fixed;
          width: 520px;
          height: 520px;
          right: -180px;
          top: -200px;
          border-radius: 999px;
          background: radial-gradient(circle, ${isDark ? "rgba(99,102,241,.20)" : "rgba(79,70,229,.13)"} 0%, transparent 68%);
          pointer-events: none;
          animation: glowPulse 8s ease-in-out infinite;
        }
        .depots-modern::after {
          content: "";
          position: fixed;
          width: 440px;
          height: 440px;
          left: -220px;
          bottom: -220px;
          border-radius: 999px;
          background: radial-gradient(circle, ${isDark ? "rgba(16,185,129,.12)" : "rgba(16,185,129,.08)"} 0%, transparent 70%);
          pointer-events: none;
        }
        .page-wrap {
          max-width: 1460px;
          margin: 0 auto;
          padding: 32px 42px 54px;
          position: relative;
          z-index: 1;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }
        .brand-line {
          display: flex;
          align-items: center;
          gap: 12px;
          color: ${D.faint};
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
          color: white;
          display: grid;
          place-items: center;
          font-size: 18px;
          box-shadow: 0 12px 30px rgba(99,102,241,.25);
        }
        .top-actions { display: flex; align-items: center; gap: 12px; }
        .hero {
          border: 1px solid ${D.border};
          background: ${D.card};
          border-radius: 28px;
          padding: 30px 32px;
          display: grid;
          grid-template-columns: 1.35fr .9fr;
          gap: 26px;
          margin-bottom: 25px;
          overflow: hidden;
          position: relative;
          box-shadow: ${isDark ? "0 24px 70px rgba(0,0,0,.15)" : "0 20px 60px rgba(15,23,42,.05)"};
        }
        .hero::after {
          content: "";
          position: absolute;
          width: 310px;
          height: 310px;
          right: -80px;
          top: -130px;
          border-radius: 999px;
          background: radial-gradient(circle, ${isDark ? "rgba(99,102,241,.22)" : "rgba(99,102,241,.10)"}, transparent 70%);
        }
        .hero-copy, .hero-panel { position: relative; z-index: 1; }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 100px;
          background: ${isDark ? "rgba(99,102,241,.14)" : "#eef2ff"};
          color: #6366f1;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 16px;
        }
        .hero h1 {
          font-size: clamp(29px, 3vw, 39px);
          line-height: 1.12;
          font-weight: 800;
          letter-spacing: -.045em;
          color: ${D.text};
          margin: 0 0 11px;
        }
        .hero h1 span {
          background: linear-gradient(100deg,#6366f1,#8b5cf6);
          -webkit-background-clip: text;
          color: transparent;
        }
        .hero p {
          font-size: 14px;
          color: ${D.faint};
          line-height: 1.7;
          max-width: 600px;
          margin: 0 0 22px;
        }
        .cta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .primary-btn {
          border: none;
          border-radius: 13px;
          padding: 12px 18px;
          color: #fff;
          background: linear-gradient(135deg,#6366f1,#7c3aed);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          align-items: center;
          transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
          box-shadow: 0 11px 25px rgba(99,102,241,.25);
        }
        .primary-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(99,102,241,.34); }
        .ghost-btn {
          border: 1px solid ${D.border};
          border-radius: 13px;
          padding: 11px 16px;
          color: ${D.muted};
          background: ${D.btnSec};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: .18s ease;
        }
        .ghost-btn:hover { transform: translateY(-1px); border-color: #6366f1; color: #6366f1; }
        .hero-panel {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          align-content: center;
        }
        .metric {
          min-height: 99px;
          padding: 16px;
          border: 1px solid ${D.border};
          background: ${isDark ? "rgba(255,255,255,.025)" : "#ffffff"};
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform .18s ease, border-color .18s ease;
        }
        .metric:hover { transform: translateY(-3px); border-color: rgba(99,102,241,.38); }
        .metric.wide { grid-column: span 2; min-height: 78px; flex-direction: row; align-items: center; }
        .metric-icon {
          font-size: 14px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: ${isDark ? "rgba(99,102,241,.16)" : "#eef2ff"};
        }
        .metric-value { font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: -.04em; }
        .metric-label { color: ${D.faint}; font-size: 11px; font-weight: 600; margin-top: 6px; }
        .content-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 21px;
        }
        .section-heading h2 {
          margin: 0 0 5px;
          font-size: 20px;
          letter-spacing: -.03em;
          font-weight: 750;
        }
        .section-heading p { margin: 0; color: ${D.faint}; font-size: 13px; }
        .search-wrap { position: relative; width: min(390px, 100%); }
        .search-wrap span {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: ${D.faint}; font-size: 15px;
        }
        .search-input {
          width: 100%;
          padding: 13px 16px 13px 43px;
          border: 1px solid ${D.border};
          background: ${D.card};
          color: ${D.text};
          outline: none;
          border-radius: 15px;
          font-size: 13px;
          transition: box-shadow .16s ease, border-color .16s ease;
        }
        .search-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99,102,241,.11);
        }
        .repository-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(375px, 1fr));
          gap: 17px;
        }
        .repo-card {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 22px;
          padding: 20px;
          animation: fadeUp .26s ease both;
          position: relative;
          overflow: hidden;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .repo-card:hover {
          transform: translateY(-4px);
          border-color: rgba(99,102,241,.35);
          box-shadow: ${isDark ? "0 22px 50px rgba(0,0,0,.25)" : "0 18px 44px rgba(15,23,42,.09)"};
        }
        .repo-card::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg,#6366f1,#8b5cf6);
        }
        .repo-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 15px; }
        .repo-identity { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .repo-logo {
          height: 42px; width: 42px; border-radius: 14px;
          background: ${isDark ? "rgba(99,102,241,.15)" : "#eef2ff"};
          color: #6366f1; display: grid; place-items: center; font-size: 18px; flex: none;
        }
        .repo-name { font-size: 15px; font-weight: 700; color: ${D.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .repo-url {
          margin-top: 4px; max-width: 230px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px; color: ${D.faint};
        }
        .status {
          display: inline-flex; align-items: center; gap: 6px;
          border-radius: 100px; padding: 5px 9px;
          color: #10b981; background: ${isDark ? "rgba(16,185,129,.12)" : "#ecfdf5"};
          font-size: 11px; font-weight: 700; white-space: nowrap;
        }
        .status-dot { height: 7px; width: 7px; border-radius: 99px; background: #10b981; }
        .repo-meta {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          border-top: 1px dashed ${D.border};
          border-bottom: 1px dashed ${D.border};
          padding: 12px 0;
          margin-bottom: 15px;
        }
        .chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 10px;
          background: ${D.tag};
          border-radius: 100px;
          color: ${D.tagText};
          font-size: 11px; font-weight: 600;
        }
        .repo-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .repo-action {
          border: 1px solid ${D.border};
          background: ${isDark ? "rgba(255,255,255,.025)" : "#fff"};
          border-radius: 11px;
          padding: 9px 8px;
          cursor: pointer;
          color: ${D.muted};
          font-size: 12px;
          font-weight: 600;
          transition: .16s ease;
        }
        .repo-action:hover { transform: translateY(-1px); }
        .repo-action.view { color: #6366f1; }
        .repo-action.view:hover { background: rgba(99,102,241,.08); border-color: rgba(99,102,241,.35); }
        .repo-action.run { color: #f59e0b; }
        .repo-action.run:hover { background: rgba(245,158,11,.08); border-color: rgba(245,158,11,.35); }
        .repo-action.edit:hover { color: ${D.text}; border-color: ${D.muted}; }
        .repo-action.danger { color: #ef4444; }
        .repo-action.danger:hover { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.35); }
        .empty-box {
          border: 1px dashed ${D.border};
          background: ${D.card};
          border-radius: 25px;
          padding: 62px 24px;
          text-align: center;
        }
        .empty-icon {
          margin: 0 auto 18px; width: 68px; height: 68px; border-radius: 22px;
          background: ${isDark ? "rgba(99,102,241,.12)" : "#eef2ff"};
          display: grid; place-items: center; font-size: 30px;
        }
        .empty-title { font-size: 18px; font-weight: 700; margin-bottom: 7px; }
        .empty-text { font-size: 13px; color: ${D.faint}; margin-bottom: 18px; }
        .loader { text-align:center; padding:68px 20px; color:${D.faint}; }
        .back-row { margin-bottom: 20px; }
        .analysis-banner {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 25px;
          padding: 24px 26px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }
        .analysis-banner h1 { font-size: 25px; margin: 0 0 6px; letter-spacing: -.04em; }
        .analysis-banner p { color: ${D.faint}; font-size: 13px; margin: 0; }
        .analysis-grid {
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(360px,1fr));
          gap: 17px;
        }
        .analysis-card {
          border: 1px solid ${D.border};
          background: ${D.card};
          border-radius: 22px;
          padding: 20px;
          cursor: pointer;
          transition: .18s ease;
        }
        .analysis-card:hover { transform: translateY(-3px); border-color: rgba(99,102,241,.4); box-shadow: 0 18px 38px rgba(15,23,42,.08); }
        .analysis-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:17px; }
        .analysis-date { font-size:12px; color:${D.faint}; }
        .done-chip {
          font-size:11px; padding:5px 11px; border-radius:100px; font-weight:700;
          background: rgba(16,185,129,.11); color:#10b981;
        }
        .score-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:17px; }
        .score-box { border-radius:14px; padding:13px 8px; text-align:center; background:${D.bg}; border:1px solid ${D.border}; }
        .score-val { font-size:22px; font-weight:800; letter-spacing:-.03em; }
        .score-title { margin-top:4px; font-size:10px; color:${D.faint}; font-weight:600; }
        .vuln-banner {
          display:flex; align-items:center; justify-content:space-between;
          font-size:12px; font-weight:600; padding:10px 12px; border-radius:11px;
        }
        .modal-layer {
          position: fixed; inset: 0; background: rgba(2,6,23,.58);
          backdrop-filter: blur(7px);
          display: flex; justify-content: center; align-items: center;
          z-index: 1000; padding: 18px;
        }
        .modal {
          width: min(510px, 100%);
          background: ${D.modalBg};
          border: 1px solid ${D.border};
          border-radius: 25px;
          padding: 26px;
          box-shadow: 0 28px 72px rgba(0,0,0,.25);
          animation: fadeUp .18s ease;
        }
        .modal.danger-modal { width:min(450px,100%); text-align:center; }
        .modal-header { margin-bottom: 19px; }
        .modal-title { font-size: 19px; font-weight: 750; color: ${D.text}; margin-bottom: 5px; letter-spacing: -.025em; }
        .modal-sub { font-size: 12px; color: ${D.faint}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .field { margin-bottom: 14px; }
        .field label {
          display:block; margin-bottom:6px; color:${D.muted}; font-size:11px;
          font-weight:750; text-transform:uppercase; letter-spacing:.065em;
        }
        .field-input {
          width:100%; border:1px solid ${D.border}; border-radius:12px;
          padding:12px 14px; background:${D.card}; color:${D.text}; font-size:13px; outline:none;
        }
        .field-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.10); }
        .changed {
          margin-left:7px; background:rgba(245,158,11,.12); color:#f59e0b;
          padding:2px 7px; border-radius:100px; font-size:10px; text-transform:none;
        }
        .alert-warning {
          background:${isDark ? "rgba(245,158,11,.10)" : "#fffbeb"};
          border:1px solid ${isDark ? "rgba(245,158,11,.25)" : "#fde68a"};
          color:${isDark ? "#fbbf24" : "#92400e"};
          border-radius:13px; padding:12px 13px; margin:4px 0 15px;
          font-size:12px; line-height:1.55;
        }
        .alert-error {
          background:rgba(239,68,68,.09); border:1px solid rgba(239,68,68,.25);
          color:#ef4444; border-radius:11px; padding:10px 12px;
          font-size:12px; margin-bottom:15px;
        }
        .modal-footer { display:flex; gap:10px; margin-top:19px; }
        .modal-footer button { flex:1; }
        .danger-icon {
          width:64px;height:64px;border-radius:22px;margin:0 auto 15px;
          display:grid;place-items:center;font-size:29px;
          background:rgba(239,68,68,.09);
        }
        .danger-copy {
          margin:16px 0 20px; padding:12px 14px; border-radius:12px;
          border:1px solid rgba(239,68,68,.25); background:rgba(239,68,68,.07);
          color:${isDark ? "#fca5a5" : "#b91c1c"}; font-size:12px; line-height:1.6;
        }
        .delete-btn {
          border:0;border-radius:12px;background:#ef4444;color:#fff;
          padding:12px 16px;font-size:13px;font-weight:700;cursor:pointer;
        }
        .analysis-progress {
          display:flex; align-items:center; justify-content:space-between; gap:18px;
          padding:14px 17px; margin-bottom:19px; border-radius:16px;
          border:1px solid rgba(99,102,241,.26);
          background:${isDark ? "rgba(99,102,241,.10)" : "#eef2ff"};
          animation:fadeUp .2s ease;
        }
        .progress-left { display:flex; align-items:center; gap:12px; }
        .progress-loader {
          width:20px; height:20px; border-radius:50%; border:2px solid rgba(99,102,241,.22);
          border-top-color:#6366f1; animation:spin .7s linear infinite; flex:none;
        }
        .progress-title { font-size:13px; font-weight:700; color:${D.text}; }
        .progress-step { font-size:12px; color:${D.faint}; margin-top:3px; }
        .progress-id { font-size:11px; font-weight:700; color:#6366f1; background:${D.card}; padding:6px 10px; border-radius:100px; }
        .toast {
          position:fixed;bottom:25px;right:25px;z-index:1500;
          padding:14px 18px;border-radius:15px;color:#fff;
          font-size:13px;font-weight:600;display:flex;align-items:center;gap:9px;
          background:${toast?.ok ? "#0f172a" : "#ef4444"};
          box-shadow:0 18px 45px rgba(0,0,0,.18);
          animation:slideToast .23s ease;
        }
        @media (max-width: 970px) {
          .page-wrap { padding:22px 18px 44px; }
          .hero { grid-template-columns:1fr; padding:24px; }
          .content-bar { flex-direction:column; align-items:flex-start; }
          .search-wrap { width:100%; }
        }
        @media (max-width: 500px) {
          .repository-grid, .analysis-grid { grid-template-columns:1fr; }
          .hero-panel { grid-template-columns:1fr; }
          .metric.wide { grid-column:auto; }
          .topbar { align-items:flex-start; }
        }
      `}</style>

      <main className="depots-modern">
        <div className="page-wrap">
          <header className="topbar">
            <div className="brand-line">
              <div className="brand-mark">◈</div>
              <span>AuditIA / Dépôts</span>
            </div>
            <div className="top-actions">
              <ThemeToggle />
            </div>
          </header>

          {analyseEnCours && (
            <div className="analysis-progress">
              <div className="progress-left">
                <span className="progress-loader" />
                <div>
                  <div className="progress-title">Relance de l’analyse — {analyseEnCours.nom}</div>
                  <div className="progress-step">{analyseEnCours.etape}</div>
                </div>
              </div>
              <span className="progress-id">#{analyseEnCours.id}</span>
            </div>
          )}

          {!vueAnalyse ? (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="hero-badge">✦ Portfolio d'audits</div>
                  <h1>Pilotez vos projets <span>analysés par IA</span></h1>
                  <p>
                    Visualisez l’historique de vos audits, relancez une analyse et accédez
                    rapidement aux rapports de sécurité de chaque dépôt GitLab.
                  </p>
                  <div className="cta-row">
                    <button className="primary-btn" onClick={() => router.push("/analyse")}>
                      <span>＋</span> Nouvelle analyse
                    </button>
                    <button className="ghost-btn" onClick={() => router.push("/mes-analyses")}>
                      ◎ Toutes les analyses
                    </button>
                    <span className="chip">🔒 GitLab connecté</span>
                  </div>
                </div>

                <div className="hero-panel">
                  <div className="metric">
                    <div className="metric-icon">📁</div>
                    <div>
                      <div className="metric-value" style={{ color: "#6366f1" }}>{depots.length}</div>
                      <div className="metric-label">Projets analysés</div>
                    </div>
                  </div>
                  <div className="metric">
                    <div className="metric-icon">⑂</div>
                    <div>
                      <div className="metric-value" style={{ color: "#8b5cf6" }}>
                        {[...new Set(depots.map(d => d.branche))].length}
                      </div>
                      <div className="metric-label">Branches auditées</div>
                    </div>
                  </div>
                  <div className="metric wide">
                    <div>
                      <div className="metric-value" style={{ color: "#10b981", fontSize: 22 }}>✓ Analyse IA</div>
                      <div className="metric-label">Rapports, scores et vulnérabilités disponibles</div>
                    </div>
                    <div className="status"><span className="status-dot" /> Actif</div>
                  </div>
                </div>
              </section>

              <section>
                <div className="content-bar">
                  <div className="section-heading">
                    <h2>Mes dépôts analysés</h2>
                    <p>{filtered.length} projet{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="search-wrap">
                    <span>⌕</span>
                    <input
                      className="search-input"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher par nom ou URL GitLab..."
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="loader">
                    <div style={spinnerStyle} />
                    Chargement de vos projets...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="empty-box">
                    <div className="empty-icon">📁</div>
                    <div className="empty-title">
                      {depots.length === 0 ? "Aucun dépôt analysé" : "Aucun résultat trouvé"}
                    </div>
                    <div className="empty-text">
                      {depots.length === 0
                        ? "Lancez votre première analyse de code pour voir votre projet apparaître ici."
                        : "Modifiez votre recherche pour retrouver un dépôt."}
                    </div>
                    {depots.length === 0 && (
                      <button className="primary-btn" onClick={() => router.push("/analyse")}>
                        ＋ Lancer une analyse
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="repository-grid">
                    {filtered.map((d, index) => (
                      <article className="repo-card" key={d.id} style={{ animationDelay: `${index * 30}ms` }}>
                        <div className="repo-head">
                          <div className="repo-identity">
                            <div className="repo-logo">◫</div>
                            <div style={{ minWidth: 0 }}>
                              <div className="repo-name">{d.nom}</div>
                              <div className="repo-url" title={d.project_url}>{d.project_url}</div>
                            </div>
                          </div>
                          <div className="status"><span className="status-dot" /> analysé</div>
                        </div>

                        <div className="repo-meta">
                          <span className="chip">⎇ {d.branche}</span>
                          <span className="chip">◷ {new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>

                        <div className="repo-actions">
                          <button className="repo-action view" onClick={() => ouvrirModalAnalyse(d)}>📊 Analyses</button>
                          <button className="repo-action run" onClick={() => ouvrirModalRelancer(d)}>↻ Relancer</button>
                          <button className="repo-action edit" onClick={() => ouvrirEdit(d)}>✏ Modifier</button>
                          <button className="repo-action danger" onClick={() => setDeleteDepot(d)}>🗑 Supprimer</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="back-row">
                <button className="ghost-btn" onClick={() => setVueAnalyse(false)}>← Retour aux projets</button>
              </div>

              <section className="analysis-banner">
                <div>
                  <div className="hero-badge">Rapports disponibles</div>
                  <h1>{depotVu?.nom}</h1>
                  <p>{depotVu?.project_url} · Branche {depotVu?.branche}</p>
                </div>
                <div className="cta-row">
                  <span className="chip">📊 {analyses.length} analyse{analyses.length !== 1 ? "s" : ""}</span>
                  {depotVu && (
                    <button className="primary-btn" onClick={() => ouvrirModalRelancer(depotVu)}>
                      ↻ Relancer
                    </button>
                  )}
                </div>
              </section>

              {loadingA ? (
                <div className="loader">
                  <div style={spinnerStyle} />
                  Chargement des analyses...
                </div>
              ) : analyses.length === 0 ? (
                <div className="empty-box">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-title">Aucune analyse disponible</div>
                  <div className="empty-text">Lancez une analyse pour générer votre premier rapport.</div>
                  <button className="primary-btn" onClick={() => ouvrirModalRelancer(depotVu!)}>
                    Lancer une analyse
                  </button>
                </div>
              ) : (
                <div className="analysis-grid">
                  {analyses.map(a => {
                    const vulnCount = a.vulnerabilites?.length || 0;
                    return (
                      <article
                        key={a.id}
                        className="analysis-card"
                        onClick={() => {
                          sessionStorage.setItem("rapport", JSON.stringify({
                            ...a,
                            analyse_id: a.id,
                            depot_analyse_id: depotVu?.id,
                          }));
                          sessionStorage.setItem("nomProjet", depotVu?.nom || "");
                          sessionStorage.setItem("projectUrl", depotVu?.project_url || "");
                          sessionStorage.setItem("branche", a.branche || depotVu?.branche || "main");
                          sessionStorage.setItem("autoTests", "false");
                          router.push(`/analyse/rapport?analyse_id=${a.id}`);
                        }}
                      >
                        <div className="analysis-top">
                          <span className="analysis-date">Analyse du {new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                          <span className="done-chip">{a.statut === "termine" ? "Terminé" : "En cours"}</span>
                        </div>

                        <div className="score-grid">
                          {[
                            { label: "Qualité", val: a.score_qualite },
                            { label: "Sécurité", val: a.score_securite },
                            { label: "Performance", val: a.score_performance },
                          ].map(s => (
                            <div className="score-box" key={s.label}>
                              <div className="score-val" style={{ color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                              <div className="score-title">{s.label}</div>
                            </div>
                          ))}
                        </div>

                        <div
                          className="vuln-banner"
                          style={{
                            background: vulnCount === 0 ? "rgba(16,185,129,.10)" : "rgba(239,68,68,.09)",
                            color: vulnCount === 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          <span>{vulnCount === 0 ? "✓ Code propre" : `⚠ ${vulnCount} vulnérabilité(s)`}</span>
                          <span>Ouvrir le rapport →</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {editDepot && (
        <div className="modal-layer" onClick={() => setEditDepot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">✏ Modifier le dépôt</div>
              <div className="modal-sub">{editDepot.project_url}</div>
            </div>

            <div className="field">
              <label>Nom du projet</label>
              <input className="field-input" value={editNom} onChange={e => setEditNom(e.target.value)} placeholder="Nom du projet" />
            </div>

            <div className="field">
              <label>
                URL du projet
                {urlChanged && <span className="changed">modifié</span>}
              </label>
              <input
                className="field-input"
                style={{ borderColor: urlChanged ? "#f59e0b" : undefined }}
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                placeholder="namespace/projet"
              />
            </div>

            <div className="field">
              <label>
                Branche
                {brancheChanged && <span className="changed">modifié</span>}
              </label>
              <input
                className="field-input"
                style={{ borderColor: brancheChanged ? "#f59e0b" : undefined }}
                value={editBranche}
                onChange={e => setEditBranche(e.target.value)}
                placeholder="main"
              />
            </div>

            {isCritical && (
              <div className="alert-warning">
                <strong>⚠ Modification importante</strong><br />
                {urlChanged && brancheChanged ? "L’URL et la branche ont changé." : urlChanged ? "L’URL du projet a changé." : "La branche a changé."}
                {" "}Les anciennes analyses resteront accessibles mais pourront ne plus correspondre à la nouvelle configuration.
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, cursor: "pointer", fontWeight: 700 }}>
                  <input type="checkbox" checked={editConfirmed} onChange={e => setEditConfirmed(e.target.checked)} />
                  Je confirme cette modification
                </label>
              </div>
            )}

            {editError && <div className="alert-error">⚠ {editError}</div>}

            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setEditDepot(null)}>Annuler</button>
              <button
                className="primary-btn"
                disabled={editLoading || (isCritical && !editConfirmed)}
                onClick={validerEdit}
                style={{ justifyContent: "center", opacity: editLoading || (isCritical && !editConfirmed) ? .55 : 1 }}
              >
                {editLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDepot && (
        <div className="modal-layer" onClick={() => setDeleteDepot(null)}>
          <div className="modal danger-modal" onClick={e => e.stopPropagation()}>
            <div className="danger-icon">🗑</div>
            <div className="modal-title">Supprimer ce dépôt ?</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 7 }}>{deleteDepot.nom}</div>
            <div className="modal-sub" style={{ marginTop: 5 }}>{deleteDepot.project_url}</div>
            <div className="danger-copy">
              Cette action est irréversible. Toutes les analyses, tests, issues et merge requests associés seront supprimés.
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setDeleteDepot(null)}>Annuler</button>
              <button className="delete-btn" disabled={deleteLoading} onClick={confirmerSupprimer}>
                {deleteLoading ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalDepot && (
        <div className="modal-layer" onClick={() => setModalDepot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="hero-badge" style={{ marginBottom: 12 }}>
                {modalMode === "relancer" ? "Nouvelle exécution" : "Accès sécurisé"}
              </div>
              <div className="modal-title">
                {modalMode === "relancer" ? "Relancer l'analyse" : "Consulter les analyses"}
              </div>
              <div className="modal-sub">{modalDepot.nom} · {modalDepot.project_url}</div>
            </div>

            <div className="field">
              <label>Token GitLab</label>
              <input
                className="field-input"
                type="password"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                value={modalToken}
                onChange={e => setModalToken(e.target.value)}
                onKeyDown={e => e.key === "Enter" && validerToken()}
                autoFocus
                style={{ fontFamily: "ui-monospace, monospace" }}
              />
            </div>
            <p style={{ margin: "-4px 0 18px", color: D.faint, fontSize: 11 }}>
              GitLab → Settings → Access Tokens · scopes : api, read_repository
            </p>

            {modalError && <div className="alert-error">⚠ {modalError}</div>}

            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setModalDepot(null)}>Annuler</button>
              <button
                className="primary-btn"
                disabled={modalLoading}
                onClick={validerToken}
                style={{ justifyContent: "center", opacity: modalLoading ? .6 : 1 }}
              >
                {modalLoading ? "Validation..." : modalMode === "relancer" ? "Lancer l'analyse" : "Valider"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>{toast.ok ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}
    </>
  );
}
