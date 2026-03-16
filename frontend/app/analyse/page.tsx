// frontend/app/analyse/page.tsx
"use client";
import { useState } from "react";
import axios from "axios";
import styles from "./analyse.module.css";

const API = "http://127.0.0.1:8000";

export default function AnalysePage() {

  // ── Formulaire ───────────────────────────────────────
  const [nomProjet,  setNomProjet]  = useState("");
  const [token,      setToken]      = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [branche,    setBranche]    = useState("main");

  // ── Options ──────────────────────────────────────────
  const [owasp,     setOwasp]     = useState(true);
  const [autoTests, setAutoTests] = useState(true);
  const [autoMr,    setAutoMr]    = useState(true);
  const [seuil,     setSeuil]     = useState(60);

  // ── Résultat ─────────────────────────────────────────
  const [loading,    setLoading]    = useState(false);
  const [rapport,    setRapport]    = useState<any>(null);
  const [erreur,     setErreur]     = useState("");
  const [historique, setHistorique] = useState<any[]>([]);

  // ── Couleurs ─────────────────────────────────────────
  const couleurScore = (s: number) => {
    if (!s && s !== 0) return "#94a3b8";
    if (s >= 75) return "#16a34a";
    if (s >= 50) return "#d97706";
    return "#dc2626";
  };

  const couleurSeverite = (s: string) => {
    if (s === "CRITIQUE") return "#dc2626";
    if (s === "HAUTE")    return "#ea580c";
    if (s === "MOYENNE")  return "#d97706";
    return "#16a34a";
  };

  // ── Lancer l'analyse ─────────────────────────────────
  const lancerAnalyse = async () => {
    // Validation
    if (!nomProjet.trim()) {
      setErreur("Le nom du projet est requis");
      return;
    }
    if (!token.trim()) {
      setErreur("Le token GitLab est requis");
      return;
    }
    if (!projectUrl.trim()) {
      setErreur("L'URL du projet est requise");
      return;
    }

    setLoading(true);
    setRapport(null);
    setErreur("");

    try {
      const res = await axios.post(`${API}/analyses/lancer`, {
        nom_projet    : nomProjet,
        gitlab_token  : token,
        project_url   : projectUrl,
        branche       : branche,
        owasp_enabled : owasp,
        auto_tests    : autoTests,
        auto_mr       : autoMr,
        seuil_qualite : seuil,
      });

      setRapport(res.data);

      // Charger l'historique du dépôt
      if (res.data.depot_analyse_id) {
        try {
          const hist = await axios.get(
            `${API}/analyses/depot/${res.data.depot_analyse_id}`
          );
          setHistorique(hist.data);
        } catch {
          setHistorique([]);
        }
      }

    } catch (e: any) {
      // Gérer detail tableau ou string
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErreur(
          detail.map((d: any) => d.msg).join(", ")
        );
      } else if (typeof detail === "string") {
        setErreur(detail);
      } else {
        setErreur("Erreur lors de l'analyse");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <h1 className={styles.title}>Analyse de code</h1>
        <p className={styles.subtitle}>
          Remplis les informations du projet et lance l'analyse
        </p>
      </div>

      <div className={styles.body}>

        {/* ════════════════════════════════════════
            COLONNE GAUCHE
        ════════════════════════════════════════ */}
        <div className={styles.left}>

          {/* ── 1. Infos du projet ── */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              1. Informations du projet GitLab
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label className={styles.label}>
                Nom du projet
              </label>
              <input
                type="text"
                placeholder="ex: mon-projet-pfe"
                value={nomProjet}
                onChange={e => setNomProjet(e.target.value)}
                className={styles.input}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className={styles.label}>
                Token GitLab
              </label>
              <input
                type="password"
                placeholder="glpat-xxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
                className={styles.input}
              />
              <span className={styles.hint}>
                GitLab → Settings → Access Tokens
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className={styles.label}>
                Chemin du projet
              </label>
              <input
                type="text"
                placeholder="username/nom-du-projet"
                value={projectUrl}
                onChange={e => setProjectUrl(e.target.value)}
                className={styles.input}
              />
              <span className={styles.hint}>
                Ex: ahmed/mon-projet ou https://gitlab.com/ahmed/mon-projet
              </span>
            </div>

            <div>
              <label className={styles.label}>
                Branche à analyser
              </label>
              <input
                type="text"
                placeholder="main"
                value={branche}
                onChange={e => setBranche(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          {/* ── 2. Options ── */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              2. Options d'analyse
            </h2>

            <div className={styles.option}>
              <input
                type="checkbox"
                id="owasp"
                checked={owasp}
                onChange={e => setOwasp(e.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="owasp" className={styles.optionLabel}>
                <span className={styles.optionTitle}>
                  Analyse sécurité OWASP
                </span>
                <span className={styles.optionDesc}>
                  Détecte les failles OWASP Top 10
                </span>
              </label>
            </div>

            <div className={styles.option}>
              <input
                type="checkbox"
                id="autoTests"
                checked={autoTests}
                onChange={e => setAutoTests(e.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="autoTests" className={styles.optionLabel}>
                <span className={styles.optionTitle}>
                  Générer les tests unitaires
                </span>
                <span className={styles.optionDesc}>
                  Génère les tests après l'analyse
                </span>
              </label>
            </div>

            <div className={styles.option}>
              <input
                type="checkbox"
                id="autoMr"
                checked={autoMr}
                onChange={e => setAutoMr(e.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="autoMr" className={styles.optionLabel}>
                <span className={styles.optionTitle}>
                  Créer la Merge Request
                </span>
                <span className={styles.optionDesc}>
                  Crée une MR pour les tests générés
                </span>
              </label>
            </div>

            <div className={styles.seuilWrap}>
              <label className={styles.label}>
                Seuil minimum de qualité
              </label>
              <div className={styles.seuilRow}>
                <input
                  type="range"
                  min={0} max={100}
                  value={seuil}
                  onChange={e => setSeuil(parseInt(e.target.value))}
                  className={styles.range}
                />
                <span
                  className={styles.seuilVal}
                  style={{ color: couleurScore(seuil) }}
                >
                  {seuil}/100
                </span>
              </div>
            </div>
          </div>

          {/* ── Erreur ── */}
          {erreur && (
            <div className={styles.erreur}>
              ⚠️ {erreur}
            </div>
          )}

          {/* ── Bouton ── */}
          <button
            className={styles.btnAnalyse}
            onClick={lancerAnalyse}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}/>
                Analyse en cours...
              </>
            ) : (
              "🚀 Lancer l'analyse"
            )}
          </button>

          {/* ── Historique ── */}
          {historique.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                Historique — {nomProjet}
              </h2>
              {historique.slice(0, 5).map((h: any) => (
                <div
                  key={h.id}
                  className={styles.histRow}
                  onClick={() => setRapport(h)}
                >
                  <span className={styles.histBranche}>
                    {h.branche}
                  </span>
                  <span
                    className={styles.histScore}
                    style={{ color: couleurScore(h.score_qualite) }}
                  >
                    {h.score_qualite}/100
                  </span>
                  <span className={styles.histDate}>
                    {new Date(h.created_at)
                      .toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════
            COLONNE DROITE — Rapport
        ════════════════════════════════════════ */}
        <div className={styles.right}>

          {/* Etat vide */}
          {!rapport && !loading && (
            <div className={styles.empty}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
              <p>Remplis le formulaire et lance l'analyse</p>
              <p style={{ fontSize: 13, color: "#94a3b8" }}>
                Le rapport apparaîtra ici
              </p>
            </div>
          )}

          {/* Chargement */}
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinnerBig}/>
              <p>Récupération des fichiers GitLab...</p>
              <p className={styles.loadingSub}>
                Analyse LLM en cours, quelques secondes...
              </p>
            </div>
          )}

          {/* Rapport */}
          {rapport && !loading && (
            <div className={styles.rapport}>

              {/* En-tête */}
              <div style={{
                display        : "flex",
                justifyContent : "space-between",
                alignItems     : "center",
                marginBottom   : 24,
                paddingBottom  : 16,
                borderBottom   : "1px solid #e2e8f0"
              }}>
                <div>
                  <h2 className={styles.rapportTitle}>
                    Rapport — {nomProjet}
                  </h2>
                  <span style={{
                    fontSize   : 12,
                    color      : "#64748b",
                    fontFamily : "monospace"
                  }}>
                    Branche : {rapport.branche}
                  </span>
                </div>
                <span style={{
                  background   : "#f0fdf4",
                  border       : "1px solid #bbf7d0",
                  borderRadius : 20,
                  padding      : "4px 14px",
                  fontSize     : 12,
                  color        : "#16a34a",
                  fontWeight   : "bold"
                }}>
                  ✅ Terminé
                </span>
              </div>

              {/* Scores */}
              <div className={styles.scores}>
                {[
                  { label: "Qualité",
                    val: rapport.score_qualite },
                  { label: "Sécurité",
                    val: rapport.score_securite },
                  { label: "Performance",
                    val: rapport.score_performance },
                ].map(s => (
                  <div key={s.label} className={styles.scoreCard}>
                    <div
                      className={styles.scoreVal}
                      style={{ color: couleurScore(s.val) }}
                    >
                      {s.val ?? "—"}
                    </div>
                    <div className={styles.scoreLabel}>
                      {s.label}
                    </div>
                    <div className={styles.scoreBar}>
                      <div
                        className={styles.scoreBarFill}
                        style={{
                          width      : `${s.val ?? 0}%`,
                          background : couleurScore(s.val)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Vulnérabilités */}
              {rapport.vulnerabilites?.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    ⚠️ Vulnérabilités (
                      {rapport.vulnerabilites.length}
                    )
                  </h3>
                  {rapport.vulnerabilites.map(
                    (v: any, i: number) => (
                    <div key={i} className={styles.vuln}>
                      <div className={styles.vulnHeader}>
                        <span
                          className={styles.vulnBadge}
                          style={{
                            background : couleurSeverite(v.severite)
                                         + "22",
                            color      : couleurSeverite(v.severite),
                            border     : `1px solid
                              ${couleurSeverite(v.severite)}`
                          }}
                        >
                          {v.severite}
                        </span>
                        <span className={styles.vulnType}>
                          {v.type}
                        </span>
                      </div>
                      <div className={styles.vulnFichier}>
                        📄 {v.fichier} — ligne {v.ligne}
                      </div>
                      <div className={styles.vulnSuggestion}>
                        💡 {v.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommandations */}
              {rapport.recommandations?.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    ✅ Recommandations (
                      {rapport.recommandations.length}
                    )
                  </h3>
                  {rapport.recommandations.map(
                    (r: any, i: number) => (
                    <div key={i} className={styles.reco}>
                      <div className={styles.recoTitre}>
                        {r.titre}
                      </div>
                      <div className={styles.recoDesc}>
                        {r.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Code propre */}
              {rapport.vulnerabilites?.length === 0 && (
                <div className={styles.success}>
                  ✅ Aucune vulnérabilité — Code propre !
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}