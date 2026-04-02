// frontend/app/analyse/rapport/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function RapportPage() {
  const router = useRouter();

  const [rapport,      setRapport]      = useState<any>(null);
  const [nomProjet,    setNomProjet]    = useState("");
  const [token,        setToken]        = useState("");
  const [projectUrl,   setProjectUrl]   = useState("");
  const [branche,      setBranche]      = useState("");
  const [autoTests,    setAutoTests]    = useState(false);
  const [historique,   setHistorique]   = useState<any[]>([]);
  const [showPopup,    setShowPopup]    = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [resultatMr,   setResultatMr]   = useState<any>(null);
  const [erreur,       setErreur]       = useState("");
  const [activeTab,    setActiveTab]    = useState<"vulns"|"recos">("vulns");

  // ── États chatbot ───────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "assistant", content: string}>>([
    { role: "assistant", content: "👋 Bonjour ! Je suis votre assistant IA. Posez-moi des questions sur ce rapport d'analyse, les vulnérabilités détectées, ou les corrections possibles." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Scroll automatique du chat ──────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Charger les données depuis sessionStorage ──────────
  useEffect(() => {
    const r  = sessionStorage.getItem("rapport");
    const np = sessionStorage.getItem("nomProjet")  || "";
    const t  = sessionStorage.getItem("token")      || "";
    const pu = sessionStorage.getItem("projectUrl") || "";
    const br = sessionStorage.getItem("branche")    || "main";
    const at = sessionStorage.getItem("autoTests")  === "true";

    if (!r) { router.push("/analyse"); return; }

    const data = JSON.parse(r);
    setRapport(data);
    setNomProjet(np);
    setToken(t);
    setProjectUrl(pu);
    setBranche(br);
    setAutoTests(at);

    if (data.depot_analyse_id) {
      axios.get(`${API}/analyses/depot/${data.depot_analyse_id}`)
        .then(res => setHistorique(res.data))
        .catch(() => setHistorique([]));
    }

    if (at) setTimeout(() => setShowPopup(true), 600);
  }, []);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  // ── Exporter en PDF ────────────────────────────────────
  // frontend/app/analyse/rapport/page.tsx

const exporterPDF = async () => {
  const analyseId = rapport?.analyse_id;
  if (!analyseId) {
    setErreur("ID d'analyse manquant");
    return;
  }

  const token = localStorage.getItem("token");
  
  // Utiliser fetch avec header Authorization
  try {
    const response = await fetch(`${API}/analyses/${analyseId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        setErreur("Vous n'avez pas accès à ce rapport");
      } else if (response.status === 404) {
        setErreur("Rapport introuvable");
      } else {
        setErreur("Erreur lors de l'export PDF");
      }
      return;
    }
    
    // Récupérer le blob et créer un lien de téléchargement
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_audit_${nomProjet}_${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (e) {
    console.error("Erreur export PDF", e);
    setErreur("Erreur de connexion");
  }
};

  // ── Générer les tests ──────────────────────────────────
  const genererTests = async (creerMr: boolean) => {
    setShowPopup(false);
    setLoadingTests(true);
    const analyseId = rapport?.analyse_id;
    if (!analyseId) { setErreur("ID analyse manquant"); setLoadingTests(false); return; }

    try {
      const res = await axios.post(
        `${API}/analyses/generer-tests`,
        { analyse_id: analyseId, gitlab_token: token, project_url: projectUrl, branche, creer_mr: creerMr },
        { headers: getHeaders() }
      );
      setResultatMr(res.data);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setErreur(typeof detail === "string" ? detail : "Erreur génération tests");
    } finally {
      setLoadingTests(false);
    }
  };

  // ── Envoyer un message au chatbot ───────────────────────────
  const envoyerMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const context = {
        projet: nomProjet,
        scores: {
          qualite: rapport?.score_qualite,
          securite: rapport?.score_securite,
          performance: rapport?.score_performance
        },
        vulnerabilites: rapport?.vulnerabilites?.slice(0, 5) || [],
        recommandations: rapport?.recommandations?.slice(0, 3) || []
      };

      const res = await axios.post(
        `${API}/chat/ask`,
        {
          question: userMessage,
          contexte: context
        },
        { headers: getHeaders() }
      );

      setChatMessages(prev => [...prev, { role: "assistant", content: res.data.reponse }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "❌ Désolé, une erreur est survenue. Veuillez réessayer."
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      envoyerMessage();
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

  if (!rapport) return null;

  const vulns = rapport.vulnerabilites || [];
  const recos = rapport.recommandations || [];
  const critiques = vulns.filter((v: any) => v.severite === "CRITIQUE").length;
  const hautes    = vulns.filter((v: any) => v.severite === "HAUTE").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          display: flex;
          flex-direction: column;
        }

        /* Topbar (inchangé) */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          background: white;
          border-bottom: 1px solid #eef2ff;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .back-btn {
          background: transparent;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 13px;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .back-btn:hover {
          border-color: #6366f1;
          color: #6366f1;
        }
        .project-title {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
        }
        .project-branch {
          font-size: 12px;
          color: #64748b;
          font-family: monospace;
          margin-top: 2px;
        }
        .topbar-btns {
          display: flex;
          gap: 12px;
        }
        .btn-pdf {
          padding: 8px 18px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .btn-pdf:hover {
          background: #eef2ff;
          border-color: #6366f1;
          color: #6366f1;
        }
        .btn-primary {
          padding: 8px 18px;
          background: #0f172a;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: white;
          transition: all 0.2s;
        }
        .btn-primary:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 30px;
          padding: 5px 14px;
          font-size: 12px;
          color: #10b981;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Steps (inchangé) */
        .steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 20px 28px;
          background: white;
          border-bottom: 1px solid #eef2ff;
        }
        .step {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          background: #eef2ff;
          color: #64748b;
        }
        .step-number.done {
          background: #10b981;
          color: white;
        }
        .step-number.active {
          background: #0f172a;
          color: white;
        }
        .step-label {
          font-size: 12px;
          color: #64748b;
        }
        .step-label.active {
          color: #0f172a;
          font-weight: 500;
        }
        .step-separator {
          width: 40px;
          height: 1px;
          background: #e2e8f0;
        }

        /* Layout 2 colonnes */
        .layout-2cols {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* Colonne gauche - Rapport (inchangé) */
        .rapport-col {
          flex: 2;
          overflow-y: auto;
          padding: 28px;
        }

        /* Colonne droite - Chatbot */
        .chat-col {
          width: 380px;
          background: white;
          border-left: 1px solid #eef2ff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
        }

        /* Scores (inchangé) */
        .scores-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        .score-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 20px;
          padding: 24px;
          text-align: center;
        }
        .score-value {
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .score-label {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .score-bar {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }
        .score-bar-fill {
          height: 4px;
          border-radius: 2px;
        }

        /* Summary chips (inchangé) */
        .summary {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .chip {
          padding: 6px 14px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }
        .chip-critical {
          background: #fef2f2;
          color: #ef4444;
          border: 1px solid #fee2e2;
        }
        .chip-high {
          background: #fff7ed;
          color: #f97316;
          border: 1px solid #ffedd5;
        }
        .chip-default {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        /* Tabs (inchangé) */
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        }
        .tab {
          padding: 10px 20px;
          background: transparent;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }
        .tab.active {
          color: #6366f1;
          border-bottom: 2px solid #6366f1;
        }

        /* Lists (inchangé) */
        .vuln-list, .reco-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .vuln-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 16px;
          padding: 16px;
          border-left: 4px solid;
        }
        .vuln-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .vuln-severity {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 20px;
        }
        .vuln-type {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .vuln-location {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
          margin-bottom: 8px;
        }
        .vuln-suggestion {
          font-size: 12px;
          color: #475569;
          background: #f8fafc;
          padding: 8px 12px;
          border-radius: 10px;
        }
        .reco-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 16px;
          padding: 16px;
        }
        .reco-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .reco-desc {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }
        .clean-badge {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          color: #10b981;
          font-weight: 500;
        }

        /* Sidebar historique (inchangé) */
        .sidebar {
          position: fixed;
          right: 0;
          top: 0;
          width: 320px;
          height: 100vh;
          background: white;
          border-left: 1px solid #eef2ff;
          padding: 24px;
          overflow-y: auto;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          box-shadow: -4px 0 12px rgba(0,0,0,0.05);
          z-index: 20;
        }
        .sidebar.open {
          transform: translateX(0);
        }
        .sidebar-toggle {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 48px;
          height: 48px;
          background: #0f172a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 15;
        }
        .sidebar-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .hist-item {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background 0.2s;
        }
        .hist-item:hover {
          background: #f8fafc;
        }
        .hist-date {
          font-size: 11px;
          color: #94a3b8;
        }
        .hist-branch {
          font-size: 12px;
          font-weight: 500;
          margin: 4px 0;
        }
        .hist-score {
          font-size: 13px;
          font-weight: 600;
        }

        /* Chatbot styles */
        .chat-header {
          padding: 18px 20px;
          border-bottom: 1px solid #eef2ff;
          background: white;
        }
        .chat-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chat-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f8fafc;
        }
        .message {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }
        .message-user {
          align-items: flex-end;
        }
        .message-assistant {
          align-items: flex-start;
        }
        .message-bubble {
          max-width: 90%;
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .message-user .message-bubble {
          background: #6366f1;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .message-assistant .message-bubble {
          background: white;
          border: 1px solid #eef2ff;
          color: #1e293b;
          border-bottom-left-radius: 4px;
        }
        .chat-input-area {
          padding: 16px;
          background: white;
          border-top: 1px solid #eef2ff;
          display: flex;
          gap: 10px;
        }
        .chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
        }
        .chat-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99,102,241,0.1);
        }
        .chat-send {
          padding: 8px 20px;
          background: #6366f1;
          border: none;
          border-radius: 24px;
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chat-send:hover:not(:disabled) {
          background: #4f46e5;
        }
          .btn-feedback {
  padding: 8px 18px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: white;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-feedback:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}
        .chat-send:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }
        .typing {
          display: flex;
          gap: 4px;
          padding: 10px 14px;
          background: white;
          border-radius: 18px;
          width: fit-content;
        }
        .typing-dot {
          width: 8px;
          height: 8px;
          background: #94a3b8;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .suggestions {
          padding: 12px 16px;
          background: white;
          border-top: 1px solid #eef2ff;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .suggestion-btn {
          padding: 5px 12px;
          background: #f1f5f9;
          border: none;
          border-radius: 20px;
          font-size: 11px;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .suggestion-btn:hover {
          background: #e2e8f0;
        }

        /* Popup (inchangé) */
        .popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .popup {
          background: white;
          border-radius: 24px;
          padding: 28px;
          max-width: 480px;
          width: 90%;
        }
        .popup-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .popup-scores {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 20px 0;
        }
        .popup-score {
          text-align: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 12px;
        }
        .popup-score-value {
          font-size: 24px;
          font-weight: 700;
        }
        .popup-buttons {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        /* Notification MR (inchangé) */
        .mr-notif {
          position: fixed;
          bottom: 24px;
          left: 24px;
          background: white;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          border-left: 4px solid #10b981;
          max-width: 360px;
          z-index: 30;
        }

        @media (max-width: 900px) {
          .layout-2cols { flex-direction: column; }
          .chat-col { width: 100%; height: 400px; border-left: none; border-top: 1px solid #eef2ff; }
        }
      `}</style>

      <div className="page">
        {/* Topbar - inchangé */}
        <div className="topbar">
          <div className="topbar-left">
            <button className="back-btn" onClick={() => router.push("/analyse")}>
              ← Nouvelle analyse
            </button>
            <div>
              <div className="project-title">{nomProjet}</div>
              <div className="project-branch">branche : {branche}</div>
            </div>
          </div>
          <div className="topbar-btns">
            <button className="btn-pdf" onClick={exporterPDF}>
              📄 Exporter PDF
            </button>
            <button className="btn-primary" onClick={() => setShowPopup(true)}>
              🧪 Générer les tests
            </button>
            // Dans la section topbar-btns, ajoute ce bouton
<button className="btn-feedback" onClick={() => router.push(`/feedback?analyse_id=${rapport?.analyse_id}&projet=${nomProjet}`)}>
  ⭐ Donner un avis
</button>
          </div>
          <div className="status-badge">
            <div className="status-dot" />
            Analyse terminée
          </div>
        </div>

        {/* Steps - inchangé */}
        <div className="steps">
          <div className="step">
            <div className="step-number done">✓</div>
            <span className="step-label">Formulaire</span>
          </div>
          <div className="step-separator" />
          <div className="step">
            <div className="step-number active">2</div>
            <span className="step-label active">Résultats</span>
          </div>
        </div>

        {/* Layout 2 colonnes */}
        <div className="layout-2cols">

          {/* Colonne gauche - Rapport (inchangé) */}
          <div className="rapport-col">
            {/* Scores */}
            <div className="scores-grid">
              {[
                { label: "Qualité", val: rapport.score_qualite },
                { label: "Sécurité", val: rapport.score_securite },
                { label: "Performance", val: rapport.score_performance },
              ].map(s => (
                <div key={s.label} className="score-card">
                  <div className="score-value" style={{ color: colorScore(s.val) }}>
                    {s.val ?? "—"}
                  </div>
                  <div className="score-label">{s.label}</div>
                  <div className="score-bar">
                    <div className="score-bar-fill" style={{ width: `${s.val ?? 0}%`, background: colorScore(s.val) }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="summary">
              {critiques > 0 && <span className="chip chip-critical">⚠ {critiques} critique{critiques > 1 ? "s" : ""}</span>}
              {hautes > 0 && <span className="chip chip-high">↑ {hautes} haute{hautes > 1 ? "s" : ""}</span>}
              <span className="chip chip-default">{vulns.length} vulnérabilité{vulns.length !== 1 ? "s" : ""}</span>
              <span className="chip chip-default">{recos.length} recommandation{recos.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Erreur */}
            {erreur && (
              <div className="error" style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 12, padding: 12, marginBottom: 20, color: "#ef4444", fontSize: 13 }}>
                ⚠ {erreur}
              </div>
            )}

            {/* Tabs */}
            <div className="tabs">
              <button className={`tab ${activeTab === "vulns" ? "active" : ""}`} onClick={() => setActiveTab("vulns")}>
                Vulnérabilités ({vulns.length})
              </button>
              <button className={`tab ${activeTab === "recos" ? "active" : ""}`} onClick={() => setActiveTab("recos")}>
                Recommandations ({recos.length})
              </button>
            </div>

            {/* Vulnérabilités */}
            {activeTab === "vulns" && (
              vulns.length === 0 ? (
                <div className="clean-badge">✅ Aucune vulnérabilité détectée — Code propre !</div>
              ) : (
                <div className="vuln-list">
                  {vulns.map((v: any, i: number) => (
                    <div key={i} className="vuln-card" style={{ borderLeftColor: colorSeverite(v.severite) }}>
                      <div className="vuln-header">
                        <span className="vuln-severity" style={{ background: `${colorSeverite(v.severite)}15`, color: colorSeverite(v.severite) }}>
                          {v.severite}
                        </span>
                        <span className="vuln-type">{v.type}</span>
                      </div>
                      <div className="vuln-location">📄 {v.fichier} — ligne {v.ligne}</div>
                      <div className="vuln-suggestion">💡 {v.suggestion}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Recommandations */}
            {activeTab === "recos" && (
              recos.length === 0 ? (
                <div className="clean-badge">✅ Aucune recommandation — Code optimal !</div>
              ) : (
                <div className="reco-list">
                  {recos.map((r: any, i: number) => (
                    <div key={i} className="reco-card">
                      <div className="reco-title">✓ {r.titre}</div>
                      <div className="reco-desc">{r.description}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Colonne droite - Chatbot */}
          <div className="chat-col">
            <div className="chat-header">
              <div className="chat-title">
                <span>🤖</span> Assistant IA
              </div>
              <div className="chat-sub">
                Posez vos questions sur l'analyse, les vulnérabilités, ou les corrections
              </div>
            </div>

            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`message message-${msg.role}`}>
                  <div className="message-bubble">{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="message message-assistant">
                  <div className="typing">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="suggestions">
              <button className="suggestion-btn" onClick={() => setChatInput("Explique la vulnérabilité la plus critique")}>
                🔴 Vulnérabilité critique
              </button>
              <button className="suggestion-btn" onClick={() => setChatInput("Comment améliorer le score sécurité ?")}>
                🛡️ Améliorer sécurité
              </button>
              <button className="suggestion-btn" onClick={() => setChatInput("Donne un exemple de correction")}>
                💡 Exemple de correction
              </button>
              <button className="suggestion-btn" onClick={() => setChatInput("C'est quoi OWASP ?")}>
                📖 Qu'est-ce que OWASP ?
              </button>
            </div>

            <div className="chat-input-area">
              <input
                className="chat-input"
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                disabled={chatLoading}
              />
              <button className="chat-send" onClick={envoyerMessage} disabled={chatLoading || !chatInput.trim()}>
                Envoyer
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Historique (inchangé) */}
        <div className="sidebar-toggle" onClick={() => {}}>
          📋
        </div>
        <div className="sidebar">
          <div className="sidebar-title">Historique des analyses</div>
          {historique.length === 0 ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>Aucun historique</div>
          ) : (
            historique.slice(0, 10).map((h: any) => (
              <div key={h.id} className="hist-item" onClick={() => setRapport(h)}>
                <div className="hist-date">{new Date(h.created_at).toLocaleDateString("fr-FR")}</div>
                <div className="hist-branch">{h.branche}</div>
                <div className="hist-score" style={{ color: colorScore(h.score_qualite) }}>
                  Score: {h.score_qualite ?? "—"}/100
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Popup de confirmation - inchangé */}
      {showPopup && (
        <div className="popup-overlay" onClick={() => setShowPopup(false)}>
          <div className="popup" onClick={e => e.stopPropagation()}>
            <div className="popup-title">🧪 Analyse terminée !</div>
            <p style={{ color: "#64748b", fontSize: 13 }}>Voulez-vous générer les tests unitaires pour ce projet ?</p>

            <div className="popup-scores">
              {[
                { label: "Qualité", val: rapport.score_qualite },
                { label: "Sécurité", val: rapport.score_securite },
                { label: "Performance", val: rapport.score_performance },
              ].map(s => (
                <div key={s.label} className="popup-score">
                  <div className="popup-score-value" style={{ color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="popup-buttons">
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => genererTests(true)}>
                ✅ Générer + créer MR
              </button>
              <button className="btn-pdf" style={{ flex: 1 }} onClick={() => genererTests(false)}>
                Sans MR
              </button>
              <button className="btn-pdf" onClick={() => setShowPopup(false)}>✖</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading - inchangé */}
      {loadingTests && (
        <div className="popup-overlay">
          <div className="popup" style={{ textAlign: "center" }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <div style={{ fontWeight: 600 }}>Génération des tests en cours...</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Le LLM analyse tout le code</div>
          </div>
        </div>
      )}

      {/* Notification MR - inchangé */}
      {resultatMr && (
        <div className="mr-notif">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: "#10b981" }}>✅ Tests générés !</span>
            <button onClick={() => setResultatMr(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer" }}>✖</button>
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>🧪 {resultatMr.langage} · {resultatMr.nb_tests} tests</div>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginBottom: 4 }}>📁 {resultatMr.branche}</div>
          {resultatMr.mr && (
            <a href={resultatMr.mr.mr_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#6366f1", textDecoration: "none" }}>
              Voir la MR sur GitLab →
            </a>
          )}
        </div>
      )}
    </>
  );
}