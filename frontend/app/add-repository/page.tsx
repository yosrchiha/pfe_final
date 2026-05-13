"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8001";

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
    selectionBg: isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    selectionBorder: isDark ? "#6366f1" : "#6366f1",
    errorBg: "rgba(239,68,68,0.1)",
    errorBorder: "rgba(239,68,68,0.3)",
    errorText: "#ef4444",
  };

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
      
      const defaultBranch = res.data.branches.find((b: Branch) => b.default);
      if (defaultBranch) {
        setBranchePrincipale(defaultBranch.name);
      } else if (res.data.branches.some((b: Branch) => b.name === "main")) {
        setBranchePrincipale("main");
      } else if (res.data.branches.some((b: Branch) => b.name === "master")) {
        setBranchePrincipale("master");
      }
      
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
      const res = await fetch(`${API}/depots/`, {
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
        `${API}/depots/${depot.id}/compare`,
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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>

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
              AuditPlatform · Configuration
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", marginBottom: 8 }}>Ajouter un dépôt GitLab</h1>
            <p style={{ fontSize: 15, color: D.faint }}>Entrez votre token, sélectionnez un projet et ses branches</p>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
            {[
              { num: 1, label: "Token", active: !!token },
              { num: 2, label: "Projet", active: !!projetChoisi },
              { num: 3, label: "Branches", active: !!(branchePrincipale && brancheDeveloppement) },
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

          {/* Étape 1: Token */}
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
              <span style={{ display: "block", fontSize: 11, color: D.faint, marginTop: 5 }}>GitLab → Settings → Access Tokens → scopes : read_repository, write_repository, api</span>
            </div>

            <button
              onClick={chargerProjets}
              disabled={loadingProjets || !token}
              style={{ width: "100%", padding: 12, background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, fontWeight: 500, color: D.muted, cursor: "pointer" }}
            >
              {loadingProjets ? "Chargement..." : "🔍 Charger mes projets"}
            </button>
          </div>

          {/* Étape 2: Projets */}
          {projets.length > 0 && (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>📁 Sélectionnez un projet ({projets.length})</div>
              <div style={{ marginTop: 16, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                {projets.map(projet => (
                  <div
                    key={projet.id}
                    onClick={() => selectionnerProjet(projet)}
                    style={{
                      display: "flex", alignItems: "center", padding: "14px 16px",
                      borderBottom: `1px solid ${D.border}`, cursor: "pointer",
                      background: projetChoisi?.id === projet.id ? D.selectionBg : "transparent",
                      borderLeft: projetChoisi?.id === projet.id ? `3px solid ${D.selectionBorder}` : "3px solid transparent"
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
            </div>
          )}

          {/* Étape 3: Branches */}
          {branches.length > 0 && (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>🌿 Branches disponibles ({branches.length})</div>

              <div style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 12, marginTop: 8 }}>📍 Branche principale</div>
              <div style={{ marginTop: 16, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                {branches.map(branch => (
                  <div
                    key={branch.name}
                    onClick={() => setBranchePrincipale(branch.name)}
                    style={{
                      display: "flex", alignItems: "center", padding: "12px 16px",
                      borderBottom: `1px solid ${D.border}`, cursor: "pointer",
                      background: branchePrincipale === branch.name ? D.selectionBg : "transparent",
                      borderLeft: branchePrincipale === branch.name ? `3px solid ${D.selectionBorder}` : "3px solid transparent"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: D.text, fontFamily: "monospace" }}>{branch.name}</span>
                      {branch.default && <span style={{ fontSize: 10, padding: "2px 6px", background: D.tag, borderRadius: 20, marginLeft: 8, color: D.tagText }}>par défaut</span>}
                    </div>
                    <div style={{ fontSize: 14, color: D.faint }}>{branchePrincipale === branch.name ? "✓" : "→"}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: D.text, marginBottom: 12, marginTop: 20 }}>🔀 Branche de développement</div>
              <div style={{ marginTop: 16, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                {branches.map(branch => (
                  <div
                    key={branch.name}
                    onClick={() => setBrancheDeveloppement(branch.name)}
                    style={{
                      display: "flex", alignItems: "center", padding: "12px 16px",
                      borderBottom: `1px solid ${D.border}`, cursor: "pointer",
                      background: brancheDeveloppement === branch.name ? D.selectionBg : "transparent",
                      borderLeft: brancheDeveloppement === branch.name ? `3px solid ${D.selectionBorder}` : "3px solid transparent"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: D.text, fontFamily: "monospace" }}>{branch.name}</span>
                      {branch.default && <span style={{ fontSize: 10, padding: "2px 6px", background: D.tag, borderRadius: 20, marginLeft: 8, color: D.tagText }}>par défaut</span>}
                    </div>
                    <div style={{ fontSize: 14, color: D.faint }}>{brancheDeveloppement === branch.name ? "✓" : "→"}</div>
                  </div>
                ))}
              </div>

              {branchePrincipale && brancheDeveloppement && (
                <div style={{ background: D.selectionBg, border: `1px solid ${D.selectionBorder}`, borderRadius: 12, padding: "12px 16px", marginTop: 16, fontSize: 13, color: D.text }}>
                  ✓ Branches sélectionnées : <strong>{branchePrincipale}</strong> → <strong>{brancheDeveloppement}</strong>
                </div>
              )}
            </div>
          )}

          {loadingBranches && (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
              <div style={{ textAlign: "center", padding: 24, color: D.faint, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Chargement des branches...
              </div>
            </div>
          )}

          {erreur && (
            <div style={{ background: D.errorBg, border: `1px solid ${D.errorBorder}`, borderRadius: 14, padding: "14px 18px", fontSize: 13, color: D.errorText, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>⚠️</span> {erreur}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !projetChoisi || !branchePrincipale || !brancheDeveloppement}
            style={{ width: "100%", padding: "14px 24px", background: D.btnPrimary, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: (loading || !projetChoisi || !branchePrincipale || !brancheDeveloppement) ? 0.6 : 1 }}
          >
            {loading ? (
              <><div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Comparaison en cours...</>
            ) : (
              "Comparer les branches →"
            )}
          </button>

        </div>
      </div>
    </>
  );
}
