"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import AdminLayout from "../../../AdminLayout";
import { API, getHeaders } from "../../../adminUtils";

// ── Types ──────────────────────────────────────────────────────────────────
interface UserDetail {
  id: number;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
  depot_count: number;
}

interface AnalyseEvent {
  id: number;
  depot_nom: string;
  branche: string;
  score_qualite: number;
  score_securite: number;
  score_performance: number;
  statut: string;
  created_at: string;
  nb_vulns: number;
}

interface VideoEvent {
  id: number;
  type_video: string;
  titre: string;
  langue: string;
  nom_projet?: string;
  created_at: string;
}

interface RapportEvent {
  id: number;
  nom_projet: string;
  created_at: string;
  nb_pages?: number;
}

interface LoginEventItem {
  id: number;
  event_type: "login_success" | "login_failure" | "logout";
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  created_at: string;
  logout_at: string | null;
}

interface ActivityStats {
  total_analyses: number;
  total_videos: number;
  total_rapports: number;
  sessions_actives: number;
  derniere_activite?: string;
}

// ── Palette ────────────────────────────────────────────────────────────────
const T = {
  bg:        "#07090f",
  card:      "#0a0c14",
  card2:     "#0c0f1a",
  border:    "#1e2235",
  border2:   "#252840",
  text:      "#f1f3fc",
  muted:     "#a8b0d0",
  faint:     "#5a6080",
  input:     "#07090f",
  accentTxt: "#818cf8",
  accent:    "#818cf8",
  green:     "#22c55e",
  amber:     "#f59e0b",
  red:       "#f87171",
  purple:    "#a78bfa",
  blue:      "#60a5fa",
  orange:    "#f97316",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function fmtDateShort(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
    " · " + d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function timeAgo(iso: string) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function sessionDuration(login: string, logout: string | null): string {
  if (!logout) return "en cours";
  const secs = Math.floor((new Date(logout).getTime() - new Date(login).getTime()) / 1000);
  if (secs < 60)    return `${secs}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)} min`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function scoreColor(s: number) {
  return s >= 80 ? T.green : s >= 60 ? T.amber : T.red;
}

function scoreBadge(s: number) {
  if (s >= 80) return { label: "bon",      bg: "rgba(34,197,94,0.12)",  color: T.green,  border: "rgba(34,197,94,0.25)"  };
  if (s >= 60) return { label: "moyen",    bg: "rgba(245,158,11,0.12)", color: T.amber,  border: "rgba(245,158,11,0.25)" };
  return           { label: "critique", bg: "rgba(248,113,113,0.12)",color: T.red,    border: "rgba(248,113,113,0.25)" };
}

function initials(username: string, email: string) {
  const name = username || email;
  return name.slice(0, 2).toUpperCase();
}

function parseUA(ua: string | null): string {
  if (!ua) return "Navigateur inconnu";
  if (ua.includes("Chrome"))  return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari"))  return "Safari";
  if (ua.includes("Edge"))    return "Edge";
  return ua.slice(0, 30);
}

function loginEventConfig(ev: LoginEventItem) {
  switch (ev.event_type) {
    case "login_success": return { icon: "🔓", color: T.green,  label: "Connexion réussie",  bg: "rgba(34,197,94,0.08)"  };
    case "login_failure": return { icon: "🔒", color: T.red,    label: "Échec de connexion", bg: "rgba(248,113,113,0.08)" };
    case "logout":        return { icon: "🚪", color: T.faint,  label: "Déconnexion",        bg: "rgba(90,96,128,0.08)"  };
    default:              return { icon: "·",  color: T.faint,  label: ev.event_type,        bg: "transparent"           };
  }
}

// ── Composants atomiques ───────────────────────────────────────────────────
const Badge = ({ label, bg, color, border }: { label: string; bg: string; color: string; border: string }) => (
  <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 20, padding: "3px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
    {label}
  </span>
);

// ── Mini jauge circulaire SVG ─────────────────────────────────────────────
function CircleScore({ value, color, size = 52 }: { value: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Stat card grande ──────────────────────────────────────────────────────
function BigStat({ label, value, sub, color, icon }: { label: string; value: number | string; sub: string; color: string; icon: string }) {
  return (
    <div style={{ background: `${color}0d`, border: `1px solid ${color}28`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{sub}</div>
    </div>
  );
}

type TabKey = "timeline" | "analyses" | "connexions" | "medias";

interface TabBtnProps { id: TabKey; label: string; icon: string; count?: number; active: TabKey; setActive: (t: TabKey) => void; }
const TabBtn = ({ id, label, icon, count, active, setActive }: TabBtnProps) => (
  <button onClick={() => setActive(id)} style={{
    padding: "10px 18px", background: "transparent", border: "none",
    borderBottom: active === id ? `2px solid ${T.accent}` : "2px solid transparent",
    color: active === id ? T.accentTxt : T.faint,
    fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
    cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
  }}>
    <span style={{ fontSize: 13 }}>{icon}</span>
    {label}
    {count !== undefined && (
      <span style={{ background: active === id ? "rgba(129,140,248,0.2)" : "rgba(90,96,128,0.2)", color: active === id ? T.accentTxt : T.faint, borderRadius: 20, padding: "1px 7px", fontSize: 10 }}>
        {count}
      </span>
    )}
  </button>
);

// ── Page principale ────────────────────────────────────────────────────────
export default function UserActivityPage() {
  const params  = useParams();
  const router  = useRouter();
  const userId  = params?.id as string;

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [user, setUser]               = useState<UserDetail | null>(null);
  const [stats, setStats]             = useState<ActivityStats | null>(null);
  const [analyses, setAnalyses]       = useState<AnalyseEvent[]>([]);
  const [videos, setVideos]           = useState<VideoEvent[]>([]);
  const [rapports, setRapports]       = useState<RapportEvent[]>([]);
  const [logins, setLogins]           = useState<LoginEventItem[]>([]);
  const [activeTab, setActiveTab]     = useState<TabKey>("timeline");
  const [error, setError]             = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const h = getHeaders();
      const [uRes, sRes, aRes, vRes, rRes, lRes] = await Promise.all([
        axios.get(`${API}/admin/users/${userId}`,          { headers: h }),
        axios.get(`${API}/admin/users/${userId}/stats`,    { headers: h }),
        axios.get(`${API}/admin/users/${userId}/analyses`, { headers: h }),
        axios.get(`${API}/admin/users/${userId}/videos`,   { headers: h }),
        axios.get(`${API}/admin/users/${userId}/rapports`, { headers: h }),
        axios.get(`${API}/admin/users/${userId}/logins`,   { headers: h }),
      ]);
      setUser(uRes.data);
      setStats(sRes.data);
      setAnalyses(aRes.data);
      setVideos(vRes.data);
      setRapports(rRes.data);
      setLogins(lRes.data);
      setLastRefresh(new Date());
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 403 ? "Accès refusé — admin requis." :
        status === 404 ? "Utilisateur introuvable." :
        "Erreur de chargement. Vérifiez que le backend tourne."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh 60 s
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  // ── Stats de présence calculées côté client ────────────────────────────
  const loginSuccesses = logins.filter(l => l.event_type === "login_success");
  const totalSessions  = loginSuccesses.length;

  // Durée moyenne de session (en minutes) sur les sessions avec logout
  const sessionsAvecDuree = loginSuccesses.filter(l => l.logout_at);
  const dureeMoyenneMins  = sessionsAvecDuree.length > 0
    ? Math.round(sessionsAvecDuree.reduce((acc, l) => {
        return acc + (new Date(l.logout_at!).getTime() - new Date(l.created_at).getTime()) / 60000;
      }, 0) / sessionsAvecDuree.length)
    : null;

  // Ratio succès / échecs
  const loginFailures = logins.filter(l => l.event_type === "login_failure").length;
  const tauxSucces    = totalSessions + loginFailures > 0
    ? Math.round((totalSessions / (totalSessions + loginFailures)) * 100)
    : 100;

  // Session en cours ?
  // Active si : login_success + pas de logout_at + créée il y a < 2h
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  const sessionEnCours = loginSuccesses.some(l =>
    !l.logout_at &&
    (Date.now() - new Date(l.created_at).getTime()) < SESSION_TIMEOUT_MS
  );

  // ── Timeline unifiée ─────────────────────────────────────────────────────
  type TLItem = { date: string; type: string; label: string; sub: string; color: string; badge: { label: string; bg: string; color: string; border: string } };

  const timeline: TLItem[] = [
    ...analyses.map(a => ({
      date:  a.created_at,
      type:  "analyse",
      label: "Analyse lancée",
      sub:   `${a.depot_nom} · ${a.branche} · sécurité ${a.score_securite}/100 · ${a.nb_vulns} vulns`,
      color: T.accent,
      badge: scoreBadge(a.score_securite),
    })),
    ...videos.map(v => ({
      date:  v.created_at,
      type:  "video",
      label: "Vidéo générée",
      sub:   `${v.titre} · ${v.langue.toUpperCase()}${v.nom_projet ? ` · ${v.nom_projet}` : ""}`,
      color: T.purple,
      badge: { label: "vidéo", bg: "rgba(167,139,250,0.12)", color: T.purple, border: "rgba(167,139,250,0.25)" },
    })),
    ...rapports.map(r => ({
      date:  r.created_at,
      type:  "rapport",
      label: "Rapport PDF téléchargé",
      sub:   `${r.nom_projet}${r.nb_pages ? ` · ${r.nb_pages} pages` : ""}`,
      color: T.amber,
      badge: { label: "PDF", bg: "rgba(245,158,11,0.12)", color: T.amber, border: "rgba(245,158,11,0.25)" },
    })),
    ...loginSuccesses.map(l => ({
      date:  l.created_at,
      type:  "connexion",
      label: "Connexion",
      sub:   `IP ${l.ip_address || "?"} · ${parseUA(l.user_agent)}${l.logout_at ? ` · durée ${sessionDuration(l.created_at, l.logout_at)}` : " · session active"}`,
      color: T.green,
      badge: { label: "session", bg: "rgba(34,197,94,0.10)", color: T.green, border: "rgba(34,197,94,0.25)" },
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Loader ───────────────────────────────────────────────────────────────
  if (loading) return (
    <AdminLayout>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: T.bg }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(129,140,248,0.2)", borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ color: T.faint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Chargement de la traçabilité...</span>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      </div>
    </AdminLayout>
  );

  if (error || !user || !stats) return (
    <AdminLayout>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <p style={{ color: T.text, fontWeight: 700 }}>{error || "Utilisateur introuvable"}</p>
          <button onClick={() => router.push("/admin-pages/users")}
            style={{ marginTop: 16, padding: "10px 20px", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)", borderRadius: 10, color: T.accentTxt, cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
            ← Retour aux utilisateurs
          </button>
        </div>
      </div>
    </AdminLayout>
  );

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.35 } }
        @keyframes shimmer { from { background-position:200% 0 } to { background-position:-200% 0 } }
        .row-hover:hover   { background: rgba(255,255,255,0.018); transition:background 0.15s; }
        .tab-card          { background:${T.card}; border:1px solid ${T.border}; border-radius:16px; overflow:hidden; }
      `}</style>

      <div style={{ flex: 1, background: T.bg, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <div style={{ padding: "24px 36px 20px", borderBottom: `1px solid ${T.border}`, background: T.card }}>

          {/* Breadcrumb + Refresh */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => router.push("/admin-pages/users")}
                style={{ padding: "5px 14px", background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 8, color: T.accentTxt, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                ← Utilisateurs
              </button>
              <span style={{ color: T.faint, fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>/ #{userId} / traçabilité</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                Actualisé à {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <button onClick={() => load(true)}
                style={{ padding: "5px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, color: T.green, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={refreshing ? { animation: "spin 0.8s linear infinite", display: "inline-block" } : {}}>⟳</span>
                Rafraîchir
              </button>
            </div>
          </div>

          {/* Identité utilisateur */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>

            {/* Avatar avec anneau de présence */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(129,140,248,0.15)", border: `2px solid ${sessionEnCours ? T.green : "rgba(129,140,248,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: T.accentTxt }}>
                {initials(user.username, user.email)}
              </div>
              {sessionEnCours && (
                <div style={{ position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: T.green, border: `2px solid ${T.card}`, animation: "pulse 2s infinite" }} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" as const }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: "-0.02em", margin: 0 }}>
                  @{user.username}
                </h1>
                {/* Badge présence */}
                {sessionEnCours
                  ? <span style={{ background: "rgba(34,197,94,0.12)", color: T.green, border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                      En ligne
                    </span>
                  : <span style={{ background: "rgba(90,96,128,0.12)", color: T.faint, border: "1px solid rgba(90,96,128,0.25)", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                      Hors ligne
                    </span>
                }
                <span style={{ background: user.is_active ? "rgba(34,197,94,0.12)" : "rgba(248,113,113,0.12)", color: user.is_active ? T.green : T.red, border: `1px solid ${user.is_active ? "rgba(34,197,94,0.25)" : "rgba(248,113,113,0.25)"}`, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                  {user.is_active ? "actif" : "inactif"}
                </span>
                <span style={{ background: user.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(96,165,250,0.12)", color: user.role === "admin" ? T.amber : T.blue, border: `1px solid ${user.role === "admin" ? "rgba(245,158,11,0.25)" : "rgba(96,165,250,0.25)"}`, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                  {user.role === "admin" ? "👑 admin" : "user"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                {user.email} · ID #{user.id} · membre depuis {user.created_at?.split("T")[0]}
              </div>
            </div>

            {/* Dernière activité */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>Dernière activité</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                {stats.derniere_activite ? timeAgo(stats.derniere_activite) : "—"}
              </div>
              {stats.derniere_activite && (
                <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
                  {fmtDate(stats.derniere_activite)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ CONTENU ══════════════════════════════════════════════════════ */}
        <div style={{ padding: "24px 36px", flex: 1 }}>

          {/* ── Présence en 4 blocs chiffrés ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            <BigStat icon="🔑" label="Connexions totales" value={totalSessions}  sub="sessions réussies"            color={T.accent} />
            <BigStat icon="⏱"  label="Durée moy. session" value={dureeMoyenneMins !== null ? `${dureeMoyenneMins} min` : "—"} sub="par session connectée" color={T.blue} />
            <BigStat icon="✅" label="Taux de succès"     value={`${tauxSucces}%`} sub={`${loginFailures} échec${loginFailures !== 1 ? "s" : ""}`} color={tauxSucces >= 90 ? T.green : T.amber} />
            <BigStat icon="📊" label="Analyses lancées"   value={stats.total_analyses}  sub="audits de code"         color={T.accent} />
            <BigStat icon="🎬" label="Vidéos générées"    value={stats.total_videos}    sub="depuis l'inscription"   color={T.purple} />
            <BigStat icon="📄" label="Rapports PDF"       value={stats.total_rapports}  sub="téléchargés"            color={T.amber} />
            <BigStat icon="📁" label="Dépôts liés"        value={user.depot_count}      sub="projets GitLab"         color={T.orange} />
            <BigStat icon="🌐" label="Évts timeline"      value={timeline.length}       sub="actions totales"        color={T.blue} />
          </div>

          {/* ── Bandeau présence visuelle ── */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 22px", marginBottom: 22, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" as const }}>

            {/* Jauge taux de succès */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", width: 52, height: 52 }}>
                <CircleScore value={tauxSucces} color={tauxSucces >= 90 ? T.green : T.amber} />
                <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 10, fontWeight: 800, color: tauxSucces >= 90 ? T.green : T.amber, fontFamily: "'JetBrains Mono',monospace" }}>
                  {tauxSucces}%
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Taux de connexion</div>
                <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                  {totalSessions} succès · {loginFailures} échec{loginFailures !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div style={{ width: 1, height: 36, background: T.border }} />

            {/* Sessions */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{totalSessions} session{totalSessions !== 1 ? "s" : ""} enregistrée{totalSessions !== 1 ? "s" : ""}</div>
              <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                {sessionsAvecDuree.length} avec durée connue · {totalSessions - sessionsAvecDuree.length} sans logout
              </div>
            </div>

            <div style={{ width: 1, height: 36, background: T.border }} />

            {/* Durée */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>
                {dureeMoyenneMins !== null ? `${dureeMoyenneMins} min en moyenne` : "Durée inconnue"}
              </div>
              <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                temps de session moyen
              </div>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {sessionEnCours
                ? <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "5px 14px", fontSize: 11, color: T.green, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                    Session active en ce moment
                  </span>
                : <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(90,96,128,0.08)", border: "1px solid rgba(90,96,128,0.2)", borderRadius: 20, padding: "5px 14px", fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                    ● Hors ligne
                  </span>
              }
            </div>
          </div>

          {/* ── TABS ── */}
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
            <TabBtn id="timeline"   icon="⏳" label="Timeline"     count={timeline.length}              active={activeTab} setActive={setActiveTab} />
            <TabBtn id="analyses"   icon="🔍" label="Analyses"     count={analyses.length}              active={activeTab} setActive={setActiveTab} />
            <TabBtn id="connexions" icon="🔑" label="Connexions"   count={logins.length}                active={activeTab} setActive={setActiveTab} />
            <TabBtn id="medias"     icon="🎬" label="Vidéos & PDF" count={videos.length + rapports.length} active={activeTab} setActive={setActiveTab} />
          </div>

          {/* ══ TIMELINE ════════════════════════════════════════════════════ */}
          {activeTab === "timeline" && (
            <div className="tab-card">
              <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>Toutes actions · ordre chronologique décroissant</span>
                <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{timeline.length} événement{timeline.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ padding: "8px 22px" }}>
                {timeline.length === 0
                  ? <div style={{ padding: "40px 0", textAlign: "center", color: T.faint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Aucune activité</div>
                  : timeline.map((item, i) => (
                    <div key={i} className="row-hover" style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < timeline.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "flex-start", animation: "fadeIn 0.2s ease backwards", animationDelay: `${Math.min(i * 0.02, 0.4)}s` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${item.color}66` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.label}</span>
                          <Badge {...item.badge} />
                        </div>
                        <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{item.sub}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{timeAgo(item.date)}</span>
                        <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", opacity: 0.6 }}>{fmtDate(item.date)}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ══ ANALYSES ════════════════════════════════════════════════════ */}
          {activeTab === "analyses" && (
            <div className="tab-card">
              <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>Audits de code — scores qualité · sécurité · performance</span>
              </div>
              <div style={{ padding: "8px 22px" }}>
                {analyses.length === 0
                  ? <div style={{ padding: "40px 0", textAlign: "center", color: T.faint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Aucune analyse enregistrée</div>
                  : analyses.map((a, i) => {
                    const sec = scoreBadge(a.score_securite);
                    return (
                      <div key={a.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: i < analyses.length - 1 ? `1px solid ${T.border}` : "none", animation: "fadeIn 0.2s ease backwards", animationDelay: `${i * 0.04}s` }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.depot_nom}</span>
                            <code style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 4, padding: "2px 7px", color: T.faint }}>{a.branche}</code>
                            <Badge {...sec} />
                          </div>
                          <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                            {fmtDate(a.created_at)} · {a.nb_vulns} vuln{a.nb_vulns !== 1 ? "s" : ""}
                          </div>
                        </div>
                        {/* Scores avec jauges */}
                        <div style={{ display: "flex", gap: 20 }}>
                          {[
                            { label: "Qualité",     value: a.score_qualite },
                            { label: "Sécurité",    value: a.score_securite },
                            { label: "Performance", value: a.score_performance },
                          ].map(s => (
                            <div key={s.label} style={{ textAlign: "center", minWidth: 60 }}>
                              <div style={{ position: "relative", width: 44, height: 44, margin: "0 auto 4px" }}>
                                <CircleScore value={s.value} color={scoreColor(s.value)} size={44} />
                                <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 10, fontWeight: 800, color: scoreColor(s.value), fontFamily: "'JetBrains Mono',monospace" }}>
                                  {s.value}
                                </span>
                              </div>
                              <div style={{ fontSize: 9, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* ══ CONNEXIONS ══════════════════════════════════════════════════ */}
          {activeTab === "connexions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Résumé présence */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {[
                  { icon: "🔑", label: "Sessions totales",    value: totalSessions,  color: T.accent, sub: "connexions réussies" },
                  { icon: "⏱",  label: "Durée moyenne",       value: dureeMoyenneMins !== null ? `${dureeMoyenneMins} min` : "—", color: T.blue, sub: "par session" },
                  { icon: "❌", label: "Échecs connexion",    value: loginFailures,  color: T.red,    sub: "tentatives ratées" },
                  { icon: "✅", label: "Taux de succès",      value: `${tauxSucces}%`, color: tauxSucces >= 90 ? T.green : T.amber, sub: "authentification" },
                ].map(s => (
                  <div key={s.label} style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25`, borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 4 }}>
                      {s.icon} {s.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", marginTop: 4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Historique des événements */}
              <div className="tab-card">
                <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>Historique complet des événements d'authentification</span>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{logins.length} événements</span>
                </div>
                <div style={{ padding: "0 22px" }}>
                  {logins.length === 0
                    ? <div style={{ padding: "40px 0", textAlign: "center", color: T.faint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Aucun événement de connexion</div>
                    : logins.map((ev, i) => {
                      const cfg = loginEventConfig(ev);
                      return (
                        <div key={ev.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < logins.length - 1 ? `1px solid ${T.border}` : "none", animation: "fadeIn 0.2s ease backwards", animationDelay: `${Math.min(i * 0.025, 0.5)}s` }}>

                          {/* Icône */}
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                            {cfg.icon}
                          </div>

                          {/* Infos */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                              {ev.event_type === "login_success" && !ev.logout_at && (Date.now() - new Date(ev.created_at).getTime()) < SESSION_TIMEOUT_MS && (
                                <span style={{ fontSize: 9, background: "rgba(34,197,94,0.12)", color: T.green, border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "1px 7px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
                              {ev.ip_address && (
                                <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                                  🌐 {ev.ip_address}
                                </span>
                              )}
                              {ev.user_agent && (
                                <span style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                                  💻 {parseUA(ev.user_agent)}
                                </span>
                              )}
                              {ev.event_type === "login_success" && (
                                <span style={{ fontSize: 10, color: (ev.logout_at || (Date.now() - new Date(ev.created_at).getTime()) >= SESSION_TIMEOUT_MS) ? T.faint : T.green, fontFamily: "'JetBrains Mono',monospace" }}>
                                  ⏱ {sessionDuration(ev.created_at, ev.logout_at || (Date.now() - new Date(ev.created_at).getTime()) >= SESSION_TIMEOUT_MS ? new Date().toISOString() : null)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Date */}
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>{timeAgo(ev.created_at)}</div>
                            <div style={{ fontSize: 10, color: T.faint, fontFamily: "'JetBrains Mono',monospace", opacity: 0.6, marginTop: 2 }}>{fmtDateShort(ev.created_at)}</div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            </div>
          )}

          {/* ══ MÉDIAS ══════════════════════════════════════════════════════ */}
          {activeTab === "medias" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Vidéos */}
              <div className="tab-card">
                <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.accentTxt, fontFamily: "'JetBrains Mono',monospace" }}>🎬 Vidéos générées</span>
                  <span style={{ background: "rgba(167,139,250,0.12)", color: T.purple, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{videos.length}</span>
                </div>
                <div style={{ padding: "0 22px" }}>
                  {videos.length === 0
                    ? <div style={{ padding: "30px 0", textAlign: "center", color: T.faint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Aucune vidéo générée</div>
                    : videos.map((v, i) => (
                      <div key={v.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < videos.length - 1 ? `1px solid ${T.border}` : "none", animation: "fadeIn 0.2s ease backwards", animationDelay: `${i * 0.04}s` }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.purple, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3 }}>{v.titre}</div>
                          <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                            {fmtDate(v.created_at)} · {v.type_video} · {v.langue.toUpperCase()}
                            {v.nom_projet && ` · ${v.nom_projet}`}
                          </div>
                        </div>
                        <Badge label="vidéo" bg="rgba(167,139,250,0.12)" color={T.purple} border="rgba(167,139,250,0.25)" />
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Rapports PDF */}
              <div className="tab-card">
                <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, fontFamily: "'JetBrains Mono',monospace" }}>📄 Rapports PDF</span>
                  <span style={{ background: "rgba(245,158,11,0.12)", color: T.amber, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{rapports.length}</span>
                </div>
                <div style={{ padding: "0 22px" }}>
                  {rapports.length === 0
                    ? <div style={{ padding: "30px 0", textAlign: "center", color: T.faint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>Aucun rapport téléchargé</div>
                    : rapports.map((r, i) => (
                      <div key={r.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < rapports.length - 1 ? `1px solid ${T.border}` : "none", animation: "fadeIn 0.2s ease backwards", animationDelay: `${i * 0.04}s` }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.amber, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3 }}>Rapport audit — {r.nom_projet}</div>
                          <div style={{ fontSize: 11, color: T.faint, fontFamily: "'JetBrains Mono',monospace" }}>
                            {fmtDate(r.created_at)}{r.nb_pages ? ` · ${r.nb_pages} pages` : ""}
                          </div>
                        </div>
                        <Badge label="PDF" bg="rgba(245,158,11,0.12)" color={T.amber} border="rgba(245,158,11,0.25)" />
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}