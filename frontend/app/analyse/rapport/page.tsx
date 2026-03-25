"use client";
import { useState, useEffect } from "react";
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

  // Charger les données depuis sessionStorage
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

    // Charger l'historique
    if (data.depot_analyse_id) {
      axios.get(`${API}/analyses/depot/${data.depot_analyse_id}`)
        .then(res => setHistorique(res.data))
        .catch(() => setHistorique([]));
    }

    // Afficher le pop-up si autoTests activé
    if (at) setTimeout(() => setShowPopup(true), 600);
  }, []);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
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

  const c = (s: number) => {
    if (!s && s !== 0) return "#3a4060";
    if (s >= 75) return "#00d4aa";
    if (s >= 50) return "#ffd166";
    return "#ff6b6b";
  };
  const cSev = (s: string) => {
    if (s === "CRITIQUE") return "#ff6b6b";
    if (s === "HAUTE")    return "#f97316";
    if (s === "MOYENNE")  return "#ffd166";
    return "#00d4aa";
  };

  if (!rapport) return null;

  const vulns = rapport.vulnerabilites || [];
  const recos = rapport.recommandations || [];
  const critiques = vulns.filter((v: any) => v.severite === "CRITIQUE").length;
  const hautes    = vulns.filter((v: any) => v.severite === "HAUTE").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page { min-height: 100vh; background: #060810; font-family: 'Inter', sans-serif; color: #c9cad6; padding: 0; }

        /* ── Topbar ── */
        .topbar {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 28px; border-bottom: 1px solid #1a1e35;
          background: #0b0d1a; position: sticky; top: 0; z-index: 10;
        }
        .back-btn {
          padding: 7px 14px; background: transparent;
          border: 1px solid #1a1e35; border-radius: 7px;
          color: #3a4060; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; cursor: pointer; transition: all 0.15s;
        }
        .back-btn:hover { border-color: #5b63f5; color: #818cf8; }
        .top-title { font-size: 14px; font-weight: 700; color: #e8eaf6; }
        .top-sub   { font-size: 10px; color: #3a4060; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
        .top-sep   { flex: 1; }
        .top-badge {
          font-size: 9px; font-family: 'JetBrains Mono', monospace;
          padding: 4px 10px; border-radius: 20px;
          background: #00d4aa10; border: 1px solid #00d4aa30; color: #00d4aa;
          display: flex; align-items: center; gap: 5px;
        }
        .dot-ok { width: 5px; height: 5px; border-radius: 50%; background: #00d4aa; animation: blink 2s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* ── Layout ── */
        .body { display: grid; grid-template-columns: 1fr 320px; gap: 0; min-height: calc(100vh - 56px); }
        .main { padding: 28px; overflow-y: auto; }
        .sidebar { border-left: 1px solid #1a1e35; padding: 20px; background: #0b0d1a; overflow-y: auto; }

        /* ── Scores ── */
        .scores-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
        .score-card {
          background: #0f1222; border: 1px solid #1a1e35; border-radius: 12px;
          padding: 20px; text-align: center; position: relative; overflow: hidden;
        }
        .score-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--sc); }
        .score-val { font-size: 44px; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: var(--sc); line-height: 1; margin-bottom: 6px; }
        .score-lbl { font-size: 9px; color: #3a4060; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
        .score-bar { height: 3px; background: #1a1e35; border-radius: 2px; overflow: hidden; }
        .score-fill { height: 3px; background: var(--sc); border-radius: 2px; }

        /* ── Résumé ── */
        .summary-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .sum-chip {
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          padding: 6px 12px; border-radius: 6px; font-weight: 600;
          border: 1px solid;
        }
        .chip-red    { color: #ff6b6b; background: #ff6b6b0d; border-color: #ff6b6b30; }
        .chip-orange { color: #f97316; background: #f973160d; border-color: #f9731630; }
        .chip-green  { color: #00d4aa; background: #00d4aa0d; border-color: #00d4aa30; }
        .chip-blue   { color: #818cf8; background: #818cf80d; border-color: #818cf830; }

        /* ── Tabs ── */
        .tabs { display: flex; gap: 2px; margin-bottom: 16px; background: #0b0d1a; border-radius: 9px; padding: 4px; border: 1px solid #1a1e35; width: fit-content; }
        .tab {
          padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; border: none; font-family: 'Inter', sans-serif;
          color: #3a4060; background: transparent;
        }
        .tab.active { background: #1a1e35; color: #e8eaf6; }
        .tab:hover:not(.active) { color: #6870a0; }

        /* ── Vuln card ── */
        .vuln-list { display: flex; flex-direction: column; gap: 10px; }
        .vuln-card {
          background: #0f1222; border: 1px solid #1a1e35;
          border-left: 3px solid var(--vc); border-radius: 10px; padding: 14px;
          transition: border-color 0.15s;
        }
        .vuln-card:hover { border-color: #252a45; }
        .vuln-top { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; flex-wrap: wrap; }
        .vuln-sev { font-size: 8px; font-weight: 700; font-family: 'JetBrains Mono', monospace; padding: 3px 8px; border-radius: 20px; background: var(--vc); color: #000; }
        .vuln-type { font-size: 13px; font-weight: 600; color: #e8eaf6; }
        .vuln-loc  { font-size: 10px; color: #3a4060; font-family: 'JetBrains Mono', monospace; margin-bottom: 8px; }
        .vuln-fix  { font-size: 12px; color: #6870a0; background: #080a14; padding: 8px 10px; border-radius: 6px; border-left: 2px solid #1a1e35; }

        /* ── Reco card ── */
        .reco-list { display: flex; flex-direction: column; gap: 10px; }
        .reco-card { background: #0f1222; border: 1px solid #1a1e35; border-radius: 10px; padding: 14px; }
        .reco-num   { font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #3a4060; margin-bottom: 5px; }
        .reco-titre { font-size: 13px; font-weight: 600; color: #00d4aa; margin-bottom: 5px; }
        .reco-desc  { font-size: 12px; color: #6870a0; line-height: 1.5; }

        /* ── Sidebar ── */
        .side-title { font-size: 9px; font-weight: 600; color: #3a4060; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #1a1e35; }
        .hist-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid #1a1e3540; cursor: pointer; transition: all 0.12s; }
        .hist-row:hover { padding-left: 4px; }
        .hist-row:last-child { border-bottom: none; }
        .hist-branch { font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #6870a0; flex: 1; }
        .hist-score  { font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .hist-date   { font-size: 9px; color: #3a4060; font-family: 'JetBrains Mono', monospace; }
        .hist-empty  { font-size: 11px; color: #2e3355; font-family: 'JetBrains Mono', monospace; padding: 12px 0; }

        .btn-gen {
          width: 100%; padding: 11px; margin-top: 16px;
          background: #5b63f5; border: none; border-radius: 8px;
          color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .btn-gen:hover { background: #4e57e0; }

        .clean-badge { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px; background: #00d4aa0d; border: 1px solid #00d4aa20; border-radius: 10px; color: #00d4aa; font-size: 14px; font-weight: 700; }

        /* ── Overlay popup ── */
        .overlay { position: fixed; inset: 0; background: #00000088; display: flex; align-items: center; justify-content: center; z-index: 100; }
        .popup { background: #0f1222; border: 1px solid #1a1e35; border-radius: 16px; padding: 32px; width: 460px; }
        .popup-icon { font-size: 36px; text-align: center; margin-bottom: 14px; }
        .popup-title { font-size: 18px; font-weight: 800; color: #e8eaf6; text-align: center; margin-bottom: 6px; }
        .popup-sub   { font-size: 12px; color: #3a4060; text-align: center; font-family: 'JetBrains Mono', monospace; margin-bottom: 20px; }
        .popup-scores { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 20px; }
        .ps-card { background: #080a14; border: 1px solid #1a1e35; border-radius: 8px; padding: 12px; text-align: center; }
        .ps-val  { font-size: 26px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
        .ps-lbl  { font-size: 9px; color: #3a4060; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; margin-top: 3px; }
        .popup-btns { display: flex; gap: 8px; }
        .pbtn-main { flex: 2; padding: 11px; background: #5b63f5; border: none; border-radius: 8px; color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
        .pbtn-main:hover { background: #4e57e0; }
        .pbtn-sec  { flex: 2; padding: 11px; background: transparent; border: 1px solid #1a1e35; border-radius: 8px; color: #6870a0; font-family: 'Inter', sans-serif; font-size: 13px; cursor: pointer; }
        .pbtn-sec:hover { border-color: #252a45; color: #c9cad6; }
        .pbtn-close { padding: 11px 14px; background: transparent; border: 1px solid #1a1e35; border-radius: 8px; color: #3a4060; font-size: 15px; cursor: pointer; }

        /* ── Loading overlay ── */
        .loading-overlay { position: fixed; inset: 0; background: #00000088; display: flex; align-items: center; justify-content: center; z-index: 100; }
        .loading-box { background: #0f1222; border: 1px solid #1a1e35; border-radius: 14px; padding: 36px; text-align: center; }
        .spin { width: 42px; height: 42px; border: 3px solid #1a1e35; border-top: 3px solid #5b63f5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-title { font-size: 14px; font-weight: 700; color: #e8eaf6; margin-bottom: 5px; }
        .loading-sub   { font-size: 11px; color: #3a4060; font-family: 'JetBrains Mono', monospace; }

        /* ── Notification MR ── */
        .mr-notif { position: fixed; bottom: 24px; right: 24px; background: #0f1222; border: 1px solid #00d4aa30; border-radius: 12px; padding: 18px; width: 360px; box-shadow: 0 8px 32px #00000060; z-index: 99; }
        .mr-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .mr-title { font-size: 13px; font-weight: 700; color: #00d4aa; }
        .mr-close { background: none; border: none; color: #3a4060; font-size: 16px; cursor: pointer; }
        .mr-line  { font-size: 11px; color: #6870a0; font-family: 'JetBrains Mono', monospace; margin-bottom: 5px; }
        .mr-link  { display: block; text-align: center; padding: 9px; background: #5b63f5; color: #fff; border-radius: 7px; font-size: 12px; font-weight: 600; text-decoration: none; margin-top: 10px; }
        .mr-link:hover { background: #4e57e0; }

        /* ── Steps ── */
        .steps { display: flex; align-items: center; gap: 8px; margin-bottom: 0; }
        .step { display: flex; align-items: center; gap: 6px; font-size: 10px; font-family: 'JetBrains Mono', monospace; }
        .step-num { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; }
        .sn-done { background: #00d4aa; color: #000; }
        .sn-active { background: #5b63f5; color: #fff; }
        .step-sep { width: 16px; height: 1px; background: #1a1e35; }
        .sl-done { color: #00d4aa; }
        .sl-active { color: #e8eaf6; font-weight: 600; }

        @media (max-width: 768px) {
          .body { grid-template-columns: 1fr; }
          .sidebar { border-left: none; border-top: 1px solid #1a1e35; }
        }
      `}</style>

      <div className="page">

        {/* Topbar */}
        <div className="topbar">
          <button className="back-btn" onClick={() => router.push("/analyse")}>
            ← Nouvelle analyse
          </button>
          <div>
            <div className="top-title">{nomProjet}</div>
            <div className="top-sub">branche : {branche}</div>
          </div>
          <div className="top-sep"/>
          <div className="steps">
            <div className="step">
              <div className="step-num sn-done">✓</div>
              <span className="sl-done">Formulaire</span>
            </div>
            <div className="step-sep"/>
            <div className="step">
              <div className="step-num sn-active">2</div>
              <span className="sl-active">Résultats</span>
            </div>
          </div>
          <div className="top-sep"/>
          <div className="top-badge">
            <div className="dot-ok"/>
            Analyse terminée
          </div>
        </div>

        {/* Body */}
        <div className="body">

          {/* ── MAIN ── */}
          <div className="main">

            {/* Scores */}
            <div className="scores-row">
              {[
                { label: "Qualité",     val: rapport.score_qualite },
                { label: "Sécurité",    val: rapport.score_securite },
                { label: "Performance", val: rapport.score_performance },
              ].map(s => (
                <div key={s.label} className="score-card" style={{ "--sc": c(s.val) } as any}>
                  <div className="score-val">{s.val ?? "—"}</div>
                  <div className="score-lbl">{s.label}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${s.val ?? 0}%` }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Résumé chips */}
            <div className="summary-row">
              {critiques > 0 && (
                <span className="sum-chip chip-red">⚠ {critiques} critique{critiques > 1 ? "s" : ""}</span>
              )}
              {hautes > 0 && (
                <span className="sum-chip chip-orange">↑ {hautes} haute{hautes > 1 ? "s" : ""}</span>
              )}
              <span className="sum-chip chip-blue">
                {vulns.length} vulnérabilité{vulns.length !== 1 ? "s" : ""}
              </span>
              <span className="sum-chip chip-green">
                {recos.length} recommandation{recos.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Erreur */}
            {erreur && (
              <div style={{ background: "#ff6b6b0d", border: "1px solid #ff6b6b30", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ff6b6b", fontFamily: "JetBrains Mono", marginBottom: 16 }}>
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
              vulns.length === 0
                ? <div className="clean-badge">✅ Aucune vulnérabilité détectée — Code propre !</div>
                : <div className="vuln-list">
                    {vulns.map((v: any, i: number) => (
                      <div key={i} className="vuln-card" style={{ "--vc": cSev(v.severite) } as any}>
                        <div className="vuln-top">
                          <span className="vuln-sev">{v.severite}</span>
                          <span className="vuln-type">{v.type}</span>
                        </div>
                        <div className="vuln-loc">📄 {v.fichier} — ligne {v.ligne}</div>
                        <div className="vuln-fix">💡 {v.suggestion}</div>
                      </div>
                    ))}
                  </div>
            )}

            {/* Recommandations */}
            {activeTab === "recos" && (
              recos.length === 0
                ? <div className="clean-badge">✅ Aucune recommandation — Code optimal !</div>
                : <div className="reco-list">
                    {recos.map((r: any, i: number) => (
                      <div key={i} className="reco-card">
                        <div className="reco-num">RECOMMANDATION #{i + 1}</div>
                        <div className="reco-titre">{r.titre}</div>
                        <div className="reco-desc">{r.description}</div>
                      </div>
                    ))}
                  </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="sidebar">

            {/* Générer tests */}
            <div className="side-title">Actions</div>
            <button className="btn-gen" onClick={() => setShowPopup(true)}>
              🧪 Générer les tests unitaires
            </button>

            {/* Historique */}
            {historique.length > 0 && (
              <>
                <div className="side-title" style={{ marginTop: 28 }}>
                  Historique — {nomProjet}
                </div>
                {historique.slice(0, 8).map((h: any) => (
                  <div
                    key={h.id}
                    className="hist-row"
                    onClick={() => setRapport(h)}
                  >
                    <span className="hist-branch">{h.branche}</span>
                    <span className="hist-score" style={{ color: c(h.score_qualite) }}>
                      {h.score_qualite ?? "—"}
                    </span>
                    <span className="hist-date">
                      {new Date(h.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
              </>
            )}

            {historique.length === 0 && (
              <>
                <div className="side-title" style={{ marginTop: 28 }}>Historique</div>
                <div className="hist-empty">Aucun historique</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── POP-UP TESTS ── */}
      {showPopup && (
        <div className="overlay">
          <div className="popup">
            <div className="popup-icon">🧪</div>
            <div className="popup-title">Analyse terminée !</div>
            <div className="popup-sub">Voulez-vous générer les tests unitaires ?</div>
            <div className="popup-scores">
              {[
                { label: "Qualité",     val: rapport.score_qualite },
                { label: "Sécurité",    val: rapport.score_securite },
                { label: "Performance", val: rapport.score_performance },
              ].map(s => (
                <div key={s.label} className="ps-card">
                  <div className="ps-val" style={{ color: c(s.val) }}>{s.val}</div>
                  <div className="ps-lbl">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="popup-btns">
              <button className="pbtn-main" onClick={() => genererTests(true)}>
                ✅ Générer + créer MR
              </button>
              <button className="pbtn-sec" onClick={() => genererTests(false)}>
                Sans MR
              </button>
              <button className="pbtn-close" onClick={() => setShowPopup(false)}>✖</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOADING TESTS ── */}
      {loadingTests && (
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="spin"/>
            <div className="loading-title">Génération des tests...</div>
            <div className="loading-sub">Le LLM analyse tout le code</div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATION MR ── */}
      {resultatMr && (
        <div className="mr-notif">
          <div className="mr-top">
            <span className="mr-title">✅ Tests générés !</span>
            <button className="mr-close" onClick={() => setResultatMr(null)}>✖</button>
          </div>
          <div className="mr-line">🧪 Langage : {resultatMr.langage}</div>
          <div className="mr-line">📁 Branche : {resultatMr.branche}</div>
          <div className="mr-line">📄 Fichier : {resultatMr.fichier}</div>
          {resultatMr.mr && (
            <>
              <div className="mr-line">🔀 MR : #{resultatMr.mr.mr_id}</div>
              <a className="mr-link" href={resultatMr.mr.mr_url} target="_blank" rel="noreferrer">
                Voir la MR dans GitLab →
              </a>
            </>
          )}
        </div>
      )}
    </>
  );
}