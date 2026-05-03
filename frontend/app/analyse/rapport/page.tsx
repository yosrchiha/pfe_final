"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

// ── Import des composants vidéo ───────────────────────────────────────────────
// Assurez-vous que ces fichiers existent dans votre projet :
// - src/app/components/VideoGeneratorModal.tsx
// - src/app/components/VideoPlayer.tsx
// - src/hooks/useVideoGenerator.ts
import VideoGeneratorModal from "@/app/components/VideoGeneratorModal";

const API = "http://127.0.0.1:8000";

function RapportPage() {
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
    inputBg: isDark ? "#0f1117" : "white",
    stepBg: isDark ? "#1a2030" : "#f1f5f9",
    stepActiveBg: isDark ? "#6366f1" : "#0f172a",
    stepText: isDark ? "#94a3b8" : "#94a3b8",
    chatBg: isDark ? "#0f1117" : "#f8fafc",
    messageBg: isDark ? "#1a2030" : "white",
    messageUserBg: isDark ? "#6366f1" : "#6366f1",
  };

  const [rapport, setRapport] = useState<any>(null);
  const [nomProjet, setNomProjet] = useState("");
  const [token, setToken] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [branche, setBranche] = useState("");
  const [autoTests, setAutoTests] = useState(false);
  const [historique, setHistorique] = useState<any[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [resultatMr, setResultatMr] = useState<any>(null);
  const [erreur, setErreur] = useState("");
  const [activeTab, setActiveTab] = useState<"vulns" | "recos" | "issues">("vulns");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [issuesGitlab, setIssuesGitlab] = useState<any[]>([]);

  // ── TTS State ────────────────────────────────────────────────────────────────
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsLabel, setTtsLabel] = useState("");
  const [ttsLangue, setTtsLangue] = useState<"fr" | "en">("fr");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  // ── Vidéo State ──────────────────────────────────────────────────────────────
  const [showVideoModal, setShowVideoModal] = useState(false);
  // Bouton "Lire la vidéo" directement sur une vulnérabilité (inline)
  const [inlineVideoVulnIndex, setInlineVideoVulnIndex] = useState<number | null>(null);

  // Nettoyage de l'URL blob à la destruction du composant
  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    };
  }, []);

  const lireVulnerabilite = async (vuln: any, id: string) => {
    if (ttsPlaying === id) {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
    setTtsLoading(id);
    setTtsPlaying(null);
    try {
      const jwt = localStorage.getItem("token");
      const response = await fetch(`${API}/tts/vulnerabilite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwt ? `Bearer ${jwt}` : "",
        },
        body: JSON.stringify({
          type_vuln: vuln.type,
          severite: vuln.severite,
          fichier: vuln.fichier,
          ligne: vuln.ligne,
          suggestion: vuln.suggestion,
          langue: ttsLangue,
        }),
      });
      if (!response.ok) throw new Error("Erreur TTS backend");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      audioBlobUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      setTtsLabel(`${vuln.type} — ligne ${vuln.ligne}`);
      setTtsPlaying(id);
      setTtsLoading(null);
      audio.play();
      audio.onended = () => setTtsPlaying(null);
      audio.onerror = () => {
        setTtsPlaying(null);
        setErreur("Erreur lecture audio");
      };
    } catch (e) {
      setTtsLoading(null);
      setErreur("Impossible de générer l'audio TTS");
    }
  };

  const lireResume = async () => {
    if (!rapport) return;
    const vulns = rapport.vulnerabilites || [];
    const critiques = vulns.filter((v: any) => v.severite === "CRITIQUE").length;
    const texte =
      ttsLangue === "fr"
        ? `Résumé de l'analyse du projet ${nomProjet}. ` +
          `Score qualité : ${rapport.score_qualite ?? "non disponible"} sur 100. ` +
          `Score sécurité : ${rapport.score_securite ?? "non disponible"} sur 100. ` +
          `Score performance : ${rapport.score_performance ?? "non disponible"} sur 100. ` +
          `${vulns.length} vulnérabilité${vulns.length !== 1 ? "s" : ""} détectée${vulns.length !== 1 ? "s" : ""}, ` +
          `dont ${critiques} critique${critiques !== 1 ? "s" : ""}. ` +
          (critiques > 0
            ? "Attention, des corrections urgentes sont nécessaires."
            : "Le code ne présente pas de vulnérabilités critiques.")
        : `Analysis summary for project ${nomProjet}. ` +
          `Quality score: ${rapport.score_qualite ?? "N/A"} out of 100. ` +
          `Security score: ${rapport.score_securite ?? "N/A"} out of 100. ` +
          `Performance score: ${rapport.score_performance ?? "N/A"} out of 100. ` +
          `${vulns.length} vulnerabilit${vulns.length !== 1 ? "ies" : "y"} detected, ` +
          `including ${critiques} critical. ` +
          (critiques > 0
            ? "Urgent fixes are required."
            : "No critical vulnerabilities found.");
    await lireTexteLibre(texte, "resume");
  };

  const lireTexteLibre = async (texte: string, id: string) => {
    if (ttsPlaying === id) {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (audioBlobUrlRef.current) { URL.revokeObjectURL(audioBlobUrlRef.current); audioBlobUrlRef.current = null; }
    setTtsLoading(id);
    setTtsPlaying(null);
    try {
      const jwt = localStorage.getItem("token");
      const response = await fetch(`${API}/tts/texte`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwt ? `Bearer ${jwt}` : "",
        },
        body: JSON.stringify({ texte, langue: ttsLangue }),
      });
      if (!response.ok) throw new Error("Erreur TTS backend");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      audioBlobUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      setTtsLabel(ttsLangue === "fr" ? "Résumé du rapport" : "Report summary");
      setTtsPlaying(id);
      setTtsLoading(null);
      audio.play();
      audio.onended = () => setTtsPlaying(null);
      audio.onerror = () => { setTtsPlaying(null); setErreur("Erreur lecture audio"); };
    } catch {
      setTtsLoading(null);
      setErreur("Impossible de générer l'audio TTS");
    }
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    setTtsPlaying(null);
  };
  // ── Fin TTS ──────────────────────────────────────────────────────────────────

  // Chatbot
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant", content: string }>>([
    { role: "assistant", content: "👋 Bonjour ! Je suis votre assistant IA. Posez-moi des questions sur ce rapport d'analyse, les vulnérabilités détectées, ou les corrections possibles." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const searchParams = useSearchParams();

  useEffect(() => {
    const urlAnalyseId = searchParams.get("analyse_id");
    const jwt = localStorage.getItem("token");
    const headers = { Authorization: jwt ? `Bearer ${jwt}` : "" };

    const applyData = (data: any, np: string, t: string, pu: string, br: string, at: boolean) => {
      setRapport(data);
      setNomProjet(np);
      setToken(t);
      setProjectUrl(pu);
      setBranche(br);
      setAutoTests(at);
      if (data.issues_gitlab && data.issues_gitlab.length > 0) {
        setIssuesGitlab(data.issues_gitlab);
      } else if (data.analyse_id) {
        axios.get(`${API}/issues/analyse/${data.analyse_id}`, { headers })
          .then(res => setIssuesGitlab(res.data)).catch(() => {});
      }
      if (data.depot_analyse_id) {
        axios.get(`${API}/analyses/depot/${data.depot_analyse_id}`)
          .then(res => setHistorique(res.data))
          .catch(() => setHistorique([]));
      }
      if (at) setTimeout(() => setShowPopup(true), 600);
    };

    // Cas 1 : vient de la page dépôts via sessionStorage (prioritaire si analyse_id correspond)
    const stored = sessionStorage.getItem("rapport");
    if (stored) {
      const data = JSON.parse(stored);
      // Si le sessionStorage correspond à l'analyse demandée (ou pas de paramètre URL)
      if (!urlAnalyseId || String(data.analyse_id) === urlAnalyseId) {
        applyData(
          data,
          sessionStorage.getItem("nomProjet") || "",
          sessionStorage.getItem("token") || "",
          sessionStorage.getItem("projectUrl") || "",
          sessionStorage.getItem("branche") || "main",
          sessionStorage.getItem("autoTests") === "true"
        );
        return;
      }
    }

    // Cas 2 : chargement direct depuis l'URL ?analyse_id=X (ex: lien partagé ou navigation dépôts)
    if (urlAnalyseId) {
      axios.get(`${API}/analyses/${urlAnalyseId}`, { headers })
        .then(res => {
          const data = { ...res.data, analyse_id: res.data.id };
          // Récupérer infos du dépôt si disponible
          const depotId = data.depot_analyse_id || data.depot_id;
          if (depotId) {
            axios.get(`${API}/analyses/depots/${depotId}`, { headers })
              .then(depotRes => {
                const depot = depotRes.data;
                sessionStorage.setItem("rapport", JSON.stringify(data));
                sessionStorage.setItem("nomProjet", depot.nom || "");
                sessionStorage.setItem("projectUrl", depot.project_url || "");
                sessionStorage.setItem("branche", data.branche || depot.branche || "main");
                sessionStorage.setItem("autoTests", "false");
                applyData(data, depot.nom || "", "", depot.project_url || "", data.branche || depot.branche || "main", false);
              })
              .catch(() => {
                // Dépôt non trouvé, afficher quand même
                sessionStorage.setItem("rapport", JSON.stringify(data));
                applyData(data, `Analyse #${urlAnalyseId}`, "", "", data.branche || "main", false);
              });
          } else {
            sessionStorage.setItem("rapport", JSON.stringify(data));
            applyData(data, `Analyse #${urlAnalyseId}`, "", "", data.branche || "main", false);
          }
        })
        .catch(() => {
          // Analyse introuvable → retour
          router.push("/depots");
        });
      return;
    }

    // Cas 3 : ni sessionStorage ni URL → redirection
    router.push("/analyse");
  }, [searchParams]);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  const exporterPDF = async () => {
    const analyseId = rapport?.analyse_id;
    if (!analyseId) { setErreur("ID d'analyse manquant"); return; }
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${API}/analyses/${analyseId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 403) setErreur("Vous n'avez pas accès à ce rapport");
        else if (response.status === 404) setErreur("Rapport introuvable");
        else setErreur("Erreur lors de l'export PDF");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_audit_${nomProjet}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setErreur("Erreur de connexion");
    }
  };

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

  const envoyerMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const context = {
        projet: nomProjet,
        scores: { qualite: rapport?.score_qualite, securite: rapport?.score_securite, performance: rapport?.score_performance },
        vulnerabilites: rapport?.vulnerabilites?.slice(0, 5) || [],
        recommandations: rapport?.recommandations?.slice(0, 3) || []
      };
      const res = await axios.post(`${API}/chat/ask`, { question: userMessage, contexte: context }, { headers: getHeaders() });
      setChatMessages(prev => [...prev, { role: "assistant", content: res.data.reponse }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Désolé, une erreur est survenue. Veuillez réessayer." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyerMessage(); }
  };

  const [issueLoading, setIssueLoading] = useState<Record<number, boolean>>({});

  const updateIssueStatut = (issueId: number, newStatut: string) => {
    setIssuesGitlab(prev => prev.map(i => i.id === issueId ? { ...i, statut: newStatut } : i));
    const r = sessionStorage.getItem("rapport");
    if (r) {
      const data = JSON.parse(r);
      if (data.issues_gitlab) {
        data.issues_gitlab = data.issues_gitlab.map((i: any) => i.id === issueId ? { ...i, statut: newStatut } : i);
        sessionStorage.setItem("rapport", JSON.stringify(data));
      }
    }
  };

  const closeIssue = async (issueId: number) => {
    setIssueLoading(prev => ({ ...prev, [issueId]: true }));
    try {
      await axios.put(`${API}/issues/${issueId}/close`, {}, { headers: getHeaders() });
      updateIssueStatut(issueId, "closed");
    } catch (e: any) {
      setErreur(e.response?.data?.detail || "Erreur fermeture issue");
    } finally {
      setIssueLoading(prev => ({ ...prev, [issueId]: false }));
    }
  };

  const reopenIssue = async (issueId: number) => {
    setIssueLoading(prev => ({ ...prev, [issueId]: true }));
    try {
      await axios.put(`${API}/issues/${issueId}/reopen`, {}, { headers: getHeaders() });
      updateIssueStatut(issueId, "opened");
    } catch (e: any) {
      setErreur(e.response?.data?.detail || "Erreur réouverture issue");
    } finally {
      setIssueLoading(prev => ({ ...prev, [issueId]: false }));
    }
  };

  const syncIssue = async (issueId: number) => {
    setIssueLoading(prev => ({ ...prev, [issueId]: true }));
    try {
      const res = await axios.patch(`${API}/issues/${issueId}/sync`, {}, { headers: getHeaders() });
      updateIssueStatut(issueId, res.data.statut);
    } catch (e: any) {
      setErreur(e.response?.data?.detail || "Erreur synchronisation issue");
    } finally {
      setIssueLoading(prev => ({ ...prev, [issueId]: false }));
    }
  };

  const syncAllIssues = async () => {
    for (const issue of issuesGitlab) await syncIssue(issue.id);
  };

  const colorScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const colorSeverite = (s: string) => {
    if (s === "CRITIQUE") return "#ef4444";
    if (s === "HAUTE") return "#f97316";
    if (s === "MOYENNE") return "#eab308";
    return "#10b981";
  };

  if (!rapport) return null;

  const vulns = rapport.vulnerabilites || [];
  const recos = rapport.recommandations || [];
  const critiques = vulns.filter((v: any) => v.severite === "CRITIQUE").length;
  const hautes = vulns.filter((v: any) => v.severite === "HAUTE").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-5px); opacity: 1; } }
        @keyframes tts-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 0 6px rgba(99,102,241,0); } }
        @keyframes video-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }

        .tts-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid rgba(99,102,241,0.3);
          background: rgba(99,102,241,0.08);
          color: #6366f1;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .tts-btn:hover { background: rgba(99,102,241,0.15); }
        .tts-btn.playing { background: rgba(99,102,241,0.2); animation: tts-pulse 1.5s infinite; }
        .tts-btn:disabled { opacity: 0.5; cursor: wait; }

        /* Bouton vidéo inline sur une vulnérabilité */
        .video-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid rgba(16,185,129,0.3);
          background: rgba(16,185,129,0.08);
          color: #10b981;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .video-btn:hover { background: rgba(16,185,129,0.15); }

        /* Mini lecteur TTS flottant */
        .tts-player {
          position: fixed;
          bottom: 80px;
          left: 24px;
          background: ${D.card};
          border: 1px solid rgba(99,102,241,0.35);
          border-radius: 16px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          z-index: 25;
          animation: slide-up 0.25s ease;
          max-width: 340px;
        }
        .tts-wave span {
          display: inline-block;
          width: 3px;
          height: 14px;
          border-radius: 2px;
          background: #6366f1;
          animation: wave 0.8s ease-in-out infinite;
        }
        .tts-wave span:nth-child(2) { animation-delay: 0.1s; }
        .tts-wave span:nth-child(3) { animation-delay: 0.2s; }
        .tts-wave span:nth-child(4) { animation-delay: 0.1s; }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }

        /* Bouton "Lire la vidéo" dans la topbar */
        .video-topbar-btn {
          padding: 8px 16px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.35);
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #10b981;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .video-topbar-btn:hover {
          background: rgba(16,185,129,0.15);
          border-color: rgba(16,185,129,0.5);
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", flexDirection: "column" }}>

        {/* ── Topbar ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", background: D.card, borderBottom: `1px solid ${D.border}`, position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => router.push("/analyse")} style={{ background: "transparent", border: `1px solid ${D.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: D.muted }}>
              ← Nouvelle analyse
            </button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: D.text }}>{nomProjet}</div>
              <div style={{ fontSize: 12, color: D.faint, fontFamily: "monospace", marginTop: 2 }}>branche : {branche}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <ThemeToggle />

            {/* Sélecteur de langue TTS/Vidéo */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: D.tag, border: `1px solid ${D.border}`, borderRadius: 10, padding: "6px 10px" }}>
              <span style={{ fontSize: 11, color: D.faint }}>🔊</span>
              <select
                value={ttsLangue}
                onChange={e => setTtsLangue(e.target.value as "fr" | "en")}
                style={{ background: "transparent", border: "none", fontSize: 12, color: D.text, cursor: "pointer", outline: "none" }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Bouton "Lire le résumé" (TTS) */}
            <button
              onClick={lireResume}
              disabled={ttsLoading === "resume"}
              style={{
                padding: "8px 16px",
                background: ttsPlaying === "resume" ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.35)",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                cursor: ttsLoading === "resume" ? "wait" : "pointer",
                color: "#6366f1",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: ttsLoading === "resume" ? 0.6 : 1,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {ttsLoading === "resume" ? (
                <><span style={{ width: 14, height: 14, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />Génération…</>
              ) : ttsPlaying === "resume" ? (
                <>⏹ Arrêter</>
              ) : (
                <>🔊 Lire le résumé</>
              )}
            </button>

            {/* ── NOUVEAU : Bouton "Lire la vidéo" ── */}
            <button
              className="video-topbar-btn"
              onClick={() => setShowVideoModal(true)}
            >
              🎬 {ttsLangue === "fr" ? "Voir la vidéo" : "Watch Video"}
            </button>

            <button onClick={exporterPDF} style={{ padding: "8px 18px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted, fontFamily: "'Inter', sans-serif" }}>
              📄 Exporter PDF
            </button>
            <button onClick={() => setShowPopup(true)} style={{ padding: "8px 18px", background: D.btnPrimary, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white", fontFamily: "'Inter', sans-serif" }}>
              🧪 Générer les tests
            </button>
            <button onClick={() => router.push(`/feedback?analyse_id=${rapport?.analyse_id}&projet=${nomProjet}`)} style={{ padding: "8px 18px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Inter', sans-serif" }}>
              ⭐ Donner un avis
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: D.tag, border: `1px solid ${D.border}`, borderRadius: 30, padding: "5px 14px", fontSize: 12, color: "#10b981" }}>
            <div style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%", animation: "pulse 2s infinite" }} />
            Analyse terminée
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "20px 28px", background: D.card, borderBottom: `1px solid ${D.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, background: "#10b981", color: "white" }}>✓</div>
            <span style={{ fontSize: 12, color: D.muted }}>Formulaire</span>
          </div>
          <div style={{ width: 40, height: 1, background: D.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, background: D.stepActiveBg, color: "white" }}>2</div>
            <span style={{ fontSize: 12, color: D.text, fontWeight: 500 }}>Résultats</span>
          </div>
        </div>

        {/* ── Bannière vidéo rapport (si des vulnérabilités critiques existent) ── */}
        {critiques > 0 && (
          <div style={{
            margin: "0",
            padding: "12px 28px",
            background: isDark
              ? "linear-gradient(90deg, rgba(16,185,129,0.07) 0%, rgba(99,102,241,0.07) 100%)"
              : "linear-gradient(90deg, rgba(16,185,129,0.05) 0%, rgba(99,102,241,0.05) 100%)",
            borderBottom: `1px solid ${D.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🎬</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>
                  {ttsLangue === "fr"
                    ? `${critiques} vulnérabilité${critiques > 1 ? "s" : ""} critique${critiques > 1 ? "s" : ""} détectée${critiques > 1 ? "s" : ""}`
                    : `${critiques} critical vulnerabilit${critiques > 1 ? "ies" : "y"} detected`}
                </span>
                <span style={{ fontSize: 12, color: D.faint, marginLeft: 8 }}>
                  {ttsLangue === "fr"
                    ? "— Regardez la vidéo explicative pour comprendre et corriger"
                    : "— Watch the explanatory video to understand and fix them"}
                </span>
              </div>
            </div>
            <button
              className="video-topbar-btn"
              onClick={() => setShowVideoModal(true)}
              style={{ flexShrink: 0 }}
            >
              🎬 {ttsLangue === "fr" ? "Voir la vidéo du rapport" : "Watch report video"}
            </button>
          </div>
        )}

        {/* Layout 2 colonnes */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── Colonne gauche ─────────────────────────────────────────────── */}
          <div style={{ flex: 2, overflowY: "auto", padding: 28 }}>

            {/* Scores */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
              {[
                { label: "Qualité", val: rapport.score_qualite },
                { label: "Sécurité", val: rapport.score_securite },
                { label: "Performance", val: rapport.score_performance },
              ].map(s => (
                <div key={s.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 8, color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                  <div style={{ fontSize: 13, color: D.faint, marginBottom: 12 }}>{s.label}</div>
                  <div style={{ height: 4, background: D.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${s.val ?? 0}%`, height: 4, borderRadius: 2, background: colorScore(s.val) }} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Bloc vidéo résumé (card dédiée) ── */}
            <div style={{
              background: D.card,
              border: `1px solid rgba(16,185,129,0.25)`,
              borderRadius: 20,
              padding: "20px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Icône animée */}
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}>
                  🎬
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 4 }}>
                    {ttsLangue === "fr" ? "Vidéos explicatives" : "Explanatory Videos"}
                  </div>
                  <div style={{ fontSize: 12, color: D.faint, lineHeight: 1.5 }}>
                    {ttsLangue === "fr"
                      ? "Générez une vidéo HD de présentation, de rapport ou d'explication de vulnérabilité — avec narration IA automatique."
                      : "Generate an HD presentation, report, or vulnerability explanation video — with automatic AI narration."}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
                {/* Bouton rapport vidéo */}
                <button
                  onClick={() => setShowVideoModal(true)}
                  style={{
                    padding: "10px 20px",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.35)",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  📊 {ttsLangue === "fr" ? "Vidéo du rapport" : "Report video"}
                </button>
                {/* Bouton présentation app */}
                <button
                  onClick={() => setShowVideoModal(true)}
                  style={{
                    padding: "10px 20px",
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#6366f1",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  🎬 {ttsLangue === "fr" ? "Présentation app" : "App presentation"}
                </button>
              </div>
            </div>

            {/* Summary badges */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              {critiques > 0 && <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: "rgba(239,68,68,0.15)", color: "#ef4444", border: `1px solid rgba(239,68,68,0.3)` }}>⚠ {critiques} critique{critiques > 1 ? "s" : ""}</span>}
              {hautes > 0 && <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: "rgba(249,115,22,0.15)", color: "#f97316", border: `1px solid rgba(249,115,22,0.3)` }}>↑ {hautes} haute{hautes > 1 ? "s" : ""}</span>}
              <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: D.tag, color: D.tagText, border: `1px solid ${D.border}` }}>{vulns.length} vulnérabilité{vulns.length !== 1 ? "s" : ""}</span>
              <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: D.tag, color: D.tagText, border: `1px solid ${D.border}` }}>{recos.length} recommandation{recos.length !== 1 ? "s" : ""}</span>
            </div>

            {erreur && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 12, padding: 12, marginBottom: 20, color: "#ef4444", fontSize: 13 }}>
                ⚠ {erreur}
                <button onClick={() => setErreur("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", marginLeft: 8, fontSize: 14 }}>✖</button>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${D.border}` }}>
              <button onClick={() => setActiveTab("vulns")} style={{ padding: "10px 20px", background: "transparent", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", color: activeTab === "vulns" ? "#6366f1" : D.muted, borderBottom: activeTab === "vulns" ? `2px solid #6366f1` : "none" }}>
                Vulnérabilités ({vulns.length})
              </button>
              <button onClick={() => setActiveTab("recos")} style={{ padding: "10px 20px", background: "transparent", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", color: activeTab === "recos" ? "#6366f1" : D.muted, borderBottom: activeTab === "recos" ? `2px solid #6366f1` : "none" }}>
                Recommandations ({recos.length})
              </button>
              <button onClick={() => setActiveTab("issues")} style={{ padding: "10px 20px", background: "transparent", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", color: activeTab === "issues" ? "#6366f1" : D.muted, borderBottom: activeTab === "issues" ? `2px solid #6366f1` : "none", display: "flex", alignItems: "center", gap: 6 }}>
                🐛 Issues GitLab
                {issuesGitlab.length > 0 && (
                  <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>
                    {issuesGitlab.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── Vulnérabilités ── */}
            {activeTab === "vulns" && (
              vulns.length === 0 ? (
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20, textAlign: "center", color: "#10b981", fontWeight: 500 }}>
                  ✅ Aucune vulnérabilité détectée — Code propre !
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {vulns.map((v: any, i: number) => {
                    const vid = `vuln-${i}`;
                    const isLoadingThis = ttsLoading === vid;
                    const isPlayingThis = ttsPlaying === vid;
                    const isVideoOpen = inlineVideoVulnIndex === i;

                    return (
                      <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 16, borderLeft: `4px solid ${colorSeverite(v.severite)}` }}>
                        {/* En-tête de la carte vulnérabilité */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: `${colorSeverite(v.severite)}15`, color: colorSeverite(v.severite) }}>{v.severite}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: D.text, flex: 1 }}>{v.type}</span>

                          {/* Bouton TTS */}
                          <button
                            className={`tts-btn${isPlayingThis ? " playing" : ""}`}
                            onClick={() => lireVulnerabilite(v, vid)}
                            disabled={!!ttsLoading && !isLoadingThis}
                            title={isPlayingThis ? "Stopper l'audio" : "Lire l'explication audio"}
                          >
                            {isLoadingThis ? (
                              <span style={{ width: 11, height: 11, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                            ) : isPlayingThis ? "⏹" : "🔊"}
                            {isLoadingThis ? " Chargement…" : isPlayingThis ? " Arrêter" : " Écouter"}
                          </button>

                          {/* ── NOUVEAU : Bouton vidéo inline ── */}
                          <button
                            className="video-btn"
                            onClick={() => setInlineVideoVulnIndex(isVideoOpen ? null : i)}
                            title={isVideoOpen ? "Masquer la vidéo" : "Générer la vidéo explicative"}
                          >
                            {isVideoOpen ? "⏹ Fermer vidéo" : "🎬 Voir vidéo"}
                          </button>
                        </div>

                        <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace", marginBottom: 8 }}>📄 {v.fichier} — ligne {v.ligne}</div>
                        <div style={{ fontSize: 12, color: D.muted, background: D.bg, padding: "8px 12px", borderRadius: 10 }}>💡 {v.suggestion}</div>

                        {/* ── NOUVEAU : Modal vidéo inline (s'affiche sous la carte) ── */}
                        {isVideoOpen && (
                          <div style={{
                            marginTop: 16,
                            borderTop: `1px solid ${D.border}`,
                            paddingTop: 16,
                            animation: "slide-up 0.25s ease",
                          }}>
                            <VideoGeneratorModal
                              rapport={rapport}
                              nomProjet={nomProjet}
                              isDark={isDark}
                              ttsLangue={ttsLangue}
                              // On pré-sélectionne la vulnérabilité correspondante
                              // VideoGeneratorModal doit être en mode "inline" pour ça,
                              // sinon utilisez le modal principal (setShowVideoModal(true))
                              onClose={() => setInlineVideoVulnIndex(null)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Recommandations */}
            {activeTab === "recos" && (
              recos.length === 0 ? (
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20, textAlign: "center", color: "#10b981", fontWeight: 500 }}>
                  ✅ Aucune recommandation — Code optimal !
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {recos.map((r: any, i: number) => (
                    <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#10b981", marginBottom: 6 }}>✓ {r.titre}</div>
                      <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.5 }}>{r.description}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Issues GitLab */}
            {activeTab === "issues" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {issuesGitlab.length === 0 ? (
                  <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 24, textAlign: "center", color: "#10b981", fontWeight: 500 }}>
                    ✅ Aucune issue GitLab créée pour cette analyse
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: D.muted, fontWeight: 500 }}>{issuesGitlab.length} issue{issuesGitlab.length !== 1 ? "s" : ""}</span>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>🟢 {issuesGitlab.filter((i: any) => i.statut === "opened").length} ouverte{issuesGitlab.filter((i: any) => i.statut === "opened").length !== 1 ? "s" : ""}</span>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(148,163,184,0.15)", color: D.muted }}>✖ {issuesGitlab.filter((i: any) => i.statut === "closed").length} fermée{issuesGitlab.filter((i: any) => i.statut === "closed").length !== 1 ? "s" : ""}</span>
                      </div>
                      <button onClick={syncAllIssues} style={{ padding: "6px 14px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", color: D.muted, display: "flex", alignItems: "center", gap: 6 }}>
                        🔄 Sync depuis GitLab
                      </button>
                    </div>

                    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
                      {issuesGitlab.map((issue: any, i: number) => {
                        const sc = colorSeverite(issue.severite);
                        const isClosed = issue.statut === "closed";
                        const isLoading = issueLoading[issue.id];
                        return (
                          <div key={issue.id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i < issuesGitlab.length - 1 ? `1px solid ${D.border}` : "none", borderLeft: `4px solid ${isClosed ? D.border : sc}`, opacity: isClosed ? 0.72 : 1, transition: "opacity 0.2s" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 20, flexShrink: 0, letterSpacing: "0.04em", background: `${sc}18`, color: isClosed ? D.muted : sc, border: `1px solid ${sc}40`, textDecoration: isClosed ? "line-through" : "none" }}>{issue.severite}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: isClosed ? "line-through" : "none", opacity: isClosed ? 0.7 : 1 }}>{issue.titre}</div>
                              <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace" }}>📄 {issue.fichier}{issue.ligne ? ` — ligne ${issue.ligne}` : ""}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0, background: isClosed ? "rgba(148,163,184,0.15)" : "rgba(16,185,129,0.12)", color: isClosed ? D.muted : "#10b981", border: `1px solid ${isClosed ? D.border : "rgba(16,185,129,0.3)"}` }}>{isClosed ? "✖ fermée" : "🟢 ouverte"}</span>
                            {issue.issue_url && (
                              <a href={issue.issue_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#6366f1", textDecoration: "none", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>🔗 GitLab</a>
                            )}
                            <button onClick={() => syncIssue(issue.id)} disabled={!!isLoading} style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 8, background: D.tag, border: `1px solid ${D.border}`, fontSize: 13, cursor: isLoading ? "wait" : "pointer", color: D.muted, opacity: isLoading ? 0.5 : 1 }}>{isLoading ? "⏳" : "🔄"}</button>
                            {isClosed ? (
                              <button onClick={() => reopenIssue(issue.id)} disabled={!!isLoading} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 12, fontWeight: 600, cursor: isLoading ? "wait" : "pointer", color: "#10b981", opacity: isLoading ? 0.5 : 1 }}>↩ Rouvrir</button>
                            ) : (
                              <button onClick={() => closeIssue(issue.id)} disabled={!!isLoading} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12, fontWeight: 600, cursor: isLoading ? "wait" : "pointer", color: "#ef4444", opacity: isLoading ? 0.5 : 1 }}>✖ Fermer</button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 14, padding: "12px 16px", background: isDark ? "rgba(99,102,241,0.07)" : "#f0f4ff", border: `1px solid rgba(99,102,241,0.2)`, borderRadius: 12, fontSize: 11, color: D.muted, lineHeight: 1.6 }}>
                      ℹ️ <strong>Synchronisation automatique :</strong> Pour que GitLab notifie l'app automatiquement (sans cliquer 🔄), configurez un webhook dans votre projet GitLab :<br />
                      <code style={{ background: D.tag, padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>Settings → Webhooks → URL: /issues/webhook → cocher "Issues events"</code>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Colonne droite - Chatbot ─────────────────────────────────────── */}
          <div style={{ width: 380, background: D.card, borderLeft: `1px solid ${D.border}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: D.text, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤖</span> Assistant IA
              </div>
              <div style={{ fontSize: 11, color: D.faint, marginTop: 4 }}>Posez vos questions sur l'analyse, les vulnérabilités, ou les corrections</div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, background: D.chatBg }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "90%", padding: "10px 14px", borderRadius: 18, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", background: msg.role === "user" ? D.messageUserBg : D.messageBg, color: msg.role === "user" ? "white" : D.text, border: msg.role === "assistant" ? `1px solid ${D.border}` : "none", borderBottomRightRadius: msg.role === "user" ? 4 : 18, borderBottomLeftRadius: msg.role === "assistant" ? 4 : 18 }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: D.messageBg, borderRadius: 18, width: "fit-content" }}>
                    <div style={{ width: 8, height: 8, background: D.faint, borderRadius: "50%", animation: "typing 1.4s infinite" }} />
                    <div style={{ width: 8, height: 8, background: D.faint, borderRadius: "50%", animation: "typing 1.4s infinite", animationDelay: "0.2s" }} />
                    <div style={{ width: 8, height: 8, background: D.faint, borderRadius: "50%", animation: "typing 1.4s infinite", animationDelay: "0.4s" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: "12px 16px", background: D.card, borderTop: `1px solid ${D.border}`, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => setChatInput("Explique la vulnérabilité la plus critique")} style={{ padding: "5px 12px", background: D.tag, border: "none", borderRadius: 20, fontSize: 11, cursor: "pointer", color: D.muted }}>🔴 Vulnérabilité critique</button>
              <button onClick={() => setChatInput("Comment améliorer le score sécurité ?")} style={{ padding: "5px 12px", background: D.tag, border: "none", borderRadius: 20, fontSize: 11, cursor: "pointer", color: D.muted }}>🛡️ Améliorer sécurité</button>
              <button onClick={() => setChatInput("Donne un exemple de correction")} style={{ padding: "5px 12px", background: D.tag, border: "none", borderRadius: 20, fontSize: 11, cursor: "pointer", color: D.muted }}>💡 Exemple de correction</button>
              <button onClick={() => setChatInput("C'est quoi OWASP ?")} style={{ padding: "5px 12px", background: D.tag, border: "none", borderRadius: 20, fontSize: 11, cursor: "pointer", color: D.muted }}>📖 Qu'est-ce que OWASP ?</button>
            </div>

            <div style={{ padding: 16, background: D.card, borderTop: `1px solid ${D.border}`, display: "flex", gap: 10 }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                disabled={chatLoading}
                style={{ flex: 1, padding: "10px 14px", border: `1px solid ${D.border}`, borderRadius: 24, fontSize: 13, outline: "none", background: D.inputBg, color: D.text }}
              />
              <button onClick={envoyerMessage} disabled={chatLoading || !chatInput.trim()} style={{ padding: "8px 20px", background: "#6366f1", border: "none", borderRadius: 24, color: "white", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: (chatLoading || !chatInput.trim()) ? 0.6 : 1 }}>
                Envoyer
              </button>
            </div>
          </div>
        </div>

        {/* ── Sidebar Historique ─────────────────────────────────────────────── */}
        <div onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: "fixed", right: 20, bottom: 20, width: 48, height: 48, background: D.btnPrimary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", fontSize: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 15 }}>
          📋
        </div>
        <div style={{ position: "fixed", right: 0, top: 0, width: 320, height: "100vh", background: D.card, borderLeft: `1px solid ${D.border}`, padding: 24, overflowY: "auto", transform: sidebarOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s ease", boxShadow: "-4px 0 12px rgba(0,0,0,0.05)", zIndex: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${D.border}` }}>Historique des analyses</div>
          {historique.length === 0 ? (
            <div style={{ color: D.faint, textAlign: "center", padding: 20 }}>Aucun historique</div>
          ) : (
            historique.slice(0, 10).map((h: any) => (
              <div key={h.id} onClick={() => setRapport(h)} style={{ padding: 12, borderBottom: `1px solid ${D.border}`, cursor: "pointer" }}>
                <div style={{ fontSize: 11, color: D.faint }}>{new Date(h.created_at).toLocaleDateString("fr-FR")}</div>
                <div style={{ fontSize: 12, fontWeight: 500, margin: "4px 0" }}>{h.branche}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: colorScore(h.score_qualite) }}>Score: {h.score_qualite ?? "—"}/100</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Mini lecteur TTS flottant ─────────────────────────────────────────── */}
      {ttsPlaying && (
        <div className="tts-player">
          <div className="tts-wave">
            <span /><span /><span /><span />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: D.faint, marginBottom: 2 }}>Lecture en cours</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ttsLabel}</div>
          </div>
          <button
            onClick={stopAudio}
            style={{ padding: "5px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#ef4444", flexShrink: 0 }}
          >
            ⏹ Stop
          </button>
        </div>
      )}

      {/* ── NOUVEAU : Modal Vidéo principal ─────────────────────────────────── */}
      {showVideoModal && (
        <VideoGeneratorModal
          rapport={rapport}
          nomProjet={nomProjet}
          isDark={isDark}
          ttsLangue={ttsLangue}
          onClose={() => setShowVideoModal(false)}
        />
      )}

      {/* Popup confirmation tests */}
      {showPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowPopup(false)}>
          <div style={{ background: D.card, borderRadius: 24, padding: 28, maxWidth: 480, width: "90%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>🧪 Analyse terminée !</div>
            <p style={{ color: D.faint, fontSize: 13 }}>Voulez-vous générer les tests unitaires pour ce projet ?</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "20px 0" }}>
              {[
                { label: "Qualité", val: rapport.score_qualite },
                { label: "Sécurité", val: rapport.score_securite },
                { label: "Performance", val: rapport.score_performance },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", padding: 12, background: D.bg, borderRadius: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colorScore(s.val) }}>{s.val ?? "—"}</div>
                  <div style={{ fontSize: 10, color: D.faint }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => genererTests(true)} style={{ flex: 2, padding: "10px", background: D.btnPrimary, border: "none", borderRadius: 12, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✅ Générer + créer MR</button>
              <button onClick={() => genererTests(false)} style={{ flex: 1, padding: "10px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>Sans MR</button>
              <button onClick={() => setShowPopup(false)} style={{ padding: "10px 16px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, cursor: "pointer", color: D.muted }}>✖</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading tests */}
      {loadingTests && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: D.card, borderRadius: 24, padding: 28, textAlign: "center", maxWidth: 400 }}>
            <div style={{ width: 32, height: 32, margin: "0 auto 16px", border: `3px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <div style={{ fontWeight: 600 }}>Génération des tests en cours...</div>
            <div style={{ fontSize: 12, color: D.faint, marginTop: 8 }}>Le LLM analyse tout le code</div>
          </div>
        </div>
      )}

      {/* Notification MR */}
      {resultatMr && (
        <div style={{ position: "fixed", bottom: 24, left: 24, background: D.card, borderRadius: 16, padding: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", borderLeft: "4px solid #10b981", maxWidth: 360, zIndex: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: "#10b981" }}>✅ Tests générés !</span>
            <button onClick={() => setResultatMr(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: D.muted }}>✖</button>
          </div>
          <div style={{ fontSize: 12, color: D.muted, marginBottom: 4 }}>🧪 {resultatMr.langage} · {resultatMr.nb_tests} tests</div>
          <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace", marginBottom: 4 }}>📁 {resultatMr.branche}</div>
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

// Wrapper requis par Next.js App Router pour useSearchParams
export default function RapportPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ color: "#94a3b8", fontSize: 14 }}>Chargement du rapport...</div>
        </div>
      </div>
    }>
      <RapportPage />
    </Suspense>
  );
}