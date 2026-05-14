"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

export default function DifferencePage() {
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
    modalBg: isDark ? "#141921" : "white",
    errorBg: "rgba(239,68,68,0.1)",
    errorBorder: "rgba(239,68,68,0.3)",
    errorText: "#ef4444",
  };

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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12, background: D.bg, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <div style={{ fontSize: 13, color: D.faint, fontFamily: "'JetBrains Mono', monospace" }}>Chargement des données...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!compareData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12, background: D.bg, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: 36, opacity: 0.1 }}>◈</div>
        <div style={{ fontSize: 13, color: D.faint, fontFamily: "'JetBrains Mono', monospace" }}>Aucune donnée disponible</div>
        <button
          style={{ padding: "8px 18px", background: D.btnPrimary, border: "none", borderRadius: 7, color: "#fff", fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, padding: 32 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/dashboard")} style={{ background: "transparent", border: `1px solid ${D.border}`, borderRadius: 7, color: D.muted, fontSize: 16, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ←
            </button>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: D.text }}>{compareData.project}</div>
              <div style={{ fontSize: 11, color: D.faint, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>Comparaison de branches</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ThemeToggle />
            <button
              onClick={analyserDiff}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 20px",
                background: "linear-gradient(135deg, #5b63f5, #818cf8)",
                border: "none", borderRadius: 8,
                color: "#fff", fontFamily: "'Inter', sans-serif",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} /> Analyse en cours...</> : "◎ Analyser et merger si propre"}
            </button>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "8px 18px", background: "transparent", border: `1px solid ${D.border}`, borderRadius: 7, color: D.muted, fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer" }}>
              ▦ Dashboard
            </button>
          </div>
        </div>

        {erreur && (
          <div style={{ background: D.errorBg, border: `1px solid ${D.errorBorder}`, borderRadius: 8, padding: "12px 14px", fontSize: 12, color: D.errorText, fontFamily: "'JetBrains Mono', monospace", marginBottom: 20 }}>
            ⚠ {erreur}
          </div>
        )}

        {resultat && !showConfirmation && (
          <div style={{
            borderRadius: 12,
            padding: 22,
            marginBottom: 28,
            border: "1px solid",
            background: resultat.statut === "merge_autorise" ? "#00d4aa08" : resultat.statut === "merge_bloque" ? "#ff6b6b08" : "#ffd16608",
            borderColor: resultat.statut === "merge_autorise" ? "#00d4aa30" : resultat.statut === "merge_bloque" ? "#ff6b6b30" : "#ffd16630"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>
                {resultat.statut === "merge_autorise" ? "✅" : resultat.statut === "merge_bloque" ? "🚫" : "⚠️"}
              </div>
              <div>
                <div style={{
                  fontSize: 16, fontWeight: 700, marginBottom: 4,
                  color: resultat.statut === "merge_autorise" ? "#00d4aa" : resultat.statut === "merge_bloque" ? "#ff6b6b" : "#ffd166"
                }}>
                  {resultat.statut === "merge_autorise"
                    ? "Code propre — Merge Request créée automatiquement !"
                    : resultat.statut === "merge_bloque"
                    ? `Merge bloqué — ${resultat.vulnerabilites_bloquantes?.length} vulnérabilité(s) critique(s) détectée(s)`
                    : "Erreur lors de l'analyse"}
                </div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: D.faint }}>
                  {resultat.statut === "merge_autorise"
                    ? `0 vulnérabilité CRITIQUE/HAUTE · MR ${compareData.from_branch} → ${compareData.to_branch} ouverte`
                    : resultat.statut === "merge_bloque"
                    ? "Corrige les vulnérabilités avant de merger"
                    : ""}
                </div>
              </div>
            </div>

            {resultat.score_qualite !== undefined && (
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                  { label: "Qualité", val: resultat.score_qualite },
                  { label: "Sécurité", val: resultat.score_securite },
                  { label: "Performance", val: resultat.score_performance },
                ].map(s => (
                  <div key={s.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 8, padding: "12px 18px", textAlign: "center", minWidth: 100 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color: couleur(s.val) }}>{s.val ?? "—"}</div>
                    <div style={{ fontSize: 9, color: D.faint, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>{s.label}</div>
                    <div style={{ height: 3, background: D.border, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                      <div style={{ width: `${s.val ?? 0}%`, height: 3, borderRadius: 2, background: couleur(s.val) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resultat.statut === "merge_autorise" && resultat.mr && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#00d4aa0d", border: "1px solid #00d4aa25", borderRadius: 8, padding: "14px 16px", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 600, flex: 1 }}>
                  🔀 MR #{resultat.mr.mr_id} — {compareData.from_branch} → {compareData.to_branch}
                </div>
                <a href={resultat.mr.mr_url} target="_blank" rel="noreferrer" style={{ padding: "8px 16px", background: "#00d4aa", border: "none", borderRadius: 7, color: "#000", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                  Voir la MR sur GitLab →
                </a>
              </div>
            )}

            {resultat.statut === "merge_bloque" && resultat.vulnerabilites_bloquantes?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  🚫 Vulnérabilités bloquantes ({resultat.vulnerabilites_bloquantes.length})
                </div>
                {resultat.vulnerabilites_bloquantes.map((v: any, i: number) => (
                  <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderLeft: `3px solid ${cSev(v.severite)}`, borderRadius: 7, padding: "10px 14px", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", padding: "2px 7px", borderRadius: 20, background: cSev(v.severite), color: "#000" }}>{v.severite}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: D.text }}>{v.type}</span>
                    </div>
                    <div style={{ fontSize: 10, color: D.faint, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>📄 {v.fichier} — ligne {v.ligne}</div>
                    <div style={{ fontSize: 11, color: D.muted, background: D.inputBg, padding: "6px 10px", borderRadius: 5 }}>💡 {v.suggestion}</div>
                  </div>
                ))}
                
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${D.border}`, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowConfirmation(true)}
                    style={{
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #ff6b6b, #ff4757)",
                      border: "none", borderRadius: 8,
                      color: "#fff", fontWeight: "bold",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      fontSize: 13
                    }}
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
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowConfirmation(false)}>
            <div style={{ background: D.modalBg, border: `1px solid ${D.border}`, borderRadius: 16, padding: 24, maxWidth: 500, width: "90%", color: D.text }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: "#ffd166", marginBottom: 16 }}>⚠️ Confirmation</h3>
              <p>Vous êtes sur le point de créer une Merge Request malgré les vulnérabilités suivantes :</p>
              <ul style={{ margin: "16px 0", paddingLeft: 20, maxHeight: 200, overflow: "auto" }}>
                {resultat.vulnerabilites_bloquantes?.slice(0, 5).map((v: any, i: number) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#ff6b6b" }}>[{v.severite}]</strong> {v.type}
                    <span style={{ fontSize: 11, color: D.faint, display: "block" }}>
                      📄 {v.fichier} — ligne {v.ligne}
                    </span>
                  </li>
                ))}
                {resultat.vulnerabilites_bloquantes?.length > 5 && (
                  <li style={{ color: D.faint, fontSize: 11 }}>
                    ... et {resultat.vulnerabilites_bloquantes.length - 5} autres
                  </li>
                )}
              </ul>
              <p style={{ marginBottom: 20, color: "#ffd166", fontSize: 13 }}>
                ⚠️ Cette action est déconseillée. La fusion pourrait introduire des vulnérabilités.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => setShowConfirmation(false)} style={{ padding: "8px 20px", background: "transparent", border: `1px solid ${D.border}`, borderRadius: 8, color: D.muted, cursor: "pointer" }}>
                  Annuler
                </button>
                <button onClick={creerMRForce} style={{ padding: "8px 20px", background: "#6c63ff", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  Créer la MR quand même
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
            <div style={{ fontSize: 10, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>Branches comparées</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
              <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 12, background: "#6c63ff12", color: "#9b91ff", border: "1px solid #6c63ff25" }}>{compareData.from_branch}</span>
              <span style={{ color: D.faint, fontSize: 16 }}>→</span>
              <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 12, background: "#00d4aa12", color: "#00d4aa", border: "1px solid #00d4aa25" }}>{compareData.to_branch}</span>
            </div>
          </div>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 10, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>Commits</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ffd16610", color: "#ffd166", border: "1px solid #ffd16625", borderRadius: 5, padding: "3px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, width: "fit-content" }}>
              ⊙ {compareData.commits_count} commit{compareData.commits_count !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 10, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>Fichiers modifiés</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: D.text, fontFamily: "'JetBrains Mono', monospace" }}>
              {compareData.files?.length ?? 0} fichier{compareData.files?.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          Fichiers modifiés
          <span style={{ background: D.border, color: D.muted, borderRadius: 20, padding: "1px 8px", fontSize: 10 }}>{compareData.files?.length ?? 0}</span>
        </div>

        {!compareData.files || compareData.files.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 10, background: D.card, border: `1px solid ${D.border}`, borderRadius: 10 }}>
            <div style={{ fontSize: 36, opacity: 0.1 }}>◇</div>
            <div style={{ fontSize: 12, color: D.faint, fontFamily: "'JetBrains Mono', monospace" }}>Aucun changement détecté</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {compareData.files.map((file: any, idx: number) => {
              const content: string = file.diff || file.content || "";
              const lines = content.split("\n");
              return (
                <div key={idx} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${D.border}`, gap: 10 }}>
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#9b91ff", wordBreak: "break-all" }}>{file.path}</span>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: "#6c63ff12", color: "#9b91ff", border: "1px solid #6c63ff20", borderRadius: 5, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>diff</span>
                  </div>
                  <pre style={{ margin: 0, padding: 16, background: D.inputBg, color: D.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre", maxHeight: 400, overflowY: "auto" }}>
                    {lines.map((line: string, i: number) => {
                      const cls = line.startsWith("+") ? "line-add" : line.startsWith("-") ? "line-del" : line.startsWith("@@") ? "line-info" : "";
                      if (cls === "line-add") return <span key={i} style={{ color: "#00d4aa", background: "#00d4aa08", display: "block" }}>{line}{"\n"}</span>;
                      if (cls === "line-del") return <span key={i} style={{ color: "#ff6b6b", background: "#ff6b6b08", display: "block" }}>{line}{"\n"}</span>;
                      if (cls === "line-info") return <span key={i} style={{ color: D.faint, display: "block" }}>{line}{"\n"}</span>;
                      return line + "\n";
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

