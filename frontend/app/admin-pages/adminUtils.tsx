// adminUtils.tsx — Composants admin avec support thème sombre/clair
import { useTheme } from "./ThemeContext";

// ─── TYPES ────────────────────────────────────────────────────────
export interface Stats {
  total_users: number; active_users: number; total_depots: number;
  admin_count: number; total_analyses: number; analyses_ok: number;
  total_mr: number; total_diffs: number;
}
export interface UserItem {
  id: number; email: string; username: string; role: string;
  is_active: boolean; created_at: string; depot_count: number;
}
export interface DepotItem {
  id: number; nom: string; project_url: string; branche: string;
  user_id: number; user_email: string; created_at: string; analyses_count: number;
}
export interface Analyse {
  id: number; depot_id: number; depot_nom: string; user_email: string;
  branche: string; score_qualite: number; score_securite: number;
  score_performance: number; statut: string; created_at: string;
  nb_vulns: number; vulnerabilites?: any[];
}
export interface MR {
  id: number; projet_nom: string; user_email: string; titre: string;
  statut: string; type_mr: string; branche_source: string;
  branche_cible: string; created_at: string; mr_url?: string;
}
export interface AnalyseDiff {
  id: number; projet_nom: string; user_email: string;
  from_branch: string; to_branch: string;
  score_qualite: number; score_securite: number;
  resultat_statut: string; created_at: string;
}
export interface TestGenere {
  id: number; projet_nom: string; user_email: string;
  langage: string; framework: string; nb_tests: number;
  statut: string; created_at: string;
}

// ─── CONSTANTES ───────────────────────────────────────────────────
export const API = "http://127.0.0.1:8000";

export function getHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: token ? `Bearer ${token}` : "" };
}

export function scoreColor(s: number) {
  return s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#f87171";
}
export function scoreBg(s: number, dark = true) {
  if (dark) return s >= 80 ? "rgba(34,197,94,0.12)" : s >= 60 ? "rgba(245,158,11,0.12)" : "rgba(248,113,113,0.12)";
  return s >= 80 ? "#f0fdf4" : s >= 60 ? "#fffbeb" : "#fef2f2";
}

export const STATUS_MAP: Record<string, { color: string; label: string }> = {
  termine:              { color: "#22c55e", label: "Terminé" },
  en_cours:             { color: "#60a5fa", label: "En cours" },
  erreur:               { color: "#f87171", label: "Erreur" },
  opened:               { color: "#60a5fa", label: "Ouverte" },
  merged:               { color: "#22c55e", label: "Fusionnée" },
  closed:               { color: "#6b7280", label: "Fermée" },
  merge_autorise:       { color: "#22c55e", label: "Autorisé" },
  merge_bloque:         { color: "#f87171", label: "Bloqué" },
  merge_autorise_force: { color: "#f59e0b", label: "Forcé" },
  pousse:               { color: "#22c55e", label: "Poussé" },
  genere:               { color: "#818cf8", label: "Généré" },
  aucun_changement:     { color: "#6b7280", label: "Inchangé" },
};

// ─── COMPOSANTS THEME-AWARE ───────────────────────────────────────

