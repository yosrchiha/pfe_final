"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8001";

interface Test {
  id               : number;
  analyse_id       : number;
  depot_analyse_id : number;
  langage          : string;
  framework        : string;
  nom_fichier      : string;
  nb_tests         : number;
  nb_lots          : number;
  statut           : string;
  branche_cible    : string;
  created_at       : string;
  contenu         ?: string;
}

export default function TestsPage() {
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
    rowHover: isDark ? "#1a2030" : "#faf9fe",
    selectedBg: isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    codeBg: isDark ? "#0f1117" : "#f8fafc",
    statutPousse: { bg: isDark ? "#10b98120" : "#dcfce7", text: "#10b981" },
    statutGenere: { bg: isDark ? "#6366f120" : "#eef2ff", text: "#6366f1" },
    statutEchoue: { bg: isDark ? "#ef444420" : "#fee2e2", text: "#ef4444" },
  };

  const [tests,        setTests]        = useState<Test[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterLang,   setFilterLang]   = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [testDetail,   setTestDetail]   = useState<Test | null>(null);
  const [loadingDetail,setLoadingDetail]= useState(false);

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/tests/`, { headers: getHeaders() });
        setTests(res.data);
      } catch { setTests([]); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const voirContenu = async (test: Test) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/tests/${test.id}`, { headers: getHeaders() });
      setTestDetail(res.data);
    } catch { setTestDetail({ ...test, contenu: "Erreur de chargement" }); }
    finally { setLoadingDetail(false); }
  };

  const supprimerTest = async (id: number) => {
    if (!confirm("Supprimer ce test ?")) return;
    await axios.delete(`${API}/tests/${id}`, { headers: getHeaders() });
    setTests(prev => prev.filter(t => t.id !== id));
    if (testDetail?.id === id) setTestDetail(null);
  };

  const langages = ["tous", ...Array.from(new Set(tests.map(t => t.langage).filter(Boolean)))];

  const filtered = tests.filter(t => {
    const matchSearch = t.nom_fichier?.toLowerCase().includes(search.toLowerCase())
                     || t.langage?.toLowerCase().includes(search.toLowerCase())
                     || t.framework?.toLowerCase().includes(search.toLowerCase());
    const matchLang   = filterLang   === "tous" || t.langage   === filterLang;
    const matchStatut = filterStatut === "tous" || t.statut    === filterStatut;
    return matchSearch && matchLang && matchStatut;
  });

  const statutConfig = (s: string) => {
    if (s === "pousse")  return { bg: D.statutPousse.bg, text: D.statutPousse.text, icon: "✓", label: "Poussé" };
    if (s === "genere")  return { bg: D.statutGenere.bg, text: D.statutGenere.text, icon: "○", label: "Généré" };
    return { bg: D.statutEchoue.bg, text: D.statutEchoue.text, icon: "✕", label: "Échoué" };
  };

  const langageConfig = (l: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      java:       { bg: "#fef3c7", text: "#b45309" },
      python:     { bg: "#dbeafe", text: "#1e40af" },
      typescript: { bg: "#cffafe", text: "#0e7490" },
      javascript: { bg: "#fef9c3", text: "#a16207" },
      php:        { bg: "#ede9fe", text: "#6b21a5" },
      go:         { bg: "#e0f2fe", text: "#0c4a6e" },
      csharp:     { bg: "#e0e7ff", text: "#3730a3" },
    };
    if (isDark) {
      const darkColors: Record<string, { bg: string; text: string }> = {
        java:       { bg: "#b4530920", text: "#fcd34d" },
        python:     { bg: "#1e40af20", text: "#60a5fa" },
        typescript: { bg: "#0e749020", text: "#67e8f9" },
        javascript: { bg: "#a1620720", text: "#fde047" },
        php:        { bg: "#6b21a520", text: "#c084fc" },
        go:         { bg: "#0c4a6e20", text: "#7dd3fc" },
        csharp:     { bg: "#3730a320", text: "#a5b4fc" },
      };
      return darkColors[l] || { bg: D.tag, text: D.tagText };
    }
    return colors[l] || { bg: D.tag, text: D.tagText };
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text }}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", background: D.card, borderBottom: `1px solid ${D.border}`, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button onClick={() => router.push("/dashboard")} style={{ background: D.btnSec, border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted, display: "flex", alignItems: "center", gap: 6 }}>
              ← Tableau de bord
            </button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", margin: "0 0 4px 0" }}>Tests unitaires générés</h1>
              <p style={{ fontSize: 13, color: D.faint, margin: 0 }}>Générés automatiquement par l'IA pour tous vos projets</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />
            <div style={{ background: D.tag, borderRadius: 30, padding: "6px 14px", fontSize: 13, fontWeight: 500, color: D.tagText }}>{tests.length} test(s) en base</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "24px 32px" }}>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🧪</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: D.text, marginBottom: 4 }}>{tests.length}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total générés</div>
          </div>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🚀</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>{tests.filter(t => t.statut === "pousse").length}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Poussés sur GitLab</div>
          </div>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>{tests.reduce((a, t) => a + (t.nb_tests || 0), 0)}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tests unitaires</div>
          </div>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🌐</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#6366f1", marginBottom: 4 }}>{Array.from(new Set(tests.map(t => t.langage).filter(Boolean))).length}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Langages couverts</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, padding: "16px 32px", background: D.card, borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}`, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: D.faint, fontSize: 14 }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher par fichier, langage, framework..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 16px 10px 42px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 14, background: D.inputBg, color: D.text, outline: "none" }}
            />
          </div>
          <select value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ padding: "10px 16px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, background: D.inputBg, color: D.text, cursor: "pointer" }}>
            {langages.map(l => (
              <option key={l} value={l}>{l === "tous" ? "Tous les langages" : l}</option>
            ))}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={{ padding: "10px 16px", border: `1px solid ${D.border}`, borderRadius: 12, fontSize: 13, background: D.inputBg, color: D.text, cursor: "pointer" }}>
            <option value="tous">Tous les statuts</option>
            <option value="pousse">Poussé</option>
            <option value="genere">Généré</option>
            <option value="echoue">Échoué</option>
          </select>
          <span style={{ fontSize: 13, color: D.faint, background: D.tag, padding: "5px 12px", borderRadius: 20 }}>{filtered.length} résultat(s)</span>
        </div>

        {/* Table */}
        <div style={{ margin: "24px 32px", background: D.card, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 60, color: D.faint }}>
              <div style={{ width: 20, height: 20, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              Chargement des tests...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: D.faint }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
              <div>
                {tests.length === 0
                  ? "Aucun test généré — lance une analyse d'abord"
                  : "Aucun résultat pour cette recherche"}
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>#</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Fichier de test</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Langage</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Framework</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Nb tests</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Branche</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Statut</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Date</th>
                  <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 12, fontWeight: 600, color: D.faint, borderBottom: `1px solid ${D.border}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const status = statutConfig(t.statut);
                  const lang = langageConfig(t.langage);
                  return (
                    <tr key={t.id} onClick={() => voirContenu(t)} style={{ cursor: "pointer", borderBottom: `1px solid ${D.border}`, background: testDetail?.id === t.id ? D.selectedBg : "transparent" }}>
                      <td style={{ padding: "16px 20px", fontFamily: "monospace", color: D.muted, fontSize: 13 }}>#{t.id}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: "#6366f1" }}>{t.nom_fichier || "—"}</span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        {t.langage && (
                          <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: lang.bg, color: lang.text }}>
                            {t.langage}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px", color: D.muted, fontSize: 12 }}>{t.framework || "—"}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "monospace", color: D.text }}>{t.nb_tests || "—"}</span>
                      </td>
                      <td style={{ padding: "16px 20px", fontFamily: "monospace", fontSize: 12, color: D.muted, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.branche_cible || "—"}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 30, fontSize: 11, fontWeight: 500, background: status.bg, color: status.text }}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", fontFamily: "monospace", fontSize: 12, color: D.faint }}>
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: "16px 20px" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => voirContenu(t)} style={{ background: D.btnSec, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", color: D.muted }}>Voir</button>
                          <button onClick={() => supprimerTest(t.id)} style={{ background: "transparent", border: `1px solid ${D.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#ef4444" }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel latéral détail */}
        {testDetail && (
          <>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 15, display: "block" }} onClick={() => setTestDetail(null)} />
            <div style={{
              position: "fixed", right: 0, top: 0, width: 520, height: "100vh",
              background: D.card, borderLeft: `1px solid ${D.border}`,
              transform: "translateX(0)", transition: "transform 0.3s ease",
              zIndex: 20, display: "flex", flexDirection: "column",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.05)"
            }}>
              <div style={{ padding: 24, borderBottom: `1px solid ${D.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: D.text, fontFamily: "monospace", marginBottom: 4 }}>{testDetail.nom_fichier}</div>
                  <div style={{ fontSize: 11, color: D.faint }}>{testDetail.langage} · {testDetail.framework} · {new Date(testDetail.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <button onClick={() => setTestDetail(null)} style={{ background: D.btnSec, border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, color: D.muted }}>✕</button>
              </div>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ background: D.tag, padding: "4px 12px", borderRadius: 20, fontSize: 11, color: D.tagText }}>{testDetail.nb_tests} test{(testDetail.nb_tests ?? 0) > 1 ? "s" : ""}</span>
                <span style={{ background: D.tag, padding: "4px 12px", borderRadius: 20, fontSize: 11, color: D.tagText }}>{testDetail.nb_lots} lot(s) LLM</span>
                <span style={{ background: D.tag, padding: "4px 12px", borderRadius: 20, fontSize: 11, color: D.tagText }}>{testDetail.branche_cible || "branche inconnue"}</span>
                <span style={{ background: statutConfig(testDetail.statut).bg, color: statutConfig(testDetail.statut).text, padding: "4px 12px", borderRadius: 20, fontSize: 11 }}>
                  {statutConfig(testDetail.statut).icon} {statutConfig(testDetail.statut).label}
                </span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: D.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>📄 Contenu du fichier de test</div>
                {loadingDetail ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ width: 20, height: 20, border: `2px solid ${D.border}`, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto" }} />
                  </div>
                ) : (
                  <pre style={{ background: D.codeBg, border: `1px solid ${D.border}`, borderRadius: 12, padding: 20, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, color: D.text, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "auto" }}>
                    {testDetail.contenu || "Contenu non disponible"}
                  </pre>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
