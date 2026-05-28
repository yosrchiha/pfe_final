"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import {
  API,
  getHeaders,
  PageHeader,
  ScorePill,
  StatusBadge,
  Loader,
  ErrorState,
  SearchInput,
} from "../adminUtils";
import { useTheme } from "../ThemeContext";

type AnalyseRow = {
  id: number;
  depot_nom: string;
  user_email: string;
  branche: string;
  score_qualite: number;
  score_securite: number;
  score_performance: number;
  statut: string;
  created_at?: string | null;
  nb_vulns: number;
};

type RelatedTest = {
  id: number;
  langage?: string | null;
  framework?: string | null;
  nom_fichier?: string | null;
  nb_tests?: number | null;
  statut?: string | null;
  created_at?: string | null;
};

type RelatedMR = {
  id: number;
  titre?: string | null;
  statut?: string | null;
  type_mr?: string | null;
  branche_source?: string | null;
  branche_cible?: string | null;
  mr_url?: string | null;
  created_at?: string | null;
};

type AnalyseDetail = AnalyseRow & {
  depot_analyse_id?: number | null;
  user?: { id: number; email: string; username?: string | null; is_active?: boolean };
  depot?: { id: number; nom: string; project_url?: string | null; branche?: string | null };
  execution?: {
    modele_llm?: string | null;
    owasp_enabled?: boolean;
    auto_tests?: boolean;
    auto_mr?: boolean;
    seuil_qualite?: number | null;
    celery_task_id?: string | null;
    etape_courante?: string | null;
  };
  vulnerabilites?: Record<string, unknown>[];
  recommandations?: Record<string, unknown>[];
  tests?: RelatedTest[];
  merge_requests?: RelatedMR[];
  rapports_count?: number;
};

type FilterStatus = "all" | "termine" | "en_cours" | "en_file" | "erreur";
type RiskFilter = "all" | "critical" | "with_vulns" | "healthy";

const mono = "'JetBrains Mono', monospace";

function safeText(value: unknown, fallback = "—") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function valueFrom(item: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
      return String(item[key]);
    }
  }
  return fallback;
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.split("T")[0];
  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function average(list: AnalyseRow[], key: "score_qualite" | "score_securite" | "score_performance") {
  if (!list.length) return 0;
  return Math.round(list.reduce((sum, row) => sum + (row[key] || 0), 0) / list.length);
}

