"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://127.0.0.1:8000";

interface GitLabProjet {
  id: number;
  nom: string;
  chemin: string;
  url: string;
}

export default function AnalysePage() {
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
  };

  // ── Formulaire ─────────────────────────────────────────
  const [token,      setToken]      = useState("");
  const [projets,    setProjets]    = useState<GitLabProjet[]>([]);
  const [projetChoisi, setProjetChoisi] = useState<GitLabProjet | null>(null);
  const [branche,    setBranche]    = useState("main");
  const [loadingProjets, setLoadingProjets] = useState(false);

  // ── Options ───────────────────────────────────────────
  const [owasp,     setOwasp]     = useState(true);
  const [autoTests, setAutoTests] = useState(true);
  const [autoMr,    setAutoMr]    = useState(true);
  const [seuil,     setSeuil]     = useState(60);

  // ── États ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [erreur,  setErreur]  = useState("");

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  const chargerProjets = async () => {
    if (!token.trim()) {
      setErreur("Veuillez saisir un token GitLab");
      return;
    }
    setLoadingProjets(true);
    setErreur("");
    setProjets([]);
    setProjetChoisi(null);

    try {
      const res = await axios.post(
        `${API}/explorer/gitlab/projets`,
        { token },
        { headers: getHeaders() }
      );
      setProjets(res.data);
      if (res.data.length === 0) {
        setErreur("Aucun projet trouvé avec ce token");
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        const messages = detail.map((d: any) => d.msg).join(", ");
        setErreur(messages);
      } else if (typeof detail === "string") {
        setErreur(detail);
      } else if (detail && typeof detail === "object" && detail.message) {
        setErreur(detail.message);
      } else {
        setErreur("Token invalide ou impossible de se connecter à GitLab");
      }
    } finally {
      setLoadingProjets(false);
    }
  };

  const selectionnerProjet = (projet: GitLabProjet) => {
    setProjetChoisi(projet);
  };

  const lancerAnalyse = async () => {
    if (!projetChoisi) {
      setErreur("Veuillez sélectionner un projet");
      return;
    }
    if (!token.trim()) {
      setErreur("Le token GitLab est requis");
      return;
    }

    setLoading(true);
    setErreur("");

    try {
      const res = await axios.post(
        `${API}/analyses/lancer`,
        {
          nom_projet    : projetChoisi.nom,
          gitlab_token  : token,
          project_url   : projetChoisi.chemin,
          branche,
          owasp_enabled : owasp,
          auto_tests    : autoTests,
          auto_mr       : autoMr,
          seuil_qualite : seuil,
        },
        { headers: getHeaders() }
      );

      sessionStorage.setItem("rapport",     JSON.stringify(res.data));
      sessionStorage.setItem("nomProjet",   projetChoisi.nom);
      sessionStorage.setItem("token",       token);
      sessionStorage.setItem("projectUrl",  projetChoisi.chemin);
      sessionStorage.setItem("branche",     branche);
      sessionStorage.setItem("autoTests",   String(autoTests));
      sessionStorage.setItem("autoMr",      String(autoMr));

      router.push("/analyse/rapport");

    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErreur(detail.map((d: any) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setErreur(detail);
      } else {
        setErreur("Erreur lors de l'analyse — vérifiez le token et le projet");
      }
    } finally {
      setLoading(false);
    }
  };

  const colorScore = (s: number) => {
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>

          {/* Topbar avec ThemeToggle et retour */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={() => router.push("/dashboard")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", fontSize: 13, color: D.muted, cursor: "pointer" }}>
              ← Retour au tableau de bord
            </button>
            <ThemeToggle />
          </div>

          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: D.tag, border: `1px solid ${D.border}`, borderRadius: 100, padding: "5px 16px", fontSize: 12, fontWeight: 500, color: D.muted, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, background: "#6366f1", borderRadius: "50%" }} />
              AuditPlatform · IA
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", marginBottom: 8 }}>Ajouter un projet</h1>
            <p style={{ fontSize: 15, color: D.faint }}>Entrez votre token GitLab pour charger vos projets</p>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
            {[
              { num: 1, label: "Token", active: true },
              { num: 2, label: "Projet", active: !!projetChoisi },
              { num: 3, label: "Résultats", active: false },
            ].map((step, idx) => (
              <div key={step.num} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, background: step.active ? D.stepActiveBg : D.stepBg, color: step.active ? "white" : D.stepText, border: `1px solid ${step.active ? D.stepActiveBg : D.border}` }}>
                  {step.num}
                </div>
                <span style={{ fontSize: 13, fontWeight: step.active ? 600 : 500, color: step.active ? D.text : D.muted }}>{step.label}</span>
                {idx < 2 && <div style={{ width: 40, height: 1, background: D.border, marginLeft: 8 }} />}
              </div>
            ))}
          </div>

          {/* Card 1 — Token et projets */}
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>🔑 Token GitLab</div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: D.muted, marginBottom: 6 }}>Token d'accès personnel</label>
              <input
                type="password"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === "Enter" && chargerProjets()}
                style={{ width: "100%", padding: "12px 14px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, fontFamily: "monospace", background: D.inputBg, color: D.text, outline: "none" }}
              />
              <span style={{ display: "block", fontSize: 11, color: D.faint, marginTop: 5 }}>GitLab → Settings → Access Tokens → scopes : api, read_repository</span>
            </div>

            <button
              onClick={chargerProjets}
              disabled={loadingProjets}
              style={{ width: "100%", padding: 10, background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, fontWeight: 500, color: D.muted, cursor: "pointer" }}
            >
              {loadingProjets ? "Chargement..." : "🔍 Charger mes projets"}
            </button>

            {projets.length > 0 && (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginTop: 24, marginBottom: 12 }}>📁 Sélectionnez un projet ({projets.length})</div>
                <div style={{ marginTop: 16, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                  {projets.map(projet => (
                    <div
                      key={projet.id}
                      onClick={() => selectionnerProjet(projet)}
                      style={{
                        display: "flex", alignItems: "center", padding: "14px 16px",
                        borderBottom: `1px solid ${D.border}`, cursor: "pointer",
                        background: projetChoisi?.id === projet.id ? "rgba(99,102,241,0.12)" : "transparent",
                        borderLeft: projetChoisi?.id === projet.id ? `3px solid #6366f1` : "3px solid transparent"
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 2 }}>{projet.nom}</div>
                        <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace" }}>{projet.chemin}</div>
                      </div>
                      <div style={{ fontSize: 18, color: D.faint }}>→</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Card 2 — Branche et options */}
          {projetChoisi && (
            <>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>🌿 Branche</div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: D.muted, marginBottom: 6 }}>Branche à analyser</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={branche}
                    onChange={e => setBranche(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, background: D.inputBg, color: D.text, outline: "none" }}
                  />
                  <span style={{ display: "block", fontSize: 11, color: D.faint, marginTop: 5 }}>Laissez "main" pour analyser la branche principale</span>
                </div>
              </div>

              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>⚙️ Options d'analyse</div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${D.border}` }}>
                  <input type="checkbox" checked={owasp} onChange={e => setOwasp(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#6366f1", marginTop: 2, cursor: "pointer" }} />
                  <label style={{ flex: 1, cursor: "pointer" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4 }}>Analyse OWASP Top 10</div>
                    <div style={{ fontSize: 12, color: D.faint }}>Détecte les 10 failles de sécurité les plus critiques</div>
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${D.border}` }}>
                  <input type="checkbox" checked={autoTests} onChange={e => setAutoTests(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#6366f1", marginTop: 2, cursor: "pointer" }} />
                  <label style={{ flex: 1, cursor: "pointer" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4 }}>Générer les tests unitaires</div>
                    <div style={{ fontSize: 12, color: D.faint }}>L'IA génère automatiquement des tests unitaires</div>
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${D.border}` }}>
                  <input type="checkbox" checked={autoMr} onChange={e => setAutoMr(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#6366f1", marginTop: 2, cursor: "pointer" }} />
                  <label style={{ flex: 1, cursor: "pointer" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4 }}>Créer une Merge Request</div>
                    <div style={{ fontSize: 12, color: D.faint }}>Pousse les tests et crée une MR automatique</div>
                  </label>
                </div>

                <div style={{ marginTop: 20, paddingTop: 8 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: D.muted, marginBottom: 6 }}>Seuil minimum de qualité</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
                    <input type="range" min={0} max={100} value={seuil} onChange={e => setSeuil(parseInt(e.target.value))} style={{ flex: 1, height: 4, accentColor: "#6366f1", cursor: "pointer" }} />
                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", minWidth: 55, textAlign: "right", color: colorScore(seuil) }}>{seuil}%</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {erreur && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 14, padding: "14px 18px", fontSize: 13, color: "#ef4444", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>⚠️</span> {erreur}
            </div>
          )}

          <button
            onClick={lancerAnalyse}
            disabled={loading || !projetChoisi}
            style={{ width: "100%", padding: "14px 24px", background: D.btnPrimary, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: (loading || !projetChoisi) ? 0.6 : 1 }}
          >
            {loading ? (
              <><div style={{ width: 18, height: 18, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Analyse en cours...</>
            ) : (
              "Lancer l'analyse →"
            )}
          </button>

        </div>
      </div>
    </>
  );
}