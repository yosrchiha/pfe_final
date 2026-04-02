"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

interface Projet {
  id: number;
  nom: string;
  chemin: string;
  url: string;
}

interface Branch {
  name: string;
  default: boolean;
}

export default function AddDepot() {
  const router = useRouter();

  // ── État pour les projets ────────────────────────────
  const [token, setToken] = useState("");
  const [projets, setProjets] = useState<Projet[]>([]);
  const [projetChoisi, setProjetChoisi] = useState<Projet | null>(null);
  const [loadingProjets, setLoadingProjets] = useState(false);

  // ── État pour les branches ───────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchePrincipale, setBranchePrincipale] = useState("");
  const [brancheDeveloppement, setBrancheDeveloppement] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);

  // ── État général ─────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  // ── 1. Charger les projets avec le token ─────────────
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
    setBranchePrincipale("");
    setBrancheDeveloppement("");

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
      if (typeof detail === "string") {
        setErreur(detail);
      } else {
        setErreur("Token invalide ou impossible de se connecter à GitLab");
      }
    } finally {
      setLoadingProjets(false);
    }
  };

  // ── 2. Charger les branches d'un projet ──────────────
  const chargerBranches = async (projet: Projet) => {
    setLoadingBranches(true);
    setErreur("");
    setBranches([]);
    setBranchePrincipale("");
    setBrancheDeveloppement("");

    try {
      const res = await axios.post(
        `${API}/explorer/gitlab/branches`,
        { token, project_name: projet.chemin },
        { headers: getHeaders() }
      );
      setBranches(res.data.branches);
      
      // Auto-sélection de la branche par défaut
      const defaultBranch = res.data.branches.find((b: Branch) => b.default);
      if (defaultBranch) {
        setBranchePrincipale(defaultBranch.name);
      } else if (res.data.branches.some((b: Branch) => b.name === "main")) {
        setBranchePrincipale("main");
      } else if (res.data.branches.some((b: Branch) => b.name === "master")) {
        setBranchePrincipale("master");
      }
      
      // Auto-sélection de la branche de développement
      if (res.data.branches.some((b: Branch) => b.name === "develop")) {
        setBrancheDeveloppement("develop");
      } else if (res.data.branches.some((b: Branch) => b.name === "dev")) {
        setBrancheDeveloppement("dev");
      }
      
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (typeof detail === "string") {
        setErreur(detail);
      } else {
        setErreur("Erreur lors du chargement des branches");
      }
    } finally {
      setLoadingBranches(false);
    }
  };

  // ── Sélectionner un projet ───────────────────────────
  const selectionnerProjet = (projet: Projet) => {
    setProjetChoisi(projet);
    chargerBranches(projet);
  };

  // ── Soumettre le formulaire ──────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErreur("");

    if (!projetChoisi) {
      setErreur("Veuillez sélectionner un projet");
      setLoading(false);
      return;
    }

    if (!branchePrincipale || !brancheDeveloppement) {
      setErreur("Veuillez sélectionner les branches principale et de développement");
      setLoading(false);
      return;
    }

    const userId = localStorage.getItem("user_id");
    
    const cleanedForm = {
      nom: projetChoisi.chemin,
      url_branche_principale: branchePrincipale,
      url_branche_developpement: brancheDeveloppement,
      token_gitlab: token,
      proprietaire_id: Number(userId) || 0,
    };

    console.log("[DEBUG] Envoi au backend:", cleanedForm);

    try {
      const res = await fetch("http://127.0.0.1:8000/depots/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(cleanedForm),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errDetail = "Erreur lors de l'ajout du dépôt";
        try {
          const errJson = JSON.parse(errText);
          errDetail = errJson.detail || errText;
        } catch {
          errDetail = errText;
        }
        throw new Error(errDetail);
      }

      const depot = await res.json();
      console.log("[DEBUG] Dépôt créé ID:", depot.id);

      const compareRes = await fetch(
        `http://127.0.0.1:8000/depots/${depot.id}/compare`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (!compareRes.ok) {
        const errText = await compareRes.text();
        throw new Error(`Erreur comparaison : ${errText}`);
      }

      const compareData = await compareRes.json();

      const dataToStore = {
        ...compareData,
        depot_id: depot.id,
      };
      localStorage.setItem("compareData", JSON.stringify(dataToStore));

      router.push("/difference");

    } catch (error: any) {
      console.error("[ERROR]", error);
      setErreur(error.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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
          max-width: 800px;
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

        /* Branches */
        .branches-list {
          margin-top: 16px;
          border: 1px solid #eef2ff;
          border-radius: 14px;
          overflow: hidden;
        }
        .branch-item {
          display: flex; align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }
        .branch-item:last-child { border-bottom: none; }
        .branch-item:hover { background: #f8fafc; }
        .branch-item.selected {
          background: #eef2ff;
          border-left: 3px solid #6366f1;
        }
        .branch-info { flex: 1; }
        .branch-name { font-size: 13px; font-weight: 500; color: #0f172a; font-family: monospace; }
        .branch-badge { font-size: 10px; padding: 2px 6px; background: #e2e8f0; border-radius: 20px; margin-left: 8px; }
        .branch-icon { font-size: 14px; color: #94a3b8; }

        .branch-selector-title {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 12px;
          margin-top: 8px;
        }

        .btn-secondary {
          width: 100%; padding: 12px;
          background: #f1f5f9; border: 1px solid #e2e8f0;
          border-radius: 12px; font-size: 13px; font-weight: 500;
          color: #475569; cursor: pointer;
          transition: all 0.2s; margin-top: 8px;
        }
        .btn-secondary:hover:not(:disabled) { background: #eef2ff; border-color: #cbd5e1; }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

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
        .spinner-dark {
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent; border: none;
          font-size: 13px; color: #64748b;
          cursor: pointer; margin-bottom: 20px;
        }
        .back-link:hover { color: #0f172a; }

        .selection-summary {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 12px;
          padding: 12px 16px;
          margin-top: 16px;
          font-size: 13px;
          color: #065f46;
        }

        .loading-text {
          text-align: center;
          padding: 24px;
          color: #64748b;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
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
              AuditPlatform · Configuration
            </div>
            <h1 className="title">Ajouter un dépôt GitLab</h1>
            <p className="subtitle">Entrez votre token, sélectionnez un projet et ses branches</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className={`step-number ${token ? "active" : ""}`}>1</div>
              <span className={`step-label ${token ? "active" : ""}`}>Token</span>
            </div>
            <div className="step-separator" />
            <div className="step">
              <div className={`step-number ${projetChoisi ? "active" : ""}`}>2</div>
              <span className={`step-label ${projetChoisi ? "active" : ""}`}>Projet</span>
            </div>
            <div className="step-separator" />
            <div className="step">
              <div className={`step-number ${branchePrincipale && brancheDeveloppement ? "active" : ""}`}>3</div>
              <span className={`step-label ${branchePrincipale && brancheDeveloppement ? "active" : ""}`}>Branches</span>
            </div>
          </div>

          {/* Étape 1: Token */}
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
                GitLab → Settings → Access Tokens → scopes : read_repository, write_repository, api
              </span>
            </div>

            <button
              className="btn-secondary"
              onClick={chargerProjets}
              disabled={loadingProjets || !token}
            >
              {loadingProjets ? <><div className="spinner-dark spinner" /> Chargement...</> : "🔍 Charger mes projets"}
            </button>
          </div>

          {/* Étape 2: Projets */}
          {projets.length > 0 && (
            <div className="card">
              <div className="card-title">📁 Sélectionnez un projet ({projets.length})</div>
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
            </div>
          )}

          {/* Étape 3: Branches */}
          {branches.length > 0 && (
            <div className="card">
              <div className="card-title">🌿 Branches disponibles ({branches.length})</div>

              <div className="branch-selector-title">
                📍 Branche principale
              </div>
              <div className="branches-list">
                {branches.map(branch => (
                  <div
                    key={branch.name}
                    className={`branch-item ${branchePrincipale === branch.name ? "selected" : ""}`}
                    onClick={() => setBranchePrincipale(branch.name)}
                  >
                    <div className="branch-info">
                      <span className="branch-name">{branch.name}</span>
                      {branch.default && <span className="branch-badge">par défaut</span>}
                    </div>
                    <div className="branch-icon">{branchePrincipale === branch.name ? "✓" : "→"}</div>
                  </div>
                ))}
              </div>

              <div className="branch-selector-title" style={{ marginTop: 20 }}>
                🔀 Branche de développement
              </div>
              <div className="branches-list">
                {branches.map(branch => (
                  <div
                    key={branch.name}
                    className={`branch-item ${brancheDeveloppement === branch.name ? "selected" : ""}`}
                    onClick={() => setBrancheDeveloppement(branch.name)}
                  >
                    <div className="branch-info">
                      <span className="branch-name">{branch.name}</span>
                      {branch.default && <span className="branch-badge">par défaut</span>}
                    </div>
                    <div className="branch-icon">{brancheDeveloppement === branch.name ? "✓" : "→"}</div>
                  </div>
                ))}
              </div>

              {branchePrincipale && brancheDeveloppement && (
                <div className="selection-summary">
                  ✓ Branches sélectionnées : <strong>{branchePrincipale}</strong> → <strong>{brancheDeveloppement}</strong>
                </div>
              )}
            </div>
          )}

          {loadingBranches && (
            <div className="card">
              <div className="loading-text">
                <div className="spinner-dark spinner" /> Chargement des branches...
              </div>
            </div>
          )}

          {erreur && (
            <div className="error">
              <span>⚠️</span> {erreur}
            </div>
          )}

          <button
            className="btn"
            onClick={handleSubmit}
            disabled={loading || !projetChoisi || !branchePrincipale || !brancheDeveloppement}
          >
            {loading ? (
              <><div className="spinner" /> Comparaison en cours...</>
            ) : (
              "Comparer les branches →"
            )}
          </button>

        </div>
      </div>
    </>
  );
}