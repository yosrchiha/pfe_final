"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://127.0.0.1:8000";

export default function RapportPage() {
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
  const [activeTab, setActiveTab] = useState<"vulns" | "recos">("vulns");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => {
    const r = sessionStorage.getItem("rapport");
    const np = sessionStorage.getItem("nomProjet") || "";
    const t = sessionStorage.getItem("token") || "";
    const pu = sessionStorage.getItem("projectUrl") || "";
    const br = sessionStorage.getItem("branche") || "main";
    const at = sessionStorage.getItem("autoTests") === "true";

    if (!r) {
      router.push("/analyse");
      return;
    }

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

  const exporterPDF = async () => {
    const analyseId = rapport?.analyse_id;
    if (!analyseId) {
      setErreur("ID d'analyse manquant");
      return;
    }

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
      console.error("Erreur export PDF", e);
      setErreur("Erreur de connexion");
    }
  };

  const genererTests = async (creerMr: boolean) => {
    setShowPopup(false);
    setLoadingTests(true);
    const analyseId = rapport?.analyse_id;
    if (!analyseId) {
      setErreur("ID analyse manquant");
      setLoadingTests(false);
      return;
    }

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
        { question: userMessage, contexte: context },
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
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", background: D.card, borderBottom: `1px solid ${D.border}`, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => router.push("/analyse")} style={{ background: "transparent", border: `1px solid ${D.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: D.muted }}>
              ← Nouvelle analyse
            </button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: D.text }}>{nomProjet}</div>
              <div style={{ fontSize: 12, color: D.faint, fontFamily: "monospace", marginTop: 2 }}>branche : {branche}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <ThemeToggle />
            <button onClick={exporterPDF} style={{ padding: "8px 18px", background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>
              📄 Exporter PDF
            </button>
            <button onClick={() => setShowPopup(true)} style={{ padding: "8px 18px", background: D.btnPrimary, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white" }}>
              🧪 Générer les tests
            </button>
            <button onClick={() => router.push(`/feedback?analyse_id=${rapport?.analyse_id}&projet=${nomProjet}`)} style={{ padding: "8px 18px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white", display: "flex", alignItems: "center", gap: 6 }}>
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

        {/* Layout 2 colonnes */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Colonne gauche - Rapport */}
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

            {/* Summary */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              {critiques > 0 && <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: "rgba(239,68,68,0.15)", color: "#ef4444", border: `1px solid rgba(239,68,68,0.3)` }}>⚠ {critiques} critique{critiques > 1 ? "s" : ""}</span>}
              {hautes > 0 && <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: "rgba(249,115,22,0.15)", color: "#f97316", border: `1px solid rgba(249,115,22,0.3)` }}>↑ {hautes} haute{hautes > 1 ? "s" : ""}</span>}
              <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: D.tag, color: D.tagText, border: `1px solid ${D.border}` }}>{vulns.length} vulnérabilité{vulns.length !== 1 ? "s" : ""}</span>
              <span style={{ padding: "6px 14px", borderRadius: 30, fontSize: 12, fontWeight: 500, background: D.tag, color: D.tagText, border: `1px solid ${D.border}` }}>{recos.length} recommandation{recos.length !== 1 ? "s" : ""}</span>
            </div>

            {erreur && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 12, padding: 12, marginBottom: 20, color: "#ef4444", fontSize: 13 }}>
                ⚠ {erreur}
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
            </div>

            {/* Vulnérabilités */}
            {activeTab === "vulns" && (
              vulns.length === 0 ? (
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20, textAlign: "center", color: "#10b981", fontWeight: 500 }}>
                  ✅ Aucune vulnérabilité détectée — Code propre !
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {vulns.map((v: any, i: number) => (
                    <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 16, borderLeft: `4px solid ${colorSeverite(v.severite)}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: `${colorSeverite(v.severite)}15`, color: colorSeverite(v.severite) }}>{v.severite}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{v.type}</span>
                      </div>
                      <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace", marginBottom: 8 }}>📄 {v.fichier} — ligne {v.ligne}</div>
                      <div style={{ fontSize: 12, color: D.muted, background: D.bg, padding: "8px 12px", borderRadius: 10 }}>💡 {v.suggestion}</div>
                    </div>
                  ))}
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
          </div>

          {/* Colonne droite - Chatbot */}
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

        {/* Sidebar Historique */}
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

      {/* Popup de confirmation */}
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