function severityColor(severity: string) {
  const s = severity.toUpperCase();
  if (s.includes("CRIT") || s.includes("CRITICAL")) return "#fb7185";
  if (s.includes("HAUT") || s.includes("HIGH")) return "#f97316";
  if (s.includes("MOY") || s.includes("MEDIUM")) return "#f59e0b";
  return "#38bdf8";
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  href,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const accent = danger ? "#ef4444" : theme.accent;
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 15px",
    borderRadius: 10,
    border: `1px solid ${accent}45`,
    background: `${accent}18`,
    color: danger ? "#f87171" : theme.accentText,
    fontFamily: mono,
    fontWeight: 700,
    fontSize: 11,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    textDecoration: "none",
  };
  if (href) return <Link href={href} style={style}>{children}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function Metric({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}) {
  const { theme } = useTheme();
  return (
    <Card style={{ padding: "17px 18px", display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{
        width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center",
        background: `${color}18`, color, border: `1px solid ${color}33`, fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ color: theme.text, fontWeight: 800, fontSize: 23, lineHeight: 1.1 }}>{value}</div>
        <div style={{ color: theme.textMuted, fontWeight: 700, fontSize: 11, marginTop: 4 }}>{label}</div>
        {sub && <div style={{ color: theme.textFaint, fontSize: 10, fontFamily: mono, marginTop: 3 }}>{sub}</div>}
      </div>
    </Card>
  );
}

function VulnerabilityBadge({ count }: { count: number }) {
  const color = count >= 5 ? "#fb7185" : count > 0 ? "#f59e0b" : "#22c55e";
  return (
    <span style={{
      fontFamily: mono, fontWeight: 700, fontSize: 11, color,
      border: `1px solid ${color}38`, background: `${color}13`,
      padding: "4px 10px", borderRadius: 999,
    }}>
      {count === 0 ? "Aucune" : count}
    </span>
  );
}

function DetailDrawer({
  analyse,
  loading,
  onClose,
  onDelete,
}: {
  analyse: AnalyseDetail | null;
  loading: boolean;
  onClose: () => void;
  onDelete: (analyse: AnalyseDetail) => void;
}) {
  const { theme } = useTheme();
  if (!analyse && !loading) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,6,16,.68)", zIndex: 40, backdropFilter: "blur(3px)" }}
      />
      <aside style={{
        position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 41,
        width: "min(620px, 100vw)", overflowY: "auto",
        background: theme.bg, borderLeft: `1px solid ${theme.cardBorder}`,
        boxShadow: "-30px 0 70px rgba(0,0,0,.32)",
      }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 2, padding: "22px 25px",
          borderBottom: `1px solid ${theme.cardBorder}`, background: theme.header,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: theme.text, fontSize: 18, fontWeight: 800 }}>Centre d'investigation</div>
            <div style={{ color: theme.textFaint, fontFamily: mono, fontSize: 10, marginTop: 4 }}>
              {analyse ? `ANALYSE #${analyse.id}` : "Chargement du dossier..."}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 38, height: 38, borderRadius: 10, cursor: "pointer",
            color: theme.textMuted, background: theme.card, border: `1px solid ${theme.cardBorder}`,
            fontSize: 18,
          }}>×</button>
        </div>

        {loading || !analyse ? (
          <div style={{ padding: 40, color: theme.textMuted, fontFamily: mono }}>Chargement des informations détaillées...</div>
        ) : (
          <div style={{ padding: 25, display: "flex", flexDirection: "column", gap: 16 }}>
            <Card style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: theme.text, fontWeight: 800, fontSize: 17 }}>📁 {analyse.depot_nom}</div>
                  <div style={{ color: theme.accentText, fontSize: 12, marginTop: 7 }}>{analyse.user_email}</div>
                  <div style={{ color: theme.textFaint, fontFamily: mono, fontSize: 10, marginTop: 7 }}>
                    Branche : {analyse.branche} · {dateLabel(analyse.created_at)}
                  </div>
                </div>
                <StatusBadge status={analyse.statut} />
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                ["Qualité", analyse.score_qualite],
                ["Sécurité", analyse.score_securite],
                ["Performance", analyse.score_performance],
              ].map(([label, score]) => (
                <Card key={String(label)} style={{ padding: "15px 10px", textAlign: "center" }}>
                  <div style={{ color: theme.textFaint, fontSize: 10, fontFamily: mono, marginBottom: 10 }}>{label}</div>
                  <ScorePill score={Number(score) || 0} />
                </Card>
              ))}
            </div>

            <Card style={{ padding: 20 }}>
              <SectionTitle title="Paramètres d'exécution" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Info label="Moteur IA" value={safeText(analyse.execution?.modele_llm)} />
                <Info label="Seuil qualité" value={`${analyse.execution?.seuil_qualite ?? "—"}/100`} />
                <Info label="OWASP" value={analyse.execution?.owasp_enabled ? "Activé" : "Désactivé"} />
                <Info label="Génération tests" value={analyse.execution?.auto_tests ? "Activée" : "Désactivée"} />
                <Info label="Étape actuelle" value={safeText(analyse.execution?.etape_courante)} />
                <Info label="Task ID" value={safeText(analyse.execution?.celery_task_id)} />
              </div>
            </Card>

            <Card style={{ padding: 20 }}>
              <SectionTitle
                title="Vulnérabilités détectées"
                count={analyse.vulnerabilites?.length || 0}
                color="#fb7185"
              />
              {!analyse.vulnerabilites?.length ? (
                <EmptyInfo text="Aucune vulnérabilité remontée pour cette analyse." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {analyse.vulnerabilites.slice(0, 10).map((v, i) => {
                    const severity = valueFrom(v, ["severite", "severity", "criticite"], "INCONNUE");
                    const color = severityColor(severity);
                    return (
                      <div key={i} style={{
                        padding: 12, borderRadius: 11, background: `${color}09`,
                        border: `1px solid ${color}26`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ color: theme.text, fontSize: 12, fontWeight: 700 }}>
                            {valueFrom(v, ["type", "titre", "nom"], `Vulnérabilité ${i + 1}`)}
                          </span>
                          <span style={{ color, fontSize: 10, fontFamily: mono, fontWeight: 700 }}>{severity}</span>
                        </div>
                        <div style={{ color: theme.textFaint, fontSize: 10, fontFamily: mono, marginTop: 7 }}>
                          {valueFrom(v, ["fichier", "file", "path"], "Fichier non précisé")}
                          {" · ligne "}{valueFrom(v, ["ligne", "line"], "—")}
                        </div>
                        <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 8, lineHeight: 1.55 }}>
                          {valueFrom(v, ["description", "impact"], "Détail indisponible.")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card style={{ padding: 20 }}>
              <SectionTitle
                title="Recommandations IA"
                count={analyse.recommandations?.length || 0}
                color="#38bdf8"
              />
              {!analyse.recommandations?.length ? (
                <EmptyInfo text="Aucune recommandation enregistrée." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {analyse.recommandations.slice(0, 10).map((r, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 11,
                      background: "rgba(56,189,248,.06)", border: "1px solid rgba(56,189,248,.18)",
                    }}>
                      <div style={{ color: theme.text, fontWeight: 700, fontSize: 12 }}>
                        {valueFrom(r, ["titre", "title", "categorie"], `Recommandation ${i + 1}`)}
                      </div>
                      <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 7, lineHeight: 1.55 }}>
                        {valueFrom(r, ["description", "suggestion", "message"], "Détail indisponible.")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card style={{ padding: 20 }}>
              <SectionTitle title="Artefacts générés" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                <Artifact label="Tests" value={analyse.tests?.length || 0} />
                <Artifact label="Merge Requests" value={analyse.merge_requests?.length || 0} />
                <Artifact label="Rapports" value={analyse.rapports_count || 0} />
              </div>
              {(analyse.merge_requests || []).map(mr => (
                <div key={mr.id} style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <span style={{ color: theme.textMuted, fontSize: 11 }}>{mr.titre || `MR #${mr.id}`}</span>
                  {mr.mr_url && (
                    <a href={mr.mr_url} target="_blank" rel="noreferrer" style={{ color: theme.accentText, fontSize: 11 }}>
                      Ouvrir GitLab ↗
                    </a>
                  )}
                </div>
              ))}
            </Card>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingBottom: 20 }}>
              <PrimaryButton href="/admin-pages/new-analyse">＋ Nouvelle analyse</PrimaryButton>
              <PrimaryButton danger onClick={() => onDelete(analyse)}>🗑 Supprimer l'analyse</PrimaryButton>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function SectionTitle({ title, count, color }: { title: string; count?: number; color?: string }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h3 style={{ margin: 0, color: theme.text, fontSize: 13, fontWeight: 800 }}>{title}</h3>
      {count !== undefined && (
        <span style={{
          padding: "3px 9px", borderRadius: 999, fontFamily: mono, fontSize: 10,
          color: color || theme.accentText, border: `1px solid ${(color || theme.accent)}35`,
          background: `${color || theme.accent}10`,
        }}>{count}</span>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div>
      <div style={{ fontSize: 9, color: theme.textFaint, fontFamily: mono, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 5, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function Artifact({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();
  return (
    <div style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 11, padding: 12, textAlign: "center" }}>
      <div style={{ color: theme.text, fontWeight: 800, fontSize: 19 }}>{value}</div>
      <div style={{ color: theme.textFaint, fontSize: 9, fontFamily: mono, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function EmptyInfo({ text }: { text: string }) {
  const { theme } = useTheme();
  return <div style={{ color: theme.textFaint, fontFamily: mono, fontSize: 10, padding: "11px 0" }}>{text}</div>;
}

export default function AdminAnalysesPage() {
  const { theme } = useTheme();
  const [analyses, setAnalyses] = useState<AnalyseRow[]>([]);
  const [selected, setSelected] = useState<AnalyseDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<FilterStatus>("all");
  const [filterRisk, setFilterRisk] = useState<RiskFilter>("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get<AnalyseRow[]>(`${API}/admin/analyses`, { headers: getHeaders() });
      setAnalyses(response.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Impossible de charger les analyses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openDetails(id: number) {
    setDetailsLoading(true);
    setSelected(null);
    try {
      const response = await axios.get<AnalyseDetail>(`${API}/admin/analyses/${id}`, { headers: getHeaders() });
      setSelected(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Impossible de récupérer le détail de l'analyse.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function deleteAnalyse(analyse: AnalyseDetail) {
    const confirmed = window.confirm(
      `Supprimer définitivement l'analyse #${analyse.id} du dépôt "${analyse.depot_nom}" ?\n\nLes artefacts liés enregistrés dans la plateforme seront également supprimés.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await axios.delete(`${API}/admin/analyses/${analyse.id}`, { headers: getHeaders() });
      setSelected(null);
      setFeedback(`Analyse #${analyse.id} supprimée avec succès.`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "La suppression de l'analyse a échoué.");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return analyses.filter((a) => {
      const matchesText =
        !query ||
        a.depot_nom.toLowerCase().includes(query) ||
        a.user_email.toLowerCase().includes(query) ||
        a.branche.toLowerCase().includes(query) ||
        String(a.id).includes(query);

      const matchesStatus = filterStatut === "all" || a.statut === filterStatut;
      const matchesRisk =
        filterRisk === "all" ||
        (filterRisk === "critical" && (a.nb_vulns >= 5 || a.score_securite < 50)) ||
        (filterRisk === "with_vulns" && a.nb_vulns > 0) ||
        (filterRisk === "healthy" && a.nb_vulns === 0 && a.score_securite >= 70);

      return matchesText && matchesStatus && matchesRisk;
    });
  }, [analyses, search, filterStatut, filterRisk]);

  const metrics = {
    total: analyses.length,
    inProgress: analyses.filter((a) => ["en_cours", "en_file", "en_attente"].includes(a.statut)).length,
    critical: analyses.filter((a) => a.nb_vulns >= 5 || a.score_securite < 50).length,
    vulns: analyses.reduce((sum, a) => sum + a.nb_vulns, 0),
    security: average(analyses, "score_securite"),
    quality: average(analyses, "score_qualite"),
  };

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes admFade { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }
        .analysis-row:hover { background: rgba(99,102,241,.06) !important; }
      `}</style>

      {loading ? <Loader message="Chargement du centre d'analyses..." /> : error && !analyses.length ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div style={{ flex: 1, background: theme.bg, overflowY: "auto" }}>
          <PageHeader
            icon="◉"
            title="Centre de supervision des analyses"
            count={filtered.length}
            sub="Investigation, suivi des risques et administration des analyses IA"
            onRefresh={load}
          />

          <main style={{ padding: "24px 36px 34px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
              <PrimaryButton href="/admin-pages/new-analyse">＋ Lancer une analyse pour un client</PrimaryButton>
            </div>

            {feedback && (
              <div style={{
                marginBottom: 16, borderRadius: 11, padding: "12px 15px",
                border: "1px solid rgba(34,197,94,.28)", background: "rgba(34,197,94,.08)",
                color: "#22c55e", fontSize: 12,
              }}>{feedback}</div>
            )}
            {error && (
              <div style={{
                marginBottom: 16, borderRadius: 11, padding: "12px 15px",
                border: "1px solid rgba(248,113,113,.28)", background: "rgba(248,113,113,.08)",
                color: "#f87171", fontSize: 12,
              }}>{error}</div>
            )}

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(178px,1fr))",
              gap: 11,
              marginBottom: 22,
            }}>
              <Metric icon="◎" value={metrics.total} label="Analyses suivies" color="#6366f1" sub="Tous les clients" />
              <Metric icon="⚙" value={metrics.inProgress} label="En traitement" color="#38bdf8" sub="File ou en cours" />
              <Metric icon="⚠" value={metrics.critical} label="À investiguer" color="#fb7185" sub="Risque élevé" />
              <Metric icon="◈" value={metrics.vulns} label="Vulnérabilités" color="#f59e0b" sub="Détections cumulées" />
              <Metric icon="✓" value={`${metrics.security}/100`} label="Sécurité moyenne" color="#22c55e" />
              <Metric icon="◇" value={`${metrics.quality}/100`} label="Qualité moyenne" color="#60a5fa" />
            </div>

            <Card style={{ padding: 18, marginBottom: 16 }}>
              <div style={{
                display: "flex", gap: 12, flexWrap: "wrap",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {([
                    ["all", "Toutes"],
                    ["termine", "Terminées"],
                    ["en_file", "En file"],
                    ["en_cours", "En cours"],
                    ["erreur", "En erreur"],
                  ] as [FilterStatus, string][]).map(([value, label]) => (
                    <button key={value} onClick={() => setFilterStatut(value)} style={{
                      padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                      fontFamily: mono, fontSize: 10, fontWeight: 700,
                      color: filterStatut === value ? theme.accentText : theme.textFaint,
                      background: filterStatut === value ? `${theme.accent}16` : "transparent",
                      border: `1px solid ${filterStatut === value ? `${theme.accent}3d` : theme.cardBorder}`,
                    }}>{label}</button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value as RiskFilter)} style={{
                    background: theme.input, border: `1px solid ${theme.inputBorder}`, color: theme.textMuted,
                    borderRadius: 9, padding: "9px 12px", outline: "none", fontFamily: mono, fontSize: 11,
                  }}>
                    <option value="all">Tous les risques</option>
                    <option value="critical">À investiguer</option>
                    <option value="with_vulns">Avec vulnérabilités</option>
                    <option value="healthy">Saines</option>
                  </select>
                  <SearchInput value={search} onChange={setSearch} placeholder="Dépôt, client, branche ou ID..." />
                </div>
              </div>
            </Card>

            <Card style={{ overflow: "hidden" }}>
              <div style={{
                padding: "17px 18px", borderBottom: `1px solid ${theme.cardBorder}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ color: theme.text, fontSize: 14, fontWeight: 800 }}>Registre des analyses</div>
                  <div style={{ color: theme.textFaint, fontFamily: mono, fontSize: 10, marginTop: 4 }}>
                    Cliquez sur une ligne pour ouvrir le dossier complet
                  </div>
                </div>
                <span style={{ color: theme.textFaint, fontFamily: mono, fontSize: 10 }}>
                  {filtered.length} résultat(s)
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1030 }}>
                  <thead>
                    <tr>
                      {["ANALYSE", "CLIENT / DÉPÔT", "BRANCHE", "SCORES", "RISQUES", "STATUT", "DATE", "ACTIONS"].map((heading) => (
                        <th key={heading} style={{
                          textAlign: "left", padding: "13px 15px", color: theme.textFaint,
                          fontFamily: mono, fontSize: 9, letterSpacing: ".08em",
                          borderBottom: `1px solid ${theme.cardBorder}`, background: theme.tableHead,
                        }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a, index) => (
                      <tr
                        key={a.id}
                        className="analysis-row"
                        onClick={() => openDetails(a.id)}
                        style={{
                          cursor: "pointer",
                          animation: "admFade .22s ease backwards",
                          animationDelay: `${index * 0.018}s`,
                          background: index % 2 === 1 ? theme.tableRowAlt : theme.tableRow,
                        }}
                      >
                        <td style={td(theme)}>
                          <div style={{ color: theme.text, fontWeight: 800, fontFamily: mono }}>#{a.id}</div>
                          <div style={{ color: theme.textFaint, fontSize: 10, marginTop: 4 }}>Audit IA</div>
                        </td>
                        <td style={td(theme)}>
                          <div style={{ color: theme.text, fontWeight: 700 }}>📁 {a.depot_nom}</div>
                          <div style={{ color: theme.accentText, fontSize: 11, marginTop: 5 }}>{a.user_email}</div>
                        </td>
                        <td style={td(theme)}>
                          <code style={{
                            fontFamily: mono, color: theme.accentText, fontSize: 10,
                            padding: "4px 8px", borderRadius: 7, background: `${theme.accent}10`,
                          }}>{a.branche}</code>
                        </td>
                        <td style={td(theme)}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            <ScorePill score={a.score_qualite} />
                            <ScorePill score={a.score_securite} />
                            <ScorePill score={a.score_performance} />
                          </div>
                        </td>
                        <td style={td(theme)}><VulnerabilityBadge count={a.nb_vulns} /></td>
                        <td style={td(theme)}><StatusBadge status={a.statut} /></td>
                        <td style={{ ...td(theme), color: theme.textFaint, fontFamily: mono, fontSize: 10 }}>
                          {dateLabel(a.created_at)}
                        </td>
                        <td style={td(theme)} onClick={(event) => event.stopPropagation()}>
                          <div style={{ display: "flex", gap: 7 }}>
                            <button onClick={() => openDetails(a.id)} style={tableButton(theme.accent, theme.accentText)}>
                              Détails
                            </button>
                            <button
                              onClick={() => openDetails(a.id).then(() => undefined)}
                              style={tableButton("#ef4444", "#f87171")}
                              title="Ouvrir le détail puis supprimer"
                            >
                              Gérer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={8} style={{
                          color: theme.textFaint, textAlign: "center", padding: 50,
                          fontFamily: mono, fontSize: 11,
                        }}>⊘ Aucune analyse ne correspond aux filtres.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </main>

          <DetailDrawer
            analyse={selected}
            loading={detailsLoading}
            onClose={() => setSelected(null)}
            onDelete={deleteAnalyse}
          />

          {deleting && (
            <div style={{
              position: "fixed", left: 30, bottom: 30, zIndex: 60,
              borderRadius: 12, padding: "13px 18px", background: theme.card,
              color: theme.text, border: `1px solid ${theme.cardBorder}`,
              fontFamily: mono, fontSize: 11,
            }}>Suppression en cours...</div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

function td(theme: any): React.CSSProperties {
  return {
    padding: "13px 15px",
    borderBottom: `1px solid ${theme.tableBorder}`,
    color: theme.textMuted,
    fontSize: 12,
    verticalAlign: "middle",
  };
}

function tableButton(base: string, color: string): React.CSSProperties {
  return {
    border: `1px solid ${base}38`,
    background: `${base}13`,
    color,
    padding: "6px 10px",
    borderRadius: 7,
    fontFamily: mono,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  };
}
