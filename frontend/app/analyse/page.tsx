// frontend/app/analyse/page.tsx (version modifiée)

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface GitLabProjet {
  id: number;
  nom: string;
  chemin: string;
  url: string;
}

export default function AnalysePage() {
  const router = useRouter();

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

  // ── Charger les projets GitLab avec le token ──────────
  // frontend/app/analyse/page.tsx

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
      { token },  // ← format correct : objet avec token
      { headers: getHeaders() }
    );
    setProjets(res.data);
    if (res.data.length === 0) {
      setErreur("Aucun projet trouvé avec ce token");
    }
  } catch (e: any) {
    // ✅ Gestion correcte des erreurs
    const detail = e.response?.data?.detail;
    
    if (Array.isArray(detail)) {
      // Pydantic validation error
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

  // ── Sélectionner un projet ────────────────────────────
  const selectionnerProjet = (projet: GitLabProjet) => {
    setProjetChoisi(projet);
    // Optionnel : charger les branches du projet
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

        .page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
        }

        .container {
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
        }

        .header { text-align: center; margin-bottom: 32px; }
        .badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: #f1f5f9; border: 1px solid #e2e8f0;
          border-radius: 100px; padding: 5px 16px;
          font-size: 12px; font-weight: 500; color: #475569;
          margin-bottom: 16px;
        }
        .badge-dot { width: 8px; height: 8px; background: #6366f1; border-radius: 50%; }
        .title { font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin-bottom: 8px; }
        .subtitle { font-size: 15px; color: #64748b; }

        .steps {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; margin-bottom: 32px;
        }
        .step { display: flex; align-items: center; gap: 8px; }
        .step-number {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600;
          background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0;
        }
        .step-number.active { background: #0f172a; border-color: #0f172a; color: white; }
        .step-label { font-size: 13px; font-weight: 500; color: #64748b; }
        .step-label.active { color: #0f172a; font-weight: 600; }
        .step-separator { width: 40px; height: 1px; background: #e2e8f0; }

        .card {
          background: white; border: 1px solid #eef2ff;
          border-radius: 24px; padding: 28px;
          margin-bottom: 20px;
        }
        .card-title {
          font-size: 16px; font-weight: 600; color: #0f172a;
          margin-bottom: 20px; padding-bottom: 12px;
          border-bottom: 2px solid #f1f5f9;
        }

        .field { margin-bottom: 20px; }
        .field:last-child { margin-bottom: 0; }
        .label {
          display: block; font-size: 13px; font-weight: 600;
          color: #334155; margin-bottom: 6px;
        }
        .input {
          width: 100%; padding: 12px 14px;
          border: 1px solid #e2e8f0; border-radius: 12px;
          font-size: 14px; font-family: monospace;
          background: white; transition: all 0.2s;
        }
        .input:focus {
          outline: none; border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .hint { display: block; font-size: 11px; color: #94a3b8; margin-top: 5px; }

        /* Liste des projets */
        .projets-list {
          margin-top: 16px;
          border: 1px solid #eef2ff;
          border-radius: 14px;
          overflow: hidden;
        }
        .projet-item {
          display: flex; align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }
        .projet-item:last-child { border-bottom: none; }
        .projet-item:hover { background: #f8fafc; }
        .projet-item.selected {
          background: #eef2ff;
          border-left: 3px solid #6366f1;
        }
        .projet-info { flex: 1; }
        .projet-nom { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
        .projet-chemin { font-size: 11px; color: #64748b; font-family: monospace; }
        .projet-icon { font-size: 18px; color: #94a3b8; }

        .btn-secondary {
          width: 100%; padding: 10px;
          background: #f1f5f9; border: 1px solid #e2e8f0;
          border-radius: 12px; font-size: 13px; font-weight: 500;
          color: #475569; cursor: pointer;
          transition: all 0.2s; margin-top: 16px;
        }
        .btn-secondary:hover { background: #eef2ff; border-color: #cbd5e1; }

        .option {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 0; border-bottom: 1px solid #f1f5f9;
        }
        .option:last-child { border-bottom: none; }
        .checkbox { width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px; cursor: pointer; }
        .option-content { flex: 1; cursor: pointer; }
        .option-title { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
        .option-desc { font-size: 12px; color: #64748b; line-height: 1.4; }

        .seuil-wrap { margin-top: 20px; padding-top: 8px; }
        .seuil-row { display: flex; align-items: center; gap: 16px; margin-top: 12px; }
        .range { flex: 1; height: 4px; accent-color: #6366f1; cursor: pointer; }
        .seuil-value { font-size: 18px; font-weight: 700; font-family: monospace; min-width: 55px; text-align: right; }

        .error {
          background: #fef2f2; border: 1px solid #fee2e2;
          border-radius: 14px; padding: 14px 18px;
          font-size: 13px; color: #ef4444;
          margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }

        .btn {
          width: 100%; padding: 14px 24px;
          background: #0f172a; color: white;
          border: none; border-radius: 14px;
          font-size: 15px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .btn:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent; border: none;
          font-size: 13px; color: #64748b;
          cursor: pointer; margin-bottom: 20px;
        }
        .back-link:hover { color: #0f172a; }

        .loading-projets {
          text-align: center; padding: 24px;
          color: #64748b; font-size: 13px;
        }
      `}</style>

      <div className="page">
        <div className="container">

          <button className="back-link" onClick={() => router.push("/dashboard")}>
            ← Retour au tableau de bord
          </button>

          <div className="header">
            <div className="badge">
              <div className="badge-dot" />
              AuditPlatform · IA
            </div>
            <h1 className="title">Analyser un projet</h1>
            <p className="subtitle">Entrez votre token GitLab pour charger vos projets</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-number active">1</div>
              <span className="step-label active">Token</span>
            </div>
            <div className="step-separator" />
            <div className="step">
              <div className="step-number">2</div>
              <span className="step-label">Projet</span>
            </div>
            <div className="step-separator" />
            <div className="step">
              <div className="step-number">3</div>
              <span className="step-label">Résultats</span>
            </div>
          </div>

          {/* Card 1 — Token et projets */}
          <div className="card">
            <div className="card-title">🔑 Token GitLab</div>

            <div className="field">
              <label className="label">Token d'accès personnel</label>
              <input
                className="input"
                type="password"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === "Enter" && chargerProjets()}
              />
              <span className="hint">
                GitLab → Settings → Access Tokens → scopes : api, read_repository
              </span>
            </div>

            <button
              className="btn-secondary"
              onClick={chargerProjets}
              disabled={loadingProjets}
            >
              {loadingProjets ? <><div className="spinner" /> Chargement...</> : "🔍 Charger mes projets"}
            </button>

            {projets.length > 0 && (
              <>
                <div className="card-title" style={{ marginTop: 24, marginBottom: 12 }}>
                  📁 Sélectionnez un projet ({projets.length})
                </div>
                <div className="projets-list">
                  {projets.map(projet => (
                    <div
                      key={projet.id}
                      className={`projet-item ${projetChoisi?.id === projet.id ? "selected" : ""}`}
                      onClick={() => selectionnerProjet(projet)}
                    >
                      <div className="projet-info">
                        <div className="projet-nom">{projet.nom}</div>
                        <div className="projet-chemin">{projet.chemin}</div>
                      </div>
                      <div className="projet-icon">→</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Card 2 — Branche et options (visible seulement si projet sélectionné) */}
          {projetChoisi && (
            <>
              <div className="card">
                <div className="card-title">🌿 Branche</div>
                <div className="field">
                  <label className="label">Branche à analyser</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="main"
                    value={branche}
                    onChange={e => setBranche(e.target.value)}
                  />
                  <span className="hint">
                    Laissez "main" pour analyser la branche principale
                  </span>
                </div>
              </div>

              <div className="card">
                <div className="card-title">⚙️ Options d'analyse</div>

                <div className="option">
                  <input type="checkbox" id="owasp" checked={owasp} onChange={e => setOwasp(e.target.checked)} className="checkbox" />
                  <label htmlFor="owasp" className="option-content">
                    <div className="option-title">Analyse OWASP Top 10</div>
                    <div className="option-desc">Détecte les 10 failles de sécurité les plus critiques</div>
                  </label>
                </div>

                <div className="option">
                  <input type="checkbox" id="autoTests" checked={autoTests} onChange={e => setAutoTests(e.target.checked)} className="checkbox" />
                  <label htmlFor="autoTests" className="option-content">
                    <div className="option-title">Générer les tests unitaires</div>
                    <div className="option-desc">L'IA génère automatiquement des tests unitaires</div>
                  </label>
                </div>

                <div className="option">
                  <input type="checkbox" id="autoMr" checked={autoMr} onChange={e => setAutoMr(e.target.checked)} className="checkbox" />
                  <label htmlFor="autoMr" className="option-content">
                    <div className="option-title">Créer une Merge Request</div>
                    <div className="option-desc">Pousse les tests et crée une MR automatique</div>
                  </label>
                </div>

                <div className="seuil-wrap">
                  <label className="label">Seuil minimum de qualité</label>
                  <div className="seuil-row">
                    <input type="range" min={0} max={100} value={seuil} onChange={e => setSeuil(parseInt(e.target.value))} className="range" />
                    <span className="seuil-value" style={{ color: colorScore(seuil) }}>{seuil}%</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {erreur && (
            <div className="error">
              <span>⚠️</span> {erreur}
            </div>
          )}

          <button
            className="btn"
            onClick={lancerAnalyse}
            disabled={loading || !projetChoisi}
          >
            {loading ? (
              <><div className="spinner" /> Analyse en cours...</>
            ) : (
              "Lancer l'analyse →"
            )}
          </button>

        </div>
      </div>
    </>
  );
}