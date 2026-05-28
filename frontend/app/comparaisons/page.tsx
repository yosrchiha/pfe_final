"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

interface Depot {
  id: number;
  nom: string;
  project_url: string;
  branche: string;
  created_at: string;
}

interface Analyse {
  id: number;
  statut: string;
  resultat_statut: string;
  score_qualite: number;
  score_securite: number;
  score_performance: number;
  vulnerabilites_count: number;
  mr_created: number;
  mr_url: string | null;
  mr_title: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Comparaison {
  id: number;
  depot_id: number;
  from_branch: string;
  to_branch: string;
  commits_count: number;
  files_json: any;
  created_at: string;
  analyses: Analyse[];
}

export default function ComparaisonsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const D = {
    bg: theme.bg,
    card: theme.bgSecondary,
    border: theme.border,
    text: theme.text,
    muted: theme.textMuted,
    faint: theme.textFaint,
    tag: isDark ? "#1e2538" : "#f1f5f9",
    tagText: isDark ? "#94a3b8" : "#475569",
    btnPrimary: isDark ? "#6366f1" : "#0f172a",
    btnSec: isDark ? "#1e2538" : "#f1f5f9",
    rowHover: isDark ? "#1a2030" : "#faf9fe",
    modalBg: isDark ? "#141921" : "white",
  };

  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [comparaisons, setComparaisons] = useState<Comparaison[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [filterResultat, setFilterResultat] = useState("tous");
  const [selectedComparaison, setSelectedComparaison] = useState<Comparaison | null>(null);
  const [selectedAnalyse, setSelectedAnalyse] = useState<Analyse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    const fetchDepots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }
        const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
        const userId = me.data.id;
        const res = await axios.get(`${API}/depots/user/${userId}`, { headers: getHeaders() });
        setDepots(res.data);
      } catch (e: any) {
        console.error("Erreur chargement dépôts", e);
        if (e.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDepots();
  }, []);

  const fetchComparaisons = async (depot: Depot) => {
    setLoadingDetails(true);
    setSelectedDepot(depot);
    setSelectedComparaison(null);
    setSelectedAnalyse(null);
    try {
      const res = await axios.get(`${API}/comparaisons/depot/${depot.id}`, { headers: getHeaders() });
      const data = res.data;
      
      const comparaisonsWithAnalyses = await Promise.all(
        data.map(async (comp: any) => {
          const analysesRes = await axios.get(`${API}/comparaisons/${comp.id}/analyses`, { headers: getHeaders() });
          return {
            ...comp,
            analyses: analysesRes.data
          };
        })
      );
      
      setComparaisons(comparaisonsWithAnalyses);
    } catch (e) {
      console.error("Erreur chargement comparaisons", e);
      setComparaisons([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDepotClick = (depot: Depot) => {
    fetchComparaisons(depot);
  };

  const handleComparaisonClick = (comparaison: Comparaison, analyse: Analyse) => {
    setSelectedComparaison(comparaison);
    setSelectedAnalyse(analyse);
    setShowDetailModal(true);
  };

  const filteredDepots = depots.filter(depot =>
    depot.nom.toLowerCase().includes(search.toLowerCase()) ||
    depot.project_url.toLowerCase().includes(search.toLowerCase())
  );

  const colorScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const getResultatBadge = (resultat: string) => {
    switch (resultat) {
      case "merge_autorise":
        return { bg: "#ecfdf5", color: "#10b981", icon: "✅", label: "Merge autorisé" };
      case "merge_bloque":
        return { bg: "#fef2f2", color: "#ef4444", icon: "🚫", label: "Merge bloqué" };
      case "aucun_changement":
        return { bg: "#fef3c7", color: "#f59e0b", icon: "○", label: "Aucun changement" };
      default:
        return { bg: D.tag, color: D.muted, icon: "⏳", label: "En cours" };
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(9px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: .52; transform: scale(1); }
          50% { opacity: .78; transform: scale(1.06); }
        }

        .cmp-page {
          min-height: 100vh;
          background: ${D.bg};
          color: ${D.text};
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          position: relative;
          overflow-x: hidden;
          transition: background .28s ease, color .28s ease;
        }
        .cmp-page::before {
          content: "";
          position: fixed;
          width: 560px;
          height: 560px;
          top: -250px;
          right: -160px;
          pointer-events: none;
          border-radius: 999px;
          background: radial-gradient(circle, ${isDark ? "rgba(99,102,241,.17)" : "rgba(99,102,241,.10)"} 0%, transparent 70%);
          animation: pulseSoft 8s ease-in-out infinite;
        }
        .cmp-page::after {
          content: "";
          position: fixed;
          width: 460px;
          height: 460px;
          left: -240px;
          bottom: -220px;
          pointer-events: none;
          border-radius: 999px;
          background: radial-gradient(circle, ${isDark ? "rgba(16,185,129,.11)" : "rgba(16,185,129,.07)"} 0%, transparent 70%);
        }
        .cmp-shell {
          max-width: 1480px;
          margin: 0 auto;
          padding: 28px 38px 46px;
          position: relative;
          z-index: 1;
        }
        .cmp-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 21px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          color: white;
          font-size: 20px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          box-shadow: 0 12px 30px rgba(99,102,241,.26);
        }
        .breadcrumb {
          color: ${D.faint};
          font-size: 11px;
          font-weight: 750;
          letter-spacing: .09em;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .brand-title { color: ${D.text}; font-size: 16px; font-weight: 720; }
        .nav-actions { display: flex; align-items: center; gap: 10px; }
        .soft-btn {
          height: 42px;
          border: 1px solid ${D.border};
          border-radius: 12px;
          padding: 0 16px;
          background: ${D.card};
          color: ${D.muted};
          font-weight: 650;
          cursor: pointer;
          transition: all .16s ease;
        }
        .soft-btn:hover {
          border-color: rgba(99,102,241,.46);
          color: #6366f1;
          transform: translateY(-1px);
        }

        .hero {
          background: ${isDark
            ? "linear-gradient(125deg, rgba(99,102,241,.15), rgba(20,25,33,.95) 48%, rgba(16,185,129,.08))"
            : "linear-gradient(125deg, #eef2ff, #ffffff 52%, #ecfdf5)"};
          border: 1px solid ${D.border};
          border-radius: 29px;
          padding: 29px 31px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          gap: 25px;
          align-items: center;
          overflow: hidden;
          position: relative;
        }
        .hero::after {
          content: "";
          position: absolute;
          right: -80px;
          top: -105px;
          width: 310px;
          height: 310px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,.15), transparent 68%);
        }
        .hero-content { position: relative; z-index: 1; }
        .hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border-radius: 100px;
          background: ${isDark ? "rgba(99,102,241,.15)" : "#eef2ff"};
          color: #6366f1;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 14px;
        }
        .hero h1 {
          font-size: clamp(29px, 3vw, 38px);
          line-height: 1.12;
          letter-spacing: -.05em;
          font-weight: 800;
          margin: 0 0 11px;
        }
        .hero h1 span {
          background: linear-gradient(100deg, #6366f1, #8b5cf6);
          -webkit-background-clip: text;
          color: transparent;
        }
        .hero p {
          max-width: 700px;
          color: ${D.muted};
          margin: 0;
          line-height: 1.7;
          font-size: 14px;
        }
        .hero-flow {
          min-width: 350px;
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .flow-step {
          border: 1px solid ${D.border};
          background: ${D.card};
          border-radius: 16px;
          padding: 14px 11px;
          text-align: center;
        }
        .flow-num {
          width: 27px;
          height: 27px;
          margin: 0 auto 9px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
          background: rgba(99,102,241,.12);
          color: #6366f1;
        }
        .flow-step strong {
          display: block;
          font-size: 11px;
          color: ${D.text};
          line-height: 1.35;
        }
        .flow-step span {
          display: block;
          font-size: 10px;
          color: ${D.faint};
          margin-top: 5px;
        }

        .workspace {
          display: grid;
          grid-template-columns: 315px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        .repo-panel {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 23px;
          padding: 16px;
          position: sticky;
          top: 20px;
          max-height: calc(100vh - 54px);
          display: flex;
          flex-direction: column;
        }
        .panel-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 13px;
        }
        .panel-title strong { font-size: 14px; font-weight: 740; }
        .count {
          background: ${D.tag};
          color: ${D.tagText};
          border-radius: 100px;
          padding: 4px 9px;
          font-size: 11px;
          font-weight: 700;
        }
        .panel-help {
          color: ${D.faint};
          line-height: 1.5;
          font-size: 12px;
          margin-bottom: 14px;
        }
        .search-box { position: relative; margin-bottom: 13px; }
        .search-box span {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: ${D.faint};
        }
        .search-box input {
          height: 43px;
          width: 100%;
          padding: 0 12px 0 38px;
          border: 1px solid ${D.border};
          border-radius: 12px;
          outline: none;
          color: ${D.text};
          background: ${D.bg};
          font-size: 12px;
        }
        .search-box input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,.10);
        }
        .repo-list { overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .repo-card {
          border: 1px solid transparent;
          background: transparent;
          border-radius: 15px;
          padding: 12px;
          cursor: pointer;
          transition: all .16s ease;
          text-align: left;
          color: ${D.text};
        }
        .repo-card:hover {
          background: ${isDark ? "rgba(99,102,241,.07)" : "#f7f7fe"};
          transform: translateX(2px);
        }
        .repo-card.active {
          background: ${isDark ? "rgba(99,102,241,.13)" : "#eef2ff"};
          border-color: rgba(99,102,241,.34);
        }
        .repo-head {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 7px;
        }
        .repo-avatar {
          flex: none;
          width: 33px;
          height: 33px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          color: #6366f1;
          background: ${isDark ? "rgba(99,102,241,.13)" : "#eef2ff"};
        }
        .repo-name {
          font-size: 13px;
          font-weight: 720;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .repo-url {
          color: ${D.faint};
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 7px;
        }
        .repo-date {
          display: inline-flex;
          color: ${D.faint};
          font-size: 10px;
          border-radius: 100px;
          background: ${D.tag};
          padding: 4px 8px;
        }

        .main-panel { min-width: 0; }
        .welcome {
          min-height: 530px;
          border: 1px dashed ${D.border};
          background: ${D.card};
          border-radius: 25px;
          display: grid;
          place-items: center;
          padding: 34px;
          text-align: center;
        }
        .welcome-content { max-width: 670px; }
        .welcome-icon {
          height: 70px;
          width: 70px;
          margin: 0 auto 17px;
          border-radius: 23px;
          display: grid;
          place-items: center;
          font-size: 31px;
          background: ${isDark ? "rgba(99,102,241,.12)" : "#eef2ff"};
        }
        .welcome h2 {
          margin: 0 0 9px;
          font-size: 23px;
          letter-spacing: -.035em;
        }
        .welcome p {
          margin: 0 auto 27px;
          font-size: 13px;
          line-height: 1.68;
          color: ${D.muted};
        }
        .how-it-works {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 11px;
        }
        .how-card {
          border: 1px solid ${D.border};
          background: ${D.bg};
          border-radius: 15px;
          padding: 16px 11px;
        }
        .how-card div:first-child { font-size: 22px; margin-bottom: 9px; }
        .how-card strong { display: block; font-size: 12px; margin-bottom: 5px; }
        .how-card p { margin: 0; font-size: 10px; line-height: 1.5; }

        .selected-header {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 23px;
          padding: 20px 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 14px;
        }
        .selected-header h2 {
          margin: 0 0 6px;
          font-size: 20px;
          font-weight: 750;
          letter-spacing: -.035em;
        }
        .selected-header p {
          font-size: 12px;
          color: ${D.faint};
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, monospace;
        }
        .selected-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: ${D.tag};
          color: ${D.tagText};
          border-radius: 100px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .metric {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 17px;
          padding: 14px 13px;
          transition: .16s ease;
        }
        .metric:hover {
          transform: translateY(-2px);
          border-color: rgba(99,102,241,.35);
        }
        .metric strong {
          display: block;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -.04em;
          margin-bottom: 4px;
        }
        .metric span {
          color: ${D.faint};
          font-size: 10px;
          font-weight: 650;
        }

        .results-panel {
          background: ${D.card};
          border: 1px solid ${D.border};
          border-radius: 23px;
          padding: 18px;
        }
        .results-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
          margin-bottom: 16px;
        }
        .results-toolbar h3 {
          font-size: 15px;
          margin: 0 0 4px;
          font-weight: 730;
        }
        .results-toolbar p {
          font-size: 11px;
          color: ${D.faint};
          margin: 0;
        }
        .filter-select {
          height: 41px;
          padding: 0 13px;
          border: 1px solid ${D.border};
          border-radius: 11px;
          background: ${D.bg};
          color: ${D.text};
          font-size: 12px;
          outline: none;
        }
        .timeline { display: flex; flex-direction: column; gap: 11px; }
        .compare-card {
          border: 1px solid ${D.border};
          background: ${D.bg};
          border-radius: 18px;
          padding: 16px;
          display: grid;
          grid-template-columns: minmax(180px, 1.2fr) minmax(200px, 1fr) 220px 146px;
          gap: 14px;
          align-items: center;
          cursor: pointer;
          transition: all .17s ease;
          animation: fadeUp .2s ease both;
        }
        .compare-card:hover {
          border-color: rgba(99,102,241,.36);
          transform: translateY(-2px);
          box-shadow: ${isDark ? "0 16px 38px rgba(0,0,0,.20)" : "0 14px 30px rgba(15,23,42,.06)"};
        }
        .comparison-date {
          font-size: 11px;
          color: ${D.faint};
          margin-bottom: 8px;
        }
        .branch-path {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
        }
        .branch-pill {
          background: ${D.tag};
          color: #6366f1;
          border-radius: 9px;
          padding: 6px 8px;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10px;
          font-weight: 650;
        }
        .arrow { color: ${D.faint}; font-size: 11px; }
        .impact {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .impact-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: ${D.muted};
        }
        .impact-value { font-weight: 700; color: ${D.text}; }
        .scores {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .score {
          border: 1px solid ${D.border};
          background: ${D.card};
          border-radius: 11px;
          padding: 8px 5px;
          text-align: center;
        }
        .score strong {
          display: block;
          font-size: 16px;
          font-weight: 800;
        }
        .score span {
          font-size: 9px;
          color: ${D.faint};
          font-weight: 650;
        }
        .decision { text-align: right; }
        .decision-badge {
          display: inline-flex;
          gap: 5px;
          align-items: center;
          border-radius: 100px;
          padding: 7px 10px;
          font-size: 10px;
          font-weight: 730;
          margin-bottom: 9px;
        }
        .mr-link {
          display: block;
          color: #6366f1;
          font-size: 11px;
          font-weight: 680;
          text-decoration: none;
        }
        .open-detail {
          display: block;
          font-size: 10px;
          color: ${D.faint};
          margin-top: 7px;
        }
        .results-empty, .results-loading {
          text-align: center;
          padding: 60px 20px;
          color: ${D.faint};
          font-size: 13px;
        }
        .spinner {
          height: 28px;
          width: 28px;
          border-radius: 50%;
          border: 2px solid ${D.border};
          border-top-color: #6366f1;
          animation: spin .62s linear infinite;
          margin: 0 auto 12px;
        }

        .modal-layer {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(2,6,23,.60);
          backdrop-filter: blur(7px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .detail-modal {
          width: min(660px, 100%);
          max-height: 86vh;
          overflow: auto;
          background: ${D.modalBg};
          border: 1px solid ${D.border};
          border-radius: 25px;
          box-shadow: 0 28px 75px rgba(0,0,0,.25);
          animation: fadeUp .2s ease;
        }
        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 22px 24px;
          border-bottom: 1px solid ${D.border};
        }
        .modal-head h3 {
          margin: 0 0 6px;
          font-size: 19px;
          letter-spacing: -.025em;
        }
        .modal-head p {
          margin: 0;
          color: ${D.faint};
          font-size: 12px;
        }
        .close {
          height: 34px;
          width: 34px;
          border-radius: 10px;
          border: 1px solid ${D.border};
          background: ${D.btnSec};
          color: ${D.muted};
          cursor: pointer;
        }
        .modal-body { padding: 22px 24px; }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 11px;
          margin-bottom: 19px;
        }
        .detail-box {
          border: 1px solid ${D.border};
          background: ${D.bg};
          border-radius: 14px;
          padding: 12px;
        }
        .detail-box label {
          display: block;
          color: ${D.faint};
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 7px;
        }
        .detail-box div { font-size: 13px; color: ${D.text}; }
        .modal-scores {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin: 18px 0;
        }
        .modal-score {
          border: 1px solid ${D.border};
          background: ${D.bg};
          border-radius: 14px;
          padding: 13px;
          text-align: center;
        }
        .modal-score strong {
          display: block;
          font-size: 25px;
          font-weight: 800;
        }
        .modal-score span { font-size: 11px; color: ${D.faint}; }
        .warning {
          border-radius: 12px;
          padding: 11px 13px;
          margin: 15px 0;
          background: rgba(239,68,68,.08);
          color: #ef4444;
          font-size: 13px;
          font-weight: 620;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .primary-btn {
          flex: 1;
          border: none;
          height: 43px;
          border-radius: 12px;
          background: linear-gradient(135deg,#6366f1,#7c3aed);
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .secondary-btn {
          flex: 1;
          border: 1px solid ${D.border};
          background: ${D.btnSec};
          color: ${D.muted};
          height: 43px;
          border-radius: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        @media (max-width: 1100px) {
          .cmp-shell { padding: 20px 17px 40px; }
          .hero { flex-direction: column; align-items: flex-start; }
          .hero-flow { min-width: 0; width: 100%; }
          .workspace { grid-template-columns: 1fr; }
          .repo-panel { position: static; max-height: none; }
          .repo-list { max-height: 310px; }
          .metrics { grid-template-columns: repeat(3, 1fr); }
          .compare-card { grid-template-columns: 1fr; }
          .decision { text-align: left; }
        }
        @media (max-width: 650px) {
          .cmp-nav { flex-direction: column; align-items: flex-start; }
          .hero-flow, .how-it-works, .metrics { grid-template-columns: 1fr; }
          .selected-header, .results-toolbar { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <main className="cmp-page">
        <div className="cmp-shell">
          <nav className="cmp-nav">
            <div className="brand">
              <div className="brand-icon">⇄</div>
              <div>
                <div className="breadcrumb">AuditIA / Comparaisons</div>
                <div className="brand-title">Historique des branches analysées</div>
              </div>
            </div>
            <div className="nav-actions">
              <ThemeToggle />
              <button className="soft-btn" onClick={() => router.push("/dashboard")}>
                ← Tableau de bord
              </button>
            </div>
          </nav>

          <section className="hero">
            <div className="hero-content">
              <div className="hero-tag">⇄ Comparaison intelligente</div>
              <h1>Comprendre l'impact d'une <span>branche avant fusion</span></h1>
              <p>
                Cette page retrace vos comparaisons GitLab : branches confrontées, commits
                concernés, décision de fusion issue de l’analyse et Merge Request associée.
              </p>
            </div>
            <div className="hero-flow">
              <div className="flow-step">
                <div className="flow-num">1</div>
                <strong>Sélectionner</strong>
                <span>un dépôt</span>
              </div>
              <div className="flow-step">
                <div className="flow-num">2</div>
                <strong>Examiner</strong>
                <span>les écarts</span>
              </div>
              <div className="flow-step">
                <div className="flow-num">3</div>
                <strong>Décider</strong>
                <span>merge ou blocage</span>
              </div>
            </div>
          </section>

          <div className="workspace">
            <aside className="repo-panel">
              <div className="panel-title">
                <strong>Mes dépôts</strong>
                <span className="count">{filteredDepots.length}</span>
              </div>
              <p className="panel-help">
                Sélectionnez un projet pour consulter l'historique de ses comparaisons.
              </p>
              <div className="search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Rechercher un dépôt..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="repo-list">
                {loading ? (
                  <div className="results-loading">
                    <div className="spinner" />
                    Chargement...
                  </div>
                ) : filteredDepots.length === 0 ? (
                  <div className="results-empty">
                    <div style={{ fontSize: 30, marginBottom: 10 }}>📭</div>
                    Aucun dépôt trouvé
                  </div>
                ) : filteredDepots.map(depot => (
                  <button
                    type="button"
                    className={`repo-card ${selectedDepot?.id === depot.id ? "active" : ""}`}
                    key={depot.id}
                    onClick={() => handleDepotClick(depot)}
                  >
                    <div className="repo-head">
                      <div className="repo-avatar">◈</div>
                      <div className="repo-name">{depot.nom}</div>
                    </div>
                    <div className="repo-url">{depot.project_url}</div>
                    <span className="repo-date">◷ {new Date(depot.created_at).toLocaleDateString("fr-FR")}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="main-panel">
              {!selectedDepot && !loading ? (
                <div className="welcome">
                  <div className="welcome-content">
                    <div className="welcome-icon">⇄</div>
                    <h2>À quoi sert cette page ?</h2>
                    <p>
                      Elle permet de retrouver les comparaisons réalisées entre deux branches
                      d'un projet, de comprendre la décision de l'IA et d'accéder à la
                      Merge Request générée lorsque la fusion est autorisée.
                    </p>
                    <div className="how-it-works">
                      <div className="how-card">
                        <div>📁</div>
                        <strong>Choisissez un dépôt</strong>
                        <p>Depuis la liste à gauche.</p>
                      </div>
                      <div className="how-card">
                        <div>📊</div>
                        <strong>Lisez le résultat</strong>
                        <p>Scores et décision de fusion.</p>
                      </div>
                      <div className="how-card">
                        <div>🔀</div>
                        <strong>Ouvrez la MR</strong>
                        <p>Quand le merge est autorisé.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedDepot && (
                <>
                  <div className="selected-header">
                    <div>
                      <div className="hero-tag" style={{ marginBottom: 9 }}>Projet sélectionné</div>
                      <h2>{selectedDepot.nom}</h2>
                      <p>{selectedDepot.project_url}</p>
                    </div>
                    <span className="selected-chip">⎇ Historique de comparaison</span>
                  </div>

                  <div className="metrics">
                    <div className="metric">
                      <strong style={{ color: "#6366f1" }}>{comparaisons.length}</strong>
                      <span>Comparaisons</span>
                    </div>
                    <div className="metric">
                      <strong style={{ color: "#8b5cf6" }}>
                        {comparaisons.reduce((sum, c) => sum + (c.commits_count || 0), 0)}
                      </strong>
                      <span>Commits comparés</span>
                    </div>
                    <div className="metric">
                      <strong style={{ color: "#10b981" }}>
                        {comparaisons.filter(c => c.analyses?.some(a => a.resultat_statut === "merge_autorise")).length}
                      </strong>
                      <span>Merges autorisés</span>
                    </div>
                    <div className="metric">
                      <strong style={{ color: "#ef4444" }}>
                        {comparaisons.filter(c => c.analyses?.some(a => a.resultat_statut === "merge_bloque")).length}
                      </strong>
                      <span>Merges bloqués</span>
                    </div>
                    <div className="metric">
                      <strong style={{ color: "#f59e0b" }}>
                        {comparaisons.filter(c => c.analyses?.some(a => a.mr_created && a.mr_url)).length}
                      </strong>
                      <span>MR associées</span>
                    </div>
                  </div>

                  <div className="results-panel">
                    <div className="results-toolbar">
                      <div>
                        <h3>Résultats des comparaisons</h3>
                        <p>Ouvrez une comparaison pour consulter les détails de l'analyse.</p>
                      </div>
                      <select
                        className="filter-select"
                        value={filterResultat}
                        onChange={e => setFilterResultat(e.target.value)}
                      >
                        <option value="tous">Tous les résultats</option>
                        <option value="merge_autorise">✅ Merge autorisé</option>
                        <option value="merge_bloque">🚫 Merge bloqué</option>
                        <option value="aucun_changement">○ Aucun changement</option>
                      </select>
                    </div>

                    {loadingDetails ? (
                      <div className="results-loading">
                        <div className="spinner" />
                        Chargement des comparaisons...
                      </div>
                    ) : comparaisons.length === 0 ? (
                      <div className="results-empty">
                        <div style={{ fontSize: 34, marginBottom: 12 }}>🔍</div>
                        Aucune comparaison enregistrée pour ce dépôt.
                      </div>
                    ) : (
                      <div className="timeline">
                        {comparaisons
                          .filter(comp => {
                            const analyse = comp.analyses?.[0];
                            return filterResultat === "tous" || analyse?.resultat_statut === filterResultat;
                          })
                          .map((comp, index) => {
                            const latestAnalyse = comp.analyses?.[0];
                            if (!latestAnalyse) return null;
                            const resultat = getResultatBadge(latestAnalyse.resultat_statut);

                            return (
                              <article
                                className="compare-card"
                                key={comp.id}
                                onClick={() => handleComparaisonClick(comp, latestAnalyse)}
                                style={{ animationDelay: `${index * 22}ms` }}
                              >
                                <div>
                                  <div className="comparison-date">
                                    Analyse du {new Date(comp.created_at).toLocaleDateString("fr-FR")}
                                  </div>
                                  <div className="branch-path">
                                    <span className="branch-pill">{comp.from_branch}</span>
                                    <span className="arrow">→</span>
                                    <span className="branch-pill">{comp.to_branch}</span>
                                  </div>
                                </div>

                                <div className="impact">
                                  <div className="impact-row">
                                    <span>Commits détectés</span>
                                    <span className="impact-value">{comp.commits_count || 0}</span>
                                  </div>
                                  <div className="impact-row">
                                    <span>Vulnérabilités</span>
                                    <span className="impact-value" style={{ color: latestAnalyse.vulnerabilites_count > 0 ? "#ef4444" : "#10b981" }}>
                                      {latestAnalyse.vulnerabilites_count || 0}
                                    </span>
                                  </div>
                                </div>

                                <div className="scores">
                                  {[
                                    { label: "Qualité", value: latestAnalyse.score_qualite },
                                    { label: "Sécurité", value: latestAnalyse.score_securite },
                                    { label: "Perf.", value: latestAnalyse.score_performance },
                                  ].map(score => (
                                    <div className="score" key={score.label}>
                                      <strong style={{ color: colorScore(score.value) }}>{score.value ?? "—"}</strong>
                                      <span>{score.label}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="decision">
                                  <span
                                    className="decision-badge"
                                    style={{ color: resultat.color, background: resultat.bg }}
                                  >
                                    {resultat.icon} {resultat.label}
                                  </span>
                                  {latestAnalyse.mr_created && latestAnalyse.mr_url && (
                                    <a
                                      className="mr-link"
                                      href={latestAnalyse.mr_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      🔀 Voir la MR
                                    </a>
                                  )}
                                  <span className="open-detail">Voir détails →</span>
                                </div>
                              </article>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      {showDetailModal && selectedComparaison && selectedAnalyse && (
        <div className="modal-layer" onClick={() => setShowDetailModal(false)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="hero-tag" style={{ marginBottom: 10 }}>Détail de comparaison</div>
                <h3>Analyse du {new Date(selectedAnalyse.created_at).toLocaleDateString("fr-FR")}</h3>
                <p>Résultat de la comparaison entre branches GitLab</p>
              </div>
              <button className="close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-box">
                  <label>Branches comparées</label>
                  <div className="branch-path">
                    <span className="branch-pill">{selectedComparaison.from_branch}</span>
                    <span className="arrow">→</span>
                    <span className="branch-pill">{selectedComparaison.to_branch}</span>
                  </div>
                </div>
                <div className="detail-box">
                  <label>Commits identifiés</label>
                  <div>{selectedComparaison.commits_count} commit(s)</div>
                </div>
                <div className="detail-box">
                  <label>Décision</label>
                  <span
                    className="decision-badge"
                    style={{
                      marginBottom: 0,
                      ...{
                        color: getResultatBadge(selectedAnalyse.resultat_statut).color,
                        background: getResultatBadge(selectedAnalyse.resultat_statut).bg
                      }
                    }}
                  >
                    {getResultatBadge(selectedAnalyse.resultat_statut).icon} {getResultatBadge(selectedAnalyse.resultat_statut).label}
                  </span>
                </div>
                <div className="detail-box">
                  <label>Vulnérabilités</label>
                  <div style={{ color: selectedAnalyse.vulnerabilites_count > 0 ? "#ef4444" : "#10b981", fontWeight: 700 }}>
                    {selectedAnalyse.vulnerabilites_count > 0
                      ? `⚠ ${selectedAnalyse.vulnerabilites_count} détectée(s)`
                      : "✓ Aucune détectée"}
                  </div>
                </div>
              </div>

              <div className="modal-scores">
                {[
                  { label: "Qualité", value: selectedAnalyse.score_qualite },
                  { label: "Sécurité", value: selectedAnalyse.score_securite },
                  { label: "Performance", value: selectedAnalyse.score_performance },
                ].map(score => (
                  <div className="modal-score" key={score.label}>
                    <strong style={{ color: colorScore(score.value) }}>{score.value ?? "—"}</strong>
                    <span>{score.label}</span>
                  </div>
                ))}
              </div>

              {selectedAnalyse.vulnerabilites_count > 0 && (
                <div className="warning">
                  ⚠ {selectedAnalyse.vulnerabilites_count} vulnérabilité(s) détectée(s) dans cette comparaison.
                </div>
              )}

              {selectedAnalyse.mr_created && selectedAnalyse.mr_url && (
                <div className="detail-box">
                  <label>Merge Request associée</label>
                  <a
                    className="mr-link"
                    href={selectedAnalyse.mr_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🔀 {selectedAnalyse.mr_title || "Voir la MR sur GitLab"} →
                  </a>
                </div>
              )}

              <div className="modal-actions">
                {selectedAnalyse.mr_created && selectedAnalyse.mr_url && (
                  <a
                    className="primary-btn"
                    href={selectedAnalyse.mr_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  >
                    🔀 Ouvrir la Merge Request
                  </a>
                )}
                <button className="secondary-btn" onClick={() => setShowDetailModal(false)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
