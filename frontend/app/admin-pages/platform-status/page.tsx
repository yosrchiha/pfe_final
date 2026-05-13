"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders } from "../adminUtils";

// ── Types ──────────────────────────────────────────────────────────────────
interface CompRow   { label: string; cur: number; prev: number; delta: number | null }
interface TrendDay  { date: string; analyses: number }
interface SegInfo   { count: number; pct: number }
interface FeatItem  { name: string; pct: number; color: string }
interface SvcItem   { name: string; latency_ms: number | null; status: string; uptime: string }

interface PlatformData {
  generated_at: string
  kpis: {
    utilisateurs_actifs: number
    total_users: number
    analyses_cette_semaine: number
    score_securite_moyen: number
    videos_cette_semaine: number
    vulns_critiques: number
  }
  comparaison_semaine: CompRow[]
  comparaison_jour:    CompRow[]
  tendance_14j:        TrendDay[]
  segmentation: { debutant: SegInfo; expert: SegInfo; entreprise: SegInfo }
  usage_fonctionnalites: FeatItem[]
  vulns: { critiques: number; resume: Record<string, number> }
  services: SvcItem[]
  ia: {
    synthese:            string
    prediction:          string
    alerte:              string
    insight_debutants:   string
    insight_experts:     string
    insight_entreprises: string
    feature_tendance:    string
    score: { valeur: number; interpretation: string }
  }
}

// ── Palette ────────────────────────────────────────────────────────────────
const T = {
  bg: "#07090f", card: "#0a0c14", border: "#1e2235",
  text: "#f1f3fc", muted: "#a8b0d0", faint: "#5a6080",
  accent: "#818cf8",
}

