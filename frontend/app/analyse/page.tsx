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

  // ── Branches ──────────────────────────────────────────
  const [branches,       setBranches]       = useState<string[]>([]);
  const [branche,        setBranche]        = useState("main");
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [loadingProjets, setLoadingProjets] = useState(false);

  // ── Options ───────────────────────────────────────────
  const [owasp,     setOwasp]     = useState(true);
  const [autoTests, setAutoTests] = useState(true);
  const [autoMr,    setAutoMr]    = useState(true);
  const [seuil,     setSeuil]     = useState(60);

  // ── États ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [erreur,  setErreur]  = useState("");

  // ── Résultat issues ───────────────────────────────────
  const [analyseTerminee, setAnalyseTerminee] = useState(false);
  const [issuesGitlab, setIssuesGitlab]       = useState<any[]>([]);
  const [rapportData,  setRapportData]        = useState<any>(null);

  // ── Résultat tests/MR (généré pendant l'analyse si coché) ────────────
  const [resultatTests, setResultatTests] = useState<any>(null);

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
    setBranches([]);
    setBranche("main");

    try {
      const res = await axios.post(
        `${API}/analyses/projets`,
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
        setErreur(detail.map((d: any) => d.msg).join(", "));
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

  // ── Charger les branches dès qu'un projet est sélectionné ─────────────
  const chargerBranches = async (projet: GitLabProjet) => {
    setLoadingBranches(true);
    setBranches([]);
    setBranche("main");
    try {
      const res = await axios.post(
        `${API}/analyses/branches`,
        { token, project_path: projet.chemin },
        { headers: getHeaders() }
      );
      // Attendu: res.data = ["main", "develop", "feature/xxx", ...]
      const list: string[] = res.data;
      setBranches(list);
      // Pré-sélectionner "main" ou la première branche disponible
      if (list.includes("main")) setBranche("main");
      else if (list.includes("master")) setBranche("master");
      else if (list.length > 0) setBranche(list[0]);
    } catch {
      // Si l'endpoint n'existe pas encore, on affiche juste un input texte
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  };

  const selectionnerProjet = (projet: GitLabProjet) => {
    setProjetChoisi(projet);
    chargerBranches(projet);
  };

  // ── Lancer l'analyse + optionnellement les tests/MR ───────────────────
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
    setResultatTests(null);

    try {
      // 1️⃣ Lancer l'analyse principale
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

      const analyseData = res.data;

      // 2️⃣ Si autoTests est coché, lancer les tests directement maintenant
      //    (avant de passer à la page rapport)
      if (autoTests && analyseData.analyse_id) {
        try {
          const resTests = await axios.post(
            `${API}/analyses/generer-tests`,
            {
              analyse_id   : analyseData.analyse_id,
              gitlab_token : token,
              project_url  : projetChoisi.chemin,
              branche,
              creer_mr     : autoMr,
            },
            { headers: getHeaders() }
          );
          setResultatTests(resTests.data);
          // Stocker aussi dans la session pour le rapport
          sessionStorage.setItem("resultatTests", JSON.stringify(resTests.data));
        } catch (eTests: any) {
          // Non bloquant : on continue vers le rapport même si les tests échouent
          const detail = eTests.response?.data?.detail;
          console.warn("Génération tests échouée :", detail);
        }
      }

      // 3️⃣ Sauvegarder tout pour la page rapport
      sessionStorage.setItem("rapport",     JSON.stringify(analyseData));
      sessionStorage.setItem("nomProjet",   projetChoisi.nom);
      sessionStorage.setItem("token",       token);
      sessionStorage.setItem("projectUrl",  projetChoisi.chemin);
      sessionStorage.setItem("branche",     branche);
      sessionStorage.setItem("autoTests",   String(autoTests));
      sessionStorage.setItem("autoMr",      String(autoMr));

      setRapportData(analyseData);
      setIssuesGitlab(analyseData.issues_gitlab || []);
      setAnalyseTerminee(true);

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

  // ── Écran intermédiaire : résultats + issues + tests/MR ───────────────
  if (analyseTerminee && rapportData) {
    const vulns = rapportData.vulnerabilites || [];
    const critiques = vulns.filter((v: any) => v.severite === "CRITIQUE").length;

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          .issue-row:hover { background: rgba(99,102,241,0.06) !important; }
        `}</style>

        <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, padding: "32px 24px" }}>
          <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", animation: "fadeIn 0.4s ease" }}>

            {/* Topbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <button onClick={() => setAnalyseTerminee(false)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", fontSize: 13, color: D.muted, cursor: "pointer" }}>
                ← Nouvelle analyse
              </button>
              <ThemeToggle />
            </div>

            {/* Header succès */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ width: 56, height: 56, background: "rgba(16,185,129,0.15)", border: "2px solid #10b981", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>✅</div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", marginBottom: 8 }}>Analyse terminée !</h1>
              <p style={{ fontSize: 14, color: D.faint }}>Projet : <strong style={{ color: D.text }}>{projetChoisi?.nom}</strong> · branche <code style={{ background: D.tag, padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{branche}</code></p>
            </div>

            {/* Scores */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                { label: "Qualité",     val: rapportData.score_qualite },
                { label: "Sécurité",    val: rapportData.score_securite },
                { label: "Performance", val: rapportData.score_performance },
              ].map(s => {
                const c = s.val >= 75 ? "#10b981" : s.val >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={s.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 18, padding: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 40, fontWeight: 700, color: c }}>{s.val ?? "—"}</div>
                    <div style={{ fontSize: 12, color: D.faint, marginTop: 4 }}>{s.label}</div>
                    <div style={{ height: 4, background: D.border, borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
                      <div style={{ width: `${s.val ?? 0}%`, height: 4, borderRadius: 2, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Résultat tests/MR si generés pendant l'analyse ── */}
            {resultatTests && (
              <div style={{ background: D.card, border: `1px solid rgba(16,185,129,0.35)`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#10b981", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  🧪 Tests unitaires générés
                  <span style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20 }}>
                    {resultatTests.nb_tests} test{resultatTests.nb_tests !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: D.muted, marginBottom: 10 }}>
                  <span>🔤 Langage : <strong style={{ color: D.text }}>{resultatTests.langage}</strong></span>
                  <span>🌿 Branche : <code style={{ background: D.tag, padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{resultatTests.branche}</code></span>
                </div>
                {resultatTests.mr && (
                  <a
                    href={resultatTests.mr.mr_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#6366f1", textDecoration: "none" }}
                  >
                    🔗 Voir la Merge Request sur GitLab →
                  </a>
                )}
              </div>
            )}

            {/* Issues GitLab créées */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: D.text, display: "flex", alignItems: "center", gap: 8 }}>
                  🐛 Issues créées dans GitLab
                  <span style={{ background: issuesGitlab.length > 0 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", color: issuesGitlab.length > 0 ? "#ef4444" : "#10b981", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20 }}>
                    {issuesGitlab.length} issue{issuesGitlab.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {critiques > 0 && (
                  <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 500 }}>⚠ {critiques} critique{critiques > 1 ? "s" : ""}</span>
                )}
              </div>

              {issuesGitlab.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#10b981", fontWeight: 500, fontSize: 14 }}>
                  ✅ Aucune issue créée — aucune vulnérabilité détectée
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {issuesGitlab.map((issue: any, i: number) => (
                    <div key={issue.id} className="issue-row" style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 12px",
                      borderBottom: i < issuesGitlab.length - 1 ? `1px solid ${D.border}` : "none",
                      borderLeft: `3px solid ${colorSeverite(issue.severite)}`,
                      borderRadius: i === 0 ? "8px 8px 0 0" : i === issuesGitlab.length - 1 ? "0 0 8px 8px" : "0",
                      background: "transparent",
                      transition: "background 0.15s",
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, flexShrink: 0, letterSpacing: "0.04em", background: `${colorSeverite(issue.severite)}18`, color: colorSeverite(issue.severite), border: `1px solid ${colorSeverite(issue.severite)}40` }}>
                        {issue.severite}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{issue.titre}</div>
                        <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace" }}>📄 {issue.fichier}{issue.ligne ? ` — ligne ${issue.ligne}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 10, color: issue.statut === "opened" ? "#10b981" : D.muted, background: D.tag, padding: "2px 8px", borderRadius: 12, flexShrink: 0, fontWeight: 500 }}>
                        {issue.statut === "opened" ? "🟢 ouverte" : issue.statut}
                      </span>
                      {issue.issue_url && (
                        <a href={issue.issue_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#6366f1", textDecoration: "none", transition: "background 0.15s" }}>
                          Voir sur GitLab →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: isDark ? "rgba(99,102,241,0.08)" : "#f0f4ff", border: `1px solid rgba(99,102,241,0.2)`, borderRadius: 14, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: D.muted, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
              <span>Ces issues ont été créées automatiquement dans votre projet GitLab. Vous pouvez les retrouver dans l'onglet <strong>Issues</strong> de votre dépôt. Le rapport complet contient aussi cette liste avec les détails des corrections suggérées.</span>
            </div>

            <button
              onClick={() => router.push("/analyse/rapport")}
              style={{ width: "100%", padding: "14px 24px", background: D.btnPrimary, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              Voir le rapport complet →
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Écran principal : formulaire ──────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>

          {/* Topbar */}
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
              { num: 1, label: "Token",   active: true },
              { num: 2, label: "Projet",  active: !!projetChoisi },
              { num: 3, label: "Branche", active: !!projetChoisi },
              { num: 4, label: "Résultats", active: false },
            ].map((step, idx) => (
              <div key={step.num} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, background: step.active ? D.stepActiveBg : D.stepBg, color: step.active ? "white" : D.stepText, border: `1px solid ${step.active ? D.stepActiveBg : D.border}` }}>
                  {step.num}
                </div>
                <span style={{ fontSize: 13, fontWeight: step.active ? 600 : 500, color: step.active ? D.text : D.muted }}>{step.label}</span>
                {idx < 3 && <div style={{ width: 28, height: 1, background: D.border, marginLeft: 8 }} />}
              </div>
            ))}
          </div>

          {/* ── Card 1 : Token + projets ── */}
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

            {/* Liste des projets */}
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
                        borderLeft: projetChoisi?.id === projet.id ? `3px solid #6366f1` : "3px solid transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 2 }}>{projet.nom}</div>
                        <div style={{ fontSize: 11, color: D.faint, fontFamily: "monospace" }}>{projet.chemin}</div>
                      </div>
                      {projetChoisi?.id === projet.id
                        ? <span style={{ fontSize: 16, color: "#6366f1" }}>✓</span>
                        : <span style={{ fontSize: 18, color: D.faint }}>→</span>
                      }
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Card 2 : Sélection de branche (même style que les projets) ── */}
          {projetChoisi && (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                🌿 Sélectionnez une branche
                {loadingBranches && (
                  <div style={{ width: 16, height: 16, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                )}
              </div>

              {/* Si les branches sont chargées : liste cliquable */}
              {branches.length > 0 ? (
                <div style={{ border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                  {branches.map((b, i) => (
                    <div
                      key={b}
                      onClick={() => setBranche(b)}
                      style={{
                        display: "flex", alignItems: "center", padding: "12px 16px",
                        borderBottom: i < branches.length - 1 ? `1px solid ${D.border}` : "none",
                        cursor: "pointer",
                        background: branche === b ? "rgba(99,102,241,0.12)" : "transparent",
                        borderLeft: branche === b ? `3px solid #6366f1` : "3px solid transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 14, color: D.faint, marginRight: 10, fontFamily: "monospace" }}>⎇</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: branche === b ? 600 : 500, color: D.text }}>{b}</div>
                        {(b === "main" || b === "master") && (
                          <div style={{ fontSize: 10, color: D.faint, marginTop: 1 }}>Branche principale</div>
                        )}
                      </div>
                      {branche === b
                        ? <span style={{ fontSize: 14, color: "#6366f1" }}>✓</span>
                        : <span style={{ fontSize: 14, color: D.faint }}>→</span>
                      }
                    </div>
                  ))}
                </div>
              ) : !loadingBranches ? (
                /* Fallback : input texte si l'endpoint branches n'existe pas */
                <>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: D.muted, marginBottom: 6 }}>Nom de la branche</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={branche}
                    onChange={e => setBranche(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, background: D.inputBg, color: D.text, outline: "none" }}
                  />
                  <span style={{ display: "block", fontSize: 11, color: D.faint, marginTop: 5 }}>Laissez "main" pour analyser la branche principale</span>
                </>
              ) : null}

              {/* Branche sélectionnée */}
              {branche && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10 }}>
                  <span style={{ fontSize: 12, color: D.faint }}>Branche sélectionnée :</span>
                  <code style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "2px 10px", borderRadius: 6 }}>{branche}</code>
                </div>
              )}
            </div>
          )}

          {/* ── Card 3 : Options d'analyse ── */}
          {projetChoisi && (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>⚙️ Options d'analyse</div>

              {/* OWASP */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${D.border}` }}>
                <input type="checkbox" checked={owasp} onChange={e => setOwasp(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#6366f1", marginTop: 2, cursor: "pointer" }} />
                <label style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4 }}>Analyse OWASP Top 10</div>
                  <div style={{ fontSize: 12, color: D.faint }}>Détecte les 10 failles de sécurité les plus critiques</div>
                </label>
              </div>

              {/* Tests unitaires — avec note "pendant l'analyse" */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${D.border}` }}>
                <input type="checkbox" checked={autoTests} onChange={e => setAutoTests(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#6366f1", marginTop: 2, cursor: "pointer" }} />
                <label style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    Générer les tests unitaires
                    {autoTests && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}>
                        ⚡ pendant l'analyse
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: D.faint }}>L'IA génère automatiquement des tests unitaires dès la fin de l'analyse</div>
                </label>
              </div>

              {/* Merge Request — avec note "pendant l'analyse" */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${D.border}` }}>
                <input type="checkbox" checked={autoMr} onChange={e => setAutoMr(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#6366f1", marginTop: 2, cursor: "pointer" }} />
                <label style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: D.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    Créer une Merge Request
                    {autoTests && autoMr && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                        ✓ incluse
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: D.faint }}>Pousse les tests et crée une MR automatique sur la branche sélectionnée</div>
                </label>
              </div>

              {/* Seuil qualité */}
              <div style={{ marginTop: 20, paddingTop: 8 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: D.muted, marginBottom: 6 }}>Seuil minimum de qualité</label>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
                  <input type="range" min={0} max={100} value={seuil} onChange={e => setSeuil(parseInt(e.target.value))} style={{ flex: 1, height: 4, accentColor: "#6366f1", cursor: "pointer" }} />
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", minWidth: 55, textAlign: "right", color: colorScore(seuil) }}>{seuil}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Résumé de ce qui va se passer */}
          {projetChoisi && (autoTests || autoMr) && (
            <div style={{ background: isDark ? "rgba(99,102,241,0.07)" : "#f0f4ff", border: `1px solid rgba(99,102,241,0.2)`, borderRadius: 14, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: D.muted, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
              <span>
                <strong style={{ color: D.text }}>Ce qui va se passer en un clic :</strong><br />
                1. Analyse du code + détection OWASP{owasp ? " ✓" : ""}<br />
                {autoTests && <>2. Génération automatique des tests unitaires ✓<br /></>}
                {autoTests && autoMr && <>3. Création de la Merge Request sur GitLab ✓<br /></>}
                Vous verrez tous les résultats sur la page suivante.
              </span>
            </div>
          )}

          {erreur && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 14, padding: "14px 18px", fontSize: 13, color: "#ef4444", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>⚠️</span> {erreur}
            </div>
          )}

          {/* Bouton lancer */}
          <button
            onClick={lancerAnalyse}
            disabled={loading || !projetChoisi}
            style={{ width: "100%", padding: "14px 24px", background: D.btnPrimary, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: (loading || !projetChoisi) ? 0.6 : 1 }}
          >
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                {autoTests ? "Analyse + génération des tests en cours..." : "Analyse en cours..."}
              </>
            ) : (
              <>
                Lancer l'analyse
                {autoTests && autoMr ? " + Tests + MR" : autoTests ? " + Tests" : ""}
                {" →"}
              </>
            )}
          </button>

        </div>
      </div>
    </>
  );
}