export function PageHeader({ icon, title, sub, count, onRefresh }: {
  icon: string; title: string; sub?: string; count?: number; onRefresh?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <div style={{
      padding: "28px 36px 24px",
      borderBottom: `1px solid ${theme.headerBorder}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: theme.header, transition: "background 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${theme.accent}20`,
          border: `1px solid ${theme.accent}35`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{icon}</div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, letterSpacing: "-0.02em" }}>
            {title}
            {count !== undefined && (
              <span style={{ marginLeft: 10, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: theme.accentText, fontWeight: 500 }}>
                ({count})
              </span>
            )}
          </h1>
          {sub && <p style={{ fontSize: 11, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{sub}</p>}
        </div>
      </div>
      {onRefresh && (
        <button onClick={onRefresh} style={{
          padding: "8px 16px",
          background: `${theme.accent}15`,
          border: `1px solid ${theme.accent}30`,
          borderRadius: 9, color: theme.accentText, fontSize: 12,
          fontFamily: "'JetBrains Mono',monospace", fontWeight: 500,
          cursor: "pointer", transition: "all 0.15s",
        }}>↻ Actualiser</button>
      )}
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const { isDark } = useTheme();
  return (
    <span style={{
      background: scoreBg(score, isDark),
      color: scoreColor(score),
      fontWeight: 700, padding: "3px 10px", borderRadius: 20, fontSize: 11,
      fontFamily: "'JetBrains Mono',monospace",
      border: `1px solid ${scoreColor(score)}33`,
    }}>{score}</span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme();
  const s = STATUS_MAP[status] || { color: "#6b7280", label: status };
  const bg = isDark ? `${s.color}1a` : `${s.color}15`;
  return (
    <span style={{
      background: bg, color: s.color, fontWeight: 600,
      padding: "3px 10px", borderRadius: 20, fontSize: 11,
      whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace",
      border: `1px solid ${s.color}33`,
    }}>{s.label}</span>
  );
}

export function Loader({ message = "Chargement..." }: { message?: string }) {
  const { theme } = useTheme();
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 16, background: theme.bg,
    }}>
      <div style={{
        width: 40, height: 40, border: `2px solid ${theme.cardBorder}`,
        borderTopColor: theme.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: theme.textFaint, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useTheme();
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>⊗</div>
        <p style={{ color: "#f87171", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{message}</p>
        {onRetry && (
          <button onClick={onRetry} style={{
            padding: "9px 22px",
            background: `${theme.accent}20`,
            border: `1px solid ${theme.accent}40`,
            borderRadius: 9, color: theme.accentText, cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>Réessayer</button>
        )}
      </div>
    </div>
  );
}

export function DataTable({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.card, border: `1px solid ${theme.cardBorder}`,
      borderRadius: 14, overflow: "hidden", transition: "background 0.3s", ...style,
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function TH({ children, center }: { children: React.ReactNode; center?: boolean }) {
  const { theme } = useTheme();
  return (
    <th style={{
      padding: "12px 16px", background: theme.tableHead, color: theme.textFaint,
      fontWeight: 600, textAlign: center ? "center" : "left",
      borderBottom: `1px solid ${theme.cardBorder}`,
      whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace",
      transition: "background 0.3s",
    }}>{children}</th>
  );
}

export function TD({ children, center }: { children: React.ReactNode; center?: boolean }) {
  const { theme } = useTheme();
  return (
    <td style={{
      padding: "12px 16px", color: theme.textMuted,
      borderBottom: `1px solid ${theme.tableBorder}`,
      textAlign: center ? "center" : "left", verticalAlign: "middle",
      transition: "color 0.3s",
    }}>{children}</td>
  );
}

export function EmptyRow({ cols, message }: { cols: number; message: string }) {
  const { theme } = useTheme();
  return (
    <tr>
      <td colSpan={cols} style={{
        textAlign: "center", padding: "48px 24px", color: theme.textFaint,
        fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
      }}>⊘ {message}</td>
    </tr>
  );
}

export function ActionBtn({ onClick, color = "blue", children }: {
  onClick: () => void; color?: "blue" | "red" | "green" | "gray"; children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const colors = {
    blue:  { base: "#60a5fa" },
    red:   { base: "#f87171" },
    green: { base: "#22c55e" },
    gray:  { base: "#9ca3af" },
  };
  const c = colors[color].base;
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px",
      border: `1px solid ${c}33`,
      borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600,
      background: isDark ? `${c}18` : `${c}12`,
      color: c,
      fontFamily: "'JetBrains Mono',monospace", transition: "all 0.15s", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const { theme } = useTheme();
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || "Rechercher..."}
      style={{
        padding: "9px 14px",
        background: theme.input,
        border: `1px solid ${theme.inputBorder}`,
        borderRadius: 9, fontSize: 12, color: theme.textMuted,
        outline: "none", width: 280,
        fontFamily: "'JetBrains Mono',monospace",
        transition: "background 0.3s, border-color 0.2s",
      }}
    />
  );
}

export function StatCard({ icon, value, label, sub, accent = "#5b63f5" }: {
  icon: string; value: string | number; label: string; sub?: string; accent?: string;
}) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.card, borderRadius: 14, padding: "20px 22px",
      border: `1px solid ${theme.cardBorder}`,
      display: "flex", alignItems: "center", gap: 16,
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: `${accent}18`, border: `1px solid ${accent}30`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: theme.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: theme.textFaint, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── HELPER pour les pages : wrapper de page ──────────────────────
export function PageWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{ flex: 1, background: theme.bg, transition: "background 0.3s", overflowY: "auto" }}>
      {children}
    </div>
  );
}