// ── Helpers ────────────────────────────────────────────────────────────────
const scoreCol = (s: number) => s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#f87171"
const deltaCol = (d: number | null) => d === null ? T.faint : d >= 0 ? "#22c55e" : "#f87171"
const deltaStr = (d: number | null) => d === null ? "—" : (d >= 0 ? "+" : "") + d + "%"
const latCol   = (ms: number | null) => !ms ? "#f87171" : ms < 300 ? "#22c55e" : ms < 1500 ? "#f59e0b" : "#f87171"
const latStr   = (ms: number | null) => !ms ? "—" : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`

// ── Atoms ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) => (
  <div style={{ background: `${color}12`, border: `1px solid ${color}28`, borderRadius: 12, padding: "16px 18px" }}>
    <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: ".1em", marginBottom: 7 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono',monospace", marginTop: 7 }}>{sub}</div>
  </div>
)

const IABox = ({ label, text, color = "#38bdf8" }: { label: string; text: string; color?: string }) => (
  <div style={{ background: `${color}08`, borderLeft: `3px solid ${color}50`, borderRadius: "0 8px 8px 0", padding: "10px 14px", marginTop: 12 }}>
    <div style={{ fontSize: 10, color, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: ".1em", marginBottom: 4 }}>✦ IA — {label}</div>
    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.65 }}>{text}</div>
  </div>
)

const Row = ({ label, cur, prev, delta, last }: CompRow & { last?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: last ? "none" : `1px solid ${T.border}` }}>
    <span style={{ fontSize: 13, color: T.text }}>{label}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
        {prev} → <b style={{ color: T.text }}>{cur}</b>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: deltaCol(delta) }}>
        {deltaStr(delta)}
      </span>
    </div>
  </div>
)

type Tab = "comparaison" | "segmentation" | "fonctionnalites" | "sante"

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function Sparkline({ data }: { data: TrendDay[] }) {
  if (!data.length) return null
  const vals = data.map(d => d.analyses)
  const max  = Math.max(...vals, 1)
  const W = 600; const H = 110
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - (v / max) * (H - 12) - 6
    return [x, y] as [number, number]
  })
  const poly   = pts.map(p => p.join(",")).join(" ")
  const area   = `0,${H} ` + poly + ` ${W},${H}`
  const labels = [0, Math.floor(vals.length / 2), vals.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 110 }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#818cf8" stopOpacity=".18" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)" />
      <polyline points={poly} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={labels.includes(i) ? 3.5 : 2} fill="#818cf8" opacity={labels.includes(i) ? 1 : .5} />
          {labels.includes(i) && (
            <text x={x} y={H - 1} textAnchor="middle" fontSize={9} fill={T.faint} fontFamily="monospace">
              {data[i].date}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PlatformStatusPage() {
  const router = useRouter()
  const [data,       setData]       = useState<PlatformData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState("")
  const [tab,        setTab]        = useState<Tab>("comparaison")
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    setError("")
    try {
      const res = await axios.get(`${API}/admin/platform/status`, { headers: getHeaders() })
      setData(res.data)
    } catch (e: any) {
      setError(e?.response?.status === 403 ? "Accès refusé." : "Erreur de chargement — vérifie le backend.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Loader ─────────────────────────────────────────────────────
  if (loading) return (
    <AdminLayout>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, background: T.bg }}>
        <div style={{ width: 34, height: 34, border: "2px solid rgba(129,140,248,.2)", borderTopColor: "#818cf8", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 5 }}>Analyse IA en cours…</div>
          <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>OpenRouter génère les insights de la plateforme</div>
        </div>
      </div>
    </AdminLayout>
  )

  if (error || !data) return (
    <AdminLayout>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>⚠</div>
          <p style={{ color: T.text, fontWeight: 700, marginBottom: 16 }}>{error || "Erreur inconnue"}</p>
          <button onClick={() => load()} style={{ padding: "10px 22px", background: "rgba(129,140,248,.1)", border: "1px solid rgba(129,140,248,.25)", borderRadius: 10, color: T.accent, cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
            Réessayer
          </button>
        </div>
      </div>
    </AdminLayout>
  )

  const { kpis, comparaison_semaine, comparaison_jour, tendance_14j, segmentation, usage_fonctionnalites, vulns, services, ia } = data

  const TABS: [Tab, string][] = [
    ["comparaison",     "Comparaison temporelle"],
    ["segmentation",    "Segmentation IA"],
    ["fonctionnalites", "Fonctionnalités"],
    ["sante",           "Santé système"],
  ]

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.45} }
        .rh:hover { background:rgba(255,255,255,.02); }
        .eb { transition:all .15s; } .eb:hover { opacity:.8; transform:scale(.97); }
        .tbtn { padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;color:#5a6080;font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;cursor:pointer;transition:all .15s; }
        .tbtn.on { color:#818cf8;border-bottom-color:#818cf8; }
      `}</style>

      <div style={{ flex: 1, background: T.bg, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div style={{ padding: "24px 36px 20px", borderBottom: `1px solid ${T.border}`, background: T.card }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 10, color: T.accent, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: ".18em", marginBottom: 6 }}>◈ TABLEAU DE BORD IA</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: "-.02em" }}>État de la Plateforme</h1>
              <p style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>
                Généré par OpenRouter · {new Date(data.generated_at).toLocaleString("fr-FR")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 11, color: "#22c55e", fontFamily: "'JetBrains Mono',monospace" }}>opérationnelle</span>
              </div>
              <button className="eb" onClick={() => load(true)}
                style={{ padding: "8px 16px", background: "rgba(129,140,248,.1)", border: "1px solid rgba(129,140,248,.25)", borderRadius: 9, color: T.accent, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                {refreshing ? "…" : "↻ Actualiser"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 36px", flex: 1 }}>

          {/* ── KPIs ───────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 22, animation: "fadeIn .3s ease" }}>
            <KpiCard label="Utilisateurs actifs"  value={kpis.utilisateurs_actifs}      sub="cette semaine"   color="#818cf8" />
            <KpiCard label="Analyses lancées"     value={kpis.analyses_cette_semaine}   sub="cette semaine"   color="#60a5fa" />
            <KpiCard label="Score sécurité moyen" value={`${kpis.score_securite_moyen}/100`} sub="cette semaine" color={scoreCol(kpis.score_securite_moyen)} />
            <KpiCard label="Vidéos générées"      value={kpis.videos_cette_semaine}     sub="cette semaine"   color="#a78bfa" />
            <KpiCard label="Vulns critiques"      value={kpis.vulns_critiques}          sub="cette semaine"   color={kpis.vulns_critiques > 0 ? "#f87171" : "#22c55e"} />
          </div>

          {/* ── SYNTHÈSE IA ─────────────────────────────────────────── */}
          <div style={{ background: T.card, border: "1px solid rgba(56,189,248,.2)", borderRadius: 14, padding: "20px 24px", marginBottom: 22, animation: "fadeIn .4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: ".15em" }}>
                ✦ Synthèse IA — OpenRouter
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(56,189,248,.12)" }} />
            </div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.75, marginBottom: 14 }}>{ia.synthese}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)", borderRadius: 9, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#22c55e", fontFamily: "'JetBrains Mono',monospace", marginBottom: 5, textTransform: "uppercase" as const }}>Prédiction 7 jours</div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{ia.prediction}</div>
              </div>
              <div style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.15)", borderRadius: 9, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#f87171", fontFamily: "'JetBrains Mono',monospace", marginBottom: 5, textTransform: "uppercase" as const }}>⚠ Alerte principale</div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{ia.alerte}</div>
              </div>
            </div>
          </div>

          {/* ── SPARKLINE 14 JOURS ──────────────────────────────────── */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 22, animation: "fadeIn .45s ease" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              Évolution des analyses — 14 derniers jours
            </div>
            <Sparkline data={tendance_14j} />
          </div>

          {/* ── TABS ────────────────────────────────────────────────── */}
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
            {TABS.map(([id, label]) => (
              <button key={id} className={`tbtn ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {/* ── COMPARAISON TEMPORELLE ──────────────────────────────── */}
          {tab === "comparaison" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, animation: "fadeIn .25s ease" }}>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.text }}>
                  Cette semaine vs semaine dernière
                </div>
                <div style={{ padding: "0 20px" }}>
                  {comparaison_semaine.map((r, i) => (
                    <Row key={i} {...r} last={i === comparaison_semaine.length - 1} />
                  ))}
                </div>
                <div style={{ padding: "0 20px 18px" }}>
                  <IABox label="Tendance fonctionnalité" text={ia.feature_tendance} />
                </div>
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.text }}>
                  Aujourd'hui vs hier
                </div>
                <div style={{ padding: "0 20px" }}>
                  {comparaison_jour.map((r, i) => (
                    <Row key={i} {...r} last={i === comparaison_jour.length - 1} />
                  ))}
                </div>
                {/* Vulns résumé */}
                <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: ".08em", marginBottom: 10 }}>
                    Vulnérabilités cette semaine
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(vulns.resume).map(([sev, cnt]) => {
                      const cols: Record<string, string> = { CRITIQUE: "#f87171", HAUTE: "#f59e0b", MOYENNE: "#60a5fa", FAIBLE: "#22c55e" }
                      const c = cols[sev] || T.faint
                      return (
                        <div key={sev} style={{ background: `${c}12`, border: `1px solid ${c}28`, borderRadius: 7, padding: "4px 10px", display: "flex", gap: 6, alignItems: "center" }}>
                          <b style={{ color: c, fontSize: 15 }}>{cnt}</b>
                          <span style={{ color: T.faint, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{sev.toLowerCase()}</span>
                        </div>
                      )
                    })}
                    {Object.keys(vulns.resume).length === 0 && (
                      <span style={{ fontSize: 12, color: "#22c55e", fontFamily: "'JetBrains Mono',monospace" }}>✓ Aucune vulnérabilité cette semaine</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SEGMENTATION ────────────────────────────────────────── */}
          {tab === "segmentation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn .25s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {([
                  { key: "debutant",   label: "Débutants",   color: "#60a5fa", insight: ia.insight_debutants },
                  { key: "expert",     label: "Experts",     color: "#22c55e", insight: ia.insight_experts },
                  { key: "entreprise", label: "Entreprises", color: "#f59e0b", insight: ia.insight_entreprises },
                ] as { key: keyof typeof segmentation; label: string; color: string; insight: string }[]).map(s => {
                  const seg = segmentation[s.key]
                  return (
                    <div key={s.key} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.label}</span>
                        <span style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}28`, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          {seg.pct}%
                        </span>
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: s.color, marginBottom: 10 }}>{seg.count}</div>
                      <div style={{ height: 5, background: "rgba(255,255,255,.06)", borderRadius: 3, marginBottom: 14 }}>
                        <div style={{ height: 5, background: s.color, borderRadius: 3, width: `${seg.pct}%`, transition: "width .6s ease" }} />
                      </div>
                      <IABox label="IA observe" text={s.insight} color={s.color} />
                    </div>
                  )
                })}
              </div>

              {/* Score sécurité */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 22px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 14 }}>Score sécurité global — interprétation IA</div>
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                  <div style={{ textAlign: "center", minWidth: 80 }}>
                    <div style={{ fontSize: 44, fontWeight: 800, color: scoreCol(ia.score.valeur), lineHeight: 1 }}>{ia.score.valeur}</div>
                    <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>/ 100</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 7, background: "rgba(255,255,255,.06)", borderRadius: 4, marginBottom: 10 }}>
                      <div style={{ height: 7, background: `linear-gradient(90deg,#f87171,#f59e0b,#22c55e)`, borderRadius: 4, width: `${ia.score.valeur}%`, transition: "width .8s ease" }} />
                    </div>
                    <div style={{ fontSize: 13, color: T.muted }}>{ia.score.interpretation}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FONCTIONNALITÉS ─────────────────────────────────────── */}
          {tab === "fonctionnalites" && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", animation: "fadeIn .25s ease" }}>
              <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.text }}>
                Taux d'utilisation réel — % d'utilisateurs actifs
              </div>
              <div style={{ padding: "6px 22px" }}>
                {usage_fonctionnalites.map((f, i) => (
                  <div key={i} className="rh" style={{ padding: "14px 0", borderBottom: i < usage_fonctionnalites.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: T.text }}>{f.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: f.color, fontFamily: "'JetBrains Mono',monospace" }}>{f.pct}%</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,.06)", borderRadius: 3 }}>
                      <div style={{ height: 5, background: f.color, borderRadius: 3, width: `${f.pct}%`, transition: "width .6s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0 22px 18px" }}>
                <IABox label="Tendance" text={ia.feature_tendance} />
              </div>
            </div>
          )}

          {/* ── SANTÉ SYSTÈME ───────────────────────────────────────── */}
          {tab === "sante" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn .25s ease" }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, color: T.text }}>
                  Services — ping temps réel
                </div>
                <div style={{ padding: "4px 22px" }}>
                  {services.map((s, i) => {
                    const ok = s.status === "ok"
                    return (
                      <div key={i} className="rh" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < services.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "#22c55e" : "#f87171", flexShrink: 0, animation: ok ? "pulse 2s infinite" : "none" }} />
                        <span style={{ fontSize: 13, color: T.text, flex: 1 }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: latCol(s.latency_ms), fontFamily: "'JetBrains Mono',monospace" }}>{latStr(s.latency_ms)}</span>
                        <span style={{ background: ok ? "rgba(34,197,94,.12)" : "rgba(248,113,113,.12)", color: ok ? "#22c55e" : "#f87171", border: `1px solid ${ok ? "rgba(34,197,94,.25)" : "rgba(248,113,113,.25)"}`, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          {s.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <IABox label="Diagnostic IA" text={ia.alerte} color="#f87171" />
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  )
}
