"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function DifferencePage() {
  const router = useRouter();
  const [compareData, setCompareData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [erreur, setErreur] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [analyseId, setAnalyseId] = useState<number | null>(null);

  useEffect(() => {
    console.log("[DEBUG] Page difference chargée");
    const stored = localStorage.getItem("compareData");
    console.log("[DEBUG] Données dans localStorage:", stored ? "Présentes" : "Absentes");
    
    if (stored) {
      try {
        const data = JSON.parse(stored);
        console.log("[DEBUG] Données parsées:", data);
        console.log("[DEBUG] depot_id présent?", data.depot_id);
        setCompareData(data);
        localStorage.removeItem("compareData");
      } catch (e) {
        console.error("[DEBUG] Erreur parsing:", e);
      }
    }
    setLoadingData(false);
  }, []);

  const couleur = (s: number) => {
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

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  const analyserDiff = async () => {
    if (!compareData) return;
    
    console.log("[DEBUG] compareData.depot_id:", compareData.depot_id);
    
    setLoading(true);
    setResultat(null);
    setErreur("");
    setShowConfirmation(false);

    try {
      const res = await axios.post(
        `${API}/depots/${compareData.depot_id}/analyser-diff`,
        {
          owasp_enabled: true,
        },
        { headers: getHeaders() }
      );
      
      const data = res.data;
      setResultat(data);
      
      // Si l'analyse est bloquée, on stocke l'ID pour la confirmation
      if (data.statut === "merge_bloque" && data.vulnerabilites_bloquantes?.length > 0) {
        setAnalyseId(data.analyse_id);
      }
      
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setErreur(typeof detail === "string" ? detail : "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const creerMRForce = async () => {
    if (!analyseId || !compareData) return;
    
    setLoading(true);
    setErreur("");
    setShowConfirmation(false);
    
    try {
      const res = await axios.post(
        `${API}/depots/${compareData.depot_id}/creer-mr-force`,
        {
          analyse_id: analyseId,
        },
        { headers: getHeaders() }
      );
      
      // Mettre à jour le résultat avec la MR créée
      setResultat((prev: any) => ({
        ...prev,
        statut: "merge_autorise",
        message: "MR créée (forcée)",
        mr: res.data.mr
      }));
      
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setErreur(typeof detail === "string" ? detail : "Erreur lors de la création de la MR");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="no-data">
        <div className="spin" style={{ width: 32, height: 32 }} />
        <div className="no-data-txt">Chargement des données...</div>
      </div>
    );
  }

  if (!compareData) {
    return (
      <div className="no-data">
        <div style={{ fontSize: 36, opacity: 0.1 }}>◈</div>
        <div className="no-data-txt">Aucune donnée disponible</div>
        <button
          style={{ padding: "8px 18px", background: "#6c63ff", border: "none", borderRadius: 7, color: "#fff", fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          onClick={() => router.push("/dashboard")}
        >
          ← Retour à la dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page { min-height: 100vh; background: #0d0e12; font-family: 'Inter', sans-serif; color: #c9cad6; padding: 32px; }

        .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .back-btn { background: transparent; border: 1px solid #1c1d26; border-radius: 7px; color: #555; font-size: 16px; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .back-btn:hover { border-color: #333; color: #aaa; }
        .page-title { font-size: 20px; font-weight: 700; color: #fff; }
        .page-sub   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; margin-top: 3px; }

        .topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .btn-analyser {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 20px;
          background: linear-gradient(135deg, #5b63f5, #818cf8);
          border: none; border-radius: 8px;
          color: #fff; font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          box-shadow: 0 4px 14px #5b63f530;
        }
        .btn-analyser:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px #5b63f545; }
        .btn-analyser:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .btn-dash { padding: 8px 18px; background: transparent; border: 1px solid #1c1d26; border-radius: 7px; color: #666; font-family: 'Inter', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.15s; }
        .btn-dash:hover { border-color: #333; color: #aaa; }

        .resultat { border-radius: 12px; padding: 22px; margin-bottom: 28px; border: 1px solid; }
        .res-ok  { background: #00d4aa08; border-color: #00d4aa30; }
        .res-nok { background: #ff6b6b08; border-color: #ff6b6b30; }
        .res-err { background: #ffd16608; border-color: #ffd16630; }

        .res-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
        .res-icon { font-size: 32px; line-height: 1; }
        .res-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .res-sub   { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #555; }
        .c-ok  { color: #00d4aa; }
        .c-nok { color: #ff6b6b; }
        .c-warn { color: #ffd166; }

        .scores { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .sc { background: #0d0e12; border: 1px solid #1c1d26; border-radius: 8px; padding: 12px 18px; text-align: center; min-width: 100px; }
        .sc-val { font-size: 26px; font-weight: 800; font-family: 'JetBrains Mono', monospace; line-height: 1; }
        .sc-lbl { font-size: 9px; color: #444; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }
        .sc-bar { height: 3px; background: #1c1d26; border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .sc-fill { height: 3px; border-radius: 2px; }

        .mr-box { display: flex; align-items: center; gap: 12px; background: #00d4aa0d; border: 1px solid #00d4aa25; border-radius: 8px; padding: 14px 16px; flex-wrap: wrap; }
        .mr-txt  { font-size: 13px; color: #00d4aa; font-weight: 600; flex: 1; }
        .mr-link { padding: 8px 16px; background: #00d4aa; border: none; border-radius: 7px; color: #000; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none; }
        .mr-link:hover { background: #00bfa0; }

        .vuln-sec   { margin-top: 16px; }
        .vuln-title { font-size: 10px; font-weight: 600; color: #555; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .vuln-item  { background: #0d0e12; border: 1px solid #1c1d26; border-left: 3px solid; border-radius: 7px; padding: 10px 14px; margin-bottom: 6px; }
        .vuln-top   { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .vuln-sev   { font-size: 8px; font-weight: 700; font-family: 'JetBrains Mono', monospace; padding: 2px 7px; border-radius: 20px; color: #000; }
        .vuln-type  { font-size: 12px; font-weight: 600; color: #e8e8f0; }
        .vuln-loc   { font-size: 10px; color: #444; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; }
        .vuln-fix   { font-size: 11px; color: #666; background: #111218; padding: 6px 10px; border-radius: 5px; }

        .erreur-box { background: #ff6b6b0d; border: 1px solid #ff6b6b30; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #ff6b6b; font-family: 'JetBrains Mono', monospace; margin-bottom: 20px; }

        .meta-row  { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
        .meta-card { background: #111218; border: 1px solid #1c1d26; border-radius: 10px; padding: 14px 20px; display: flex; flex-direction: column; gap: 4px; min-width: 160px; }
        .meta-label { font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; }
        .meta-value { font-size: 14px; font-weight: 600; color: #e8e8f0; font-family: 'JetBrains Mono', monospace; }
        .branch-flow { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
        .branch-tag  { padding: 3px 9px; border-radius: 5px; font-size: 12px; }
        .branch-from { background: #6c63ff12; color: #9b91ff; border: 1px solid #6c63ff25; }
        .branch-to   { background: #00d4aa12; color: #00d4aa;  border: 1px solid #00d4aa25; }
        .branch-arrow { color: #333; font-size: 16px; }
        .commits-badge { display: inline-flex; align-items: center; gap: 6px; background: #ffd16610; color: #ffd166; border: 1px solid #ffd16625; border-radius: 5px; padding: 3px 10px; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; }

        .section-label { font-size: 10px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .section-count { background: #1c1d26; color: #666; border-radius: 20px; padding: 1px 8px; font-size: 10px; }
        .files-list { display: flex; flex-direction: column; gap: 14px; }
        .file-card  { background: #111218; border: 1px solid #1c1d26; border-radius: 10px; overflow: hidden; }
        .file-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #1c1d26; gap: 10px; }
        .file-path  { font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #9b91ff; word-break: break-all; }
        .file-badge { font-size: 10px; font-family: 'JetBrains Mono', monospace; background: #6c63ff12; color: #9b91ff; border: 1px solid #6c63ff20; border-radius: 5px; padding: 2px 8px; white-space: nowrap; flex-shrink: 0; }
        .file-diff  { margin: 0; padding: 16px; background: #0d0e12; color: #c9cad6; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.7; overflow-x: auto; white-space: pre; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #2a2b38 transparent; }
        .line-add  { color: #00d4aa; background: #00d4aa08; display: block; }
        .line-del  { color: #ff6b6b; background: #ff6b6b08; display: block; }
        .line-info { color: #555; display: block; }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 10px; background: #111218; border: 1px solid #1c1d26; border-radius: 10px; }
        .empty-icon { font-size: 36px; opacity: 0.1; }
        .empty-txt  { font-size: 12px; color: #444; font-family: 'JetBrains Mono', monospace; }

        .no-data { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 12px; background: #0d0e12; font-family: 'Inter', sans-serif; }
        .no-data-txt { font-size: 13px; color: #444; font-family: 'JetBrains Mono', monospace; }

        .spin { width: 14px; height: 14px; border: 2px solid #ffffff30; border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Modal styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: #111218;
          border: 1px solid #1c1d26;
          border-radius: 16px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          color: #c9cad6;
        }
        .modal h3 {
          color: #ffd166;
          margin-bottom: 16px;
        }
        .modal-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .modal-cancel {
          padding: 8px 20px;
          background: transparent;
          border: 1px solid #1c1d26;
          border-radius: 8px;
          color: #888;
          cursor: pointer;
        }
        .modal-submit {
          padding: 8px 20px;
          background: #6c63ff;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .modal-submit:hover {
          background: #5b52e0;
        }

        .force-mr-btn {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #1c1d26;
          display: flex;
          justify-content: flex-end;
        }
        .btn-force {
          padding: 10px 20px;
          background: linear-gradient(135deg, #ff6b6b, #ff4757);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          transition: all 0.2s;
        }
        .btn-force:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
        }
      `}</style>

      <div className="page">

        <div className="topbar">
          <div className="topbar-left">
            <button className="back-btn" onClick={() => router.push("/dashboard")}>←</button>
            <div>
              <div className="page-title">{compareData.project}</div>
              <div className="page-sub">Comparaison de branches</div>
            </div>
          </div>
          <div className="topbar-right">
            <button
              className="btn-analyser"
              onClick={analyserDiff}
              disabled={loading}
            >
              {loading
                ? <><div className="spin"/> Analyse en cours...</>
                : <>◎ Analyser et merger si propre</>
              }
            </button>
            <button className="btn-dash" onClick={() => router.push("/dashboard")}>
              ▦ Dashboard
            </button>
          </div>
        </div>

        {erreur && <div className="erreur-box">⚠ {erreur}</div>}

        {resultat && !showConfirmation && (
          <div className={`resultat ${
            resultat.statut === "merge_autorise" ? "res-ok" :
            resultat.statut === "merge_bloque"   ? "res-nok" : "res-err"
          }`}>
            <div className="res-top">
              <div className="res-icon">
                {resultat.statut === "merge_autorise" ? "✅" :
                 resultat.statut === "merge_bloque"   ? "🚫" : "⚠️"}
              </div>
              <div>
                <div className={`res-title ${
                  resultat.statut === "merge_autorise" ? "c-ok" :
                  resultat.statut === "merge_bloque"   ? "c-nok" : "c-warn"
                }`}>
                  {resultat.statut === "merge_autorise"
                    ? "Code propre — Merge Request créée automatiquement !"
                    : resultat.statut === "merge_bloque"
                    ? `Merge bloqué — ${resultat.vulnerabilites_bloquantes?.length} vulnérabilité(s) critique(s) détectée(s)`
                    : "Erreur lors de l'analyse"}
                </div>
                <div className="res-sub">
                  {resultat.statut === "merge_autorise"
                    ? `0 vulnérabilité CRITIQUE/HAUTE · MR ${compareData.from_branch} → ${compareData.to_branch} ouverte`
                    : resultat.statut === "merge_bloque"
                    ? "Corrige les vulnérabilités avant de merger"
                    : ""}
                </div>
              </div>
            </div>

            {resultat.score_qualite !== undefined && (
              <div className="scores">
                {[
                  { label: "Qualité", val: resultat.score_qualite },
                  { label: "Sécurité", val: resultat.score_securite },
                  { label: "Performance", val: resultat.score_performance },
                ].map(s => (
                  <div key={s.label} className="sc">
                    <div className="sc-val" style={{ color: couleur(s.val) }}>{s.val ?? "—"}</div>
                    <div className="sc-lbl">{s.label}</div>
                    <div className="sc-bar">
                      <div className="sc-fill" style={{ width: `${s.val ?? 0}%`, background: couleur(s.val) }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resultat.statut === "merge_autorise" && resultat.mr && (
              <div className="mr-box">
                <div className="mr-txt">
                  🔀 MR #{resultat.mr.mr_id} — {compareData.from_branch} → {compareData.to_branch}
                </div>
                <a className="mr-link" href={resultat.mr.mr_url} target="_blank" rel="noreferrer">
                  Voir la MR sur GitLab →
                </a>
              </div>
            )}

            {resultat.statut === "merge_bloque" && resultat.vulnerabilites_bloquantes?.length > 0 && (
              <div className="vuln-sec">
                <div className="vuln-title">
                  🚫 Vulnérabilités bloquantes ({resultat.vulnerabilites_bloquantes.length})
                </div>
                {resultat.vulnerabilites_bloquantes.map((v: any, i: number) => (
                  <div key={i} className="vuln-item" style={{ borderLeftColor: cSev(v.severite) }}>
                    <div className="vuln-top">
                      <span className="vuln-sev" style={{ background: cSev(v.severite) }}>{v.severite}</span>
                      <span className="vuln-type">{v.type}</span>
                    </div>
                    <div className="vuln-loc">📄 {v.fichier} — ligne {v.ligne}</div>
                    <div className="vuln-fix">💡 {v.suggestion}</div>
                  </div>
                ))}
                
                {/* Bouton pour forcer la MR - DIRECTEMENT ICI */}
                <div className="force-mr-btn">
                  <button
                    className="btn-force"
                    onClick={() => setShowConfirmation(true)}
                  >
                    ⚠️ Créer la Merge Request quand même
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de confirmation */}
        {showConfirmation && resultat && (
          <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>⚠️ Confirmation</h3>
              <p>Vous êtes sur le point de créer une Merge Request malgré les vulnérabilités suivantes :</p>
              <ul style={{ margin: "16px 0", paddingLeft: 20, maxHeight: 200, overflow: "auto" }}>
                {resultat.vulnerabilites_bloquantes?.slice(0, 5).map((v: any, i: number) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#ff6b6b" }}>[{v.severite}]</strong> {v.type}
                    <span style={{ fontSize: 11, color: "#888", display: "block" }}>
                      📄 {v.fichier} — ligne {v.ligne}
                    </span>
                  </li>
                ))}
                {resultat.vulnerabilites_bloquantes?.length > 5 && (
                  <li style={{ color: "#888", fontSize: 11 }}>
                    ... et {resultat.vulnerabilites_bloquantes.length - 5} autres
                  </li>
                )}
              </ul>
              <p style={{ marginBottom: 20, color: "#ffd166", fontSize: 13 }}>
                ⚠️ Cette action est déconseillée. La fusion pourrait introduire des vulnérabilités.
              </p>
              <div className="modal-buttons">
                <button className="modal-cancel" onClick={() => setShowConfirmation(false)}>
                  Annuler
                </button>
                <button className="modal-submit" onClick={creerMRForce}>
                  Créer la MR quand même
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="meta-row">
          <div className="meta-card">
            <div className="meta-label">Branches comparées</div>
            <div className="branch-flow">
              <span className="branch-tag branch-from">{compareData.from_branch}</span>
              <span className="branch-arrow">→</span>
              <span className="branch-tag branch-to">{compareData.to_branch}</span>
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-label">Commits</div>
            <div className="commits-badge">
              ⊙ {compareData.commits_count} commit{compareData.commits_count !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="meta-card">
            <div className="meta-label">Fichiers modifiés</div>
            <div className="meta-value">
              {compareData.files?.length ?? 0} fichier{compareData.files?.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="section-label">
          Fichiers modifiés
          <span className="section-count">{compareData.files?.length ?? 0}</span>
        </div>

        {!compareData.files || compareData.files.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◇</div>
            <div className="empty-txt">Aucun changement détecté</div>
          </div>
        ) : (
          <div className="files-list">
            {compareData.files.map((file: any, idx: number) => {
              const content: string = file.diff || file.content || "";
              const lines = content.split("\n");
              return (
                <div key={idx} className="file-card">
                  <div className="file-header">
                    <span className="file-path">{file.path}</span>
                    <span className="file-badge">diff</span>
                  </div>
                  <pre className="file-diff">
                    {lines.map((line, i) => {
                      const cls = line.startsWith("+") ? "line-add"
                                : line.startsWith("-") ? "line-del"
                                : line.startsWith("@@") ? "line-info"
                                : "";
                      return cls
                        ? <span key={i} className={cls}>{line}{"\n"}</span>
                        : line + "\n";
                    })}
                  </pre>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}