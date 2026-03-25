"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function AnalysePage() {
  const router = useRouter();

  const [nomProjet,  setNomProjet]  = useState("");
  const [token,      setToken]      = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [branche,    setBranche]    = useState("main");
  const [owasp,      setOwasp]      = useState(true);
  const [autoTests,  setAutoTests]  = useState(true);
  const [autoMr,     setAutoMr]     = useState(true);
  const [seuil,      setSeuil]      = useState(60);
  const [loading,    setLoading]    = useState(false);
  const [erreur,     setErreur]     = useState("");

  const couleurSeuil = (s: number) => {
    if (s >= 75) return "#00d4aa";
    if (s >= 50) return "#ffd166";
    return "#ff6b6b";
  };

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  const lancerAnalyse = async () => {
    if (!nomProjet.trim()) { setErreur("Le nom du projet est requis"); return; }
    if (!token.trim())     { setErreur("Le token GitLab est requis");  return; }
    if (!projectUrl.trim()){ setErreur("Le chemin du projet est requis"); return; }

    setLoading(true);
    setErreur("");

    try {
      const res = await axios.post(
        `${API}/analyses/lancer`,
        {
          nom_projet    : nomProjet,
          gitlab_token  : token,
          project_url   : projectUrl,
          branche,
          owasp_enabled : owasp,
          auto_tests    : autoTests,
          auto_mr       : autoMr,
          seuil_qualite : seuil,
        },
        { headers: getHeaders() }
      );

      // Sauvegarder le résultat et rediriger vers la page rapport
      sessionStorage.setItem("rapport",     JSON.stringify(res.data));
      sessionStorage.setItem("nomProjet",   nomProjet);
      sessionStorage.setItem("token",       token);
      sessionStorage.setItem("projectUrl",  projectUrl);
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
        setErreur("Erreur lors de l'analyse — vérifiez le token et le chemin du projet");
      }
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
          background: #060810;
          font-family: 'Inter', sans-serif;
          color: #c9cad6;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
        }

        .container {
          width: 100%;
          max-width: 560px;
        }

        /* ── En-tête ── */
        .header { text-align: center; margin-bottom: 36px; }
        .badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: #5b63f510; border: 1px solid #5b63f530;
          border-radius: 20px; padding: 4px 14px;
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          color: #818cf8; letter-spacing: 0.08em; margin-bottom: 16px;
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #818cf8; animation: blink 2s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        .title { font-size: 28px; font-weight: 700; color: #e8eaf6; letter-spacing: -0.02em; margin-bottom: 8px; }
        .subtitle { font-size: 13px; color: #3a4060; font-family: 'JetBrains Mono', monospace; }

        /* ── Card ── */
        .card {
          background: #0f1222;
          border: 1px solid #1a1e35;
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 14px;
        }
        .card-title {
          font-size: 11px; font-weight: 600; color: #3a4060;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 18px; padding-bottom: 10px;
          border-bottom: 1px solid #1a1e35;
        }

        /* ── Champs ── */
        .field { margin-bottom: 16px; }
        .field:last-child { margin-bottom: 0; }
        .label {
          display: block; font-size: 11px; font-weight: 600;
          color: #6870a0; margin-bottom: 6px;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .input {
          width: 100%; background: #080a14;
          border: 1px solid #1a1e35; border-radius: 8px;
          padding: 10px 14px; color: #e8eaf6;
          font-family: 'JetBrains Mono', monospace; font-size: 13px;
          outline: none; transition: border-color 0.15s;
        }
        .input::placeholder { color: #2e3355; }
        .input:focus { border-color: #5b63f555; box-shadow: 0 0 0 3px #5b63f510; }
        .hint { font-size: 10px; color: #2e3355; font-family: 'JetBrains Mono', monospace; margin-top: 5px; display: block; }

        /* ── Options ── */
        .option {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid #1a1e3540;
        }
        .option:last-of-type { border-bottom: none; }
        .checkbox { width: 16px; height: 16px; accent-color: #5b63f5; margin-top: 2px; flex-shrink: 0; cursor: pointer; }
        .option-text { flex: 1; cursor: pointer; }
        .option-title { display: block; font-size: 13px; font-weight: 500; color: #c9cad6; margin-bottom: 2px; }
        .option-desc  { display: block; font-size: 11px; color: #3a4060; font-family: 'JetBrains Mono', monospace; }

        /* ── Seuil ── */
        .seuil-wrap { padding-top: 14px; }
        .seuil-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
        .range { flex: 1; accent-color: #5b63f5; cursor: pointer; }
        .seuil-val { font-size: 16px; font-weight: 700; font-family: 'JetBrains Mono', monospace; min-width: 52px; text-align: right; }

        /* ── Erreur ── */
        .erreur {
          background: #ff6b6b10; border: 1px solid #ff6b6b30;
          border-radius: 8px; padding: 12px 14px;
          font-size: 12px; color: #ff6b6b;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 14px;
        }

        /* ── Bouton ── */
        .btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #5b63f5, #818cf8);
          border: none; border-radius: 10px;
          color: #fff; font-family: 'Inter', sans-serif;
          font-size: 15px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px #5b63f540; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .spin {
          width: 16px; height: 16px;
          border: 2px solid #ffffff40;
          border-top: 2px solid #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Steps indicator ── */
        .steps { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 28px; }
        .step { display: flex; align-items: center; gap: 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
        .step-num { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
        .step-active .step-num  { background: #5b63f5; color: #fff; }
        .step-done .step-num    { background: #00d4aa; color: #000; }
        .step-pending .step-num { background: #1a1e35; color: #3a4060; }
        .step-active .step-lbl  { color: #e8eaf6; font-weight: 600; }
        .step-pending .step-lbl { color: #2e3355; }
        .step-sep { width: 24px; height: 1px; background: #1a1e35; }
      `}</style>

      <div className="page">
        <div className="container">

          {/* En-tête */}
          <div className="header">
            <div className="badge">
              <div className="dot"/>
              Plateforme Audit GitLab
            </div>
            <h1 className="title">Analyser un projet</h1>
            <p className="subtitle">Renseignez les infos du projet pour lancer l'audit IA</p>
          </div>

          {/* Steps */}
          <div className="steps">
            <div className="step step-active">
              <div className="step-num">1</div>
              <span className="step-lbl">Formulaire</span>
            </div>
            <div className="step-sep"/>
            <div className="step step-pending">
              <div className="step-num">2</div>
              <span className="step-lbl">Résultats</span>
            </div>
          </div>

          {/* Card 1 — Infos projet */}
          <div className="card">
            <div className="card-title">Projet GitLab</div>

            <div className="field">
              <label className="label">Nom du projet</label>
              <input className="input" type="text" placeholder="ex: mon-projet-pfe"
                value={nomProjet} onChange={e => setNomProjet(e.target.value)} />
            </div>

            <div className="field">
              <label className="label">Token d'accès GitLab</label>
              <input className="input" type="password" placeholder="glpat-xxxxxxxxxxxx"
                value={token} onChange={e => setToken(e.target.value)} />
              <span className="hint">GitLab → Settings → Access Tokens → scopes : api, write_repository</span>
            </div>

            <div className="field">
              <label className="label">Chemin du projet</label>
              <input className="input" type="text" placeholder="username/nom-du-projet"
                value={projectUrl} onChange={e => setProjectUrl(e.target.value)} />
              <span className="hint">Ex: yosrchiha01/plateforme-audit-ia ou URL HTTPS complète</span>
            </div>

            <div className="field">
              <label className="label">Branche</label>
              <input className="input" type="text" placeholder="main"
                value={branche} onChange={e => setBranche(e.target.value)} />
            </div>
          </div>

          {/* Card 2 — Options */}
          <div className="card">
            <div className="card-title">Options d'analyse</div>

            {[
              { id: "owasp",     val: owasp,     set: setOwasp,     title: "Analyse OWASP Top 10",        desc: "Détecte les 10 failles de sécurité les plus critiques" },
              { id: "autoTests", val: autoTests, set: setAutoTests, title: "Générer les tests unitaires", desc: "L'IA génère les tests pour tout le code" },
              { id: "autoMr",    val: autoMr,    set: setAutoMr,    title: "Créer une Merge Request",     desc: "Pousse les tests sur GitLab et ouvre une MR" },
            ].map(opt => (
              <div key={opt.id} className="option">
                <input type="checkbox" id={opt.id} checked={opt.val}
                  onChange={e => opt.set(e.target.checked)} className="checkbox" />
                <label htmlFor={opt.id} className="option-text">
                  <span className="option-title">{opt.title}</span>
                  <span className="option-desc">{opt.desc}</span>
                </label>
              </div>
            ))}

            <div className="seuil-wrap">
              <label className="label">Seuil minimum de qualité</label>
              <div className="seuil-row">
                <input type="range" min={0} max={100} value={seuil}
                  onChange={e => setSeuil(parseInt(e.target.value))} className="range" />
                <span className="seuil-val" style={{ color: couleurSeuil(seuil) }}>
                  {seuil}/100
                </span>
              </div>
            </div>
          </div>

          {/* Erreur */}
          {erreur && <div className="erreur">⚠ {erreur}</div>}

          {/* Bouton */}
          <button className="btn" onClick={lancerAnalyse} disabled={loading}>
            {loading
              ? <><div className="spin"/> Analyse en cours — patience...</>
              : "Lancer l'analyse →"
            }
          </button>

        </div>
      </div>
    </>
  );
}