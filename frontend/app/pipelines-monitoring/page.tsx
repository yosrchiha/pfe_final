"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Activity,
  ArrowLeft,
  CircleCheckBig,
  CircleX,
  Clock3,
  ExternalLink,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TestTubeDiagonal,
  Workflow,
} from "lucide-react";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

type Depot = {
  id: number;
  nom: string;
  project_url: string;
  branche: string;
};

type PipelineJob = {
  id: number;
  name: string;
  stage: string;
  status: string;
  web_url?: string | null;
  duration?: number | null;
};

type PipelineItem = {
  id: number;
  status?: string | null;
  ref?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  duration?: number | null;
  coverage?: number | null;
  web_url?: string | null;
  jobs: PipelineJob[];
};

type PipelineHistory = {
  depot_analyse_id: number;
  project_name: string;
  pipelines: PipelineItem[];
};

type StatusTone = {
  label: string;
  color: string;
  background: string;
  border: string;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || fallback;
  }
  return fallback;
}

function toneForStatus(status?: string | null): StatusTone {
  switch (status) {
    case "success":
      return { label: "success", color: "#059669", background: "#ecfdf5", border: "#a7f3d0" };
    case "failed":
      return { label: "failed", color: "#dc2626", background: "#fef2f2", border: "#fecaca" };
    case "running":
      return { label: "running", color: "#2563eb", background: "#eff6ff", border: "#bfdbfe" };
    case "pending":
    case "created":
    case "preparing":
      return { label: status || "pending", color: "#d97706", background: "#fffbeb", border: "#fde68a" };
    case "canceled":
    case "skipped":
      return { label: status, color: "#64748b", background: "#f8fafc", border: "#e2e8f0" };
    default:
      return { label: status || "inconnu", color: "#64748b", background: "#f8fafc", border: "#e2e8f0" };
  }
}

function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function stageStatus(jobs: PipelineJob[]): string | null {
  if (jobs.length === 0) return null;
  if (jobs.some((job) => job.status === "failed")) return "failed";
  if (jobs.some((job) => job.status === "running")) return "running";
  if (jobs.some((job) => ["pending", "created", "preparing"].includes(job.status))) return "pending";
  if (jobs.every((job) => job.status === "success")) return "success";
  if (jobs.some((job) => job.status === "canceled")) return "canceled";
  return jobs[0].status;
}

function stageDuration(jobs: PipelineJob[]): number | null {
  const durations = jobs.map((job) => job.duration).filter((value): value is number => typeof value === "number");
  if (durations.length === 0) return null;
  return durations.reduce((sum, current) => sum + current, 0);
}

function StatusIcon({ status }: { status?: string | null }) {
  if (status === "success") return <CircleCheckBig size={22} />;
  if (status === "failed") return <CircleX size={22} />;
  if (status === "running") return <LoaderCircle size={22} className="pipeline-spin" />;
  return <Clock3 size={22} />;
}

const STAGES = [
  { key: "test", label: "Tests", description: "Exécution des tests", Icon: TestTubeDiagonal },
  { key: "security", label: "Sécurité", description: "Scan des risques", Icon: ShieldCheck },
  { key: "quality", label: "Qualité", description: "Validation des standards", Icon: Activity },
] as const;

export default function PipelinesMonitoringPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [history, setHistory] = useState<PipelineHistory | null>(null);
  const [loadingDepots, setLoadingDepots] = useState(true);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [error, setError] = useState("");

  const headers = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  const D = {
    bg: theme.bg,
    panel: theme.bgSecondary,
    card: theme.bgCard,
    border: theme.border,
    text: theme.text,
    muted: theme.textMuted,
    faint: theme.textFaint,
    input: theme.input,
    sidebarActive: isDark ? "#1b2b49" : "#eaf2ff",
    sidebarActiveText: isDark ? "#93c5fd" : "#2563eb",
    bluePanel: isDark ? "#14223a" : "#eef5ff",
    blueBorder: isDark ? "#28426a" : "#bfdbfe",
  };

  const loadHistory = async (depotId: number) => {
    setLoadingPipelines(true);
    setError("");
    try {
      const response = await axios.get<PipelineHistory>(`${API}/pipelines/history/${depotId}`, {
        headers: headers(),
        params: { limit: 6 },
      });
      setHistory(response.data);
    } catch (requestError: unknown) {
      setHistory(null);
      setError(apiErrorMessage(requestError, "Impossible de charger l'historique des pipelines GitLab."));
    } finally {
      setLoadingPipelines(false);
    }
  };

  useEffect(() => {
    const loadDepots = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }
        const response = await axios.get<Depot[]>(`${API}/pipelines/depots`, { headers: headers() });
        setDepots(response.data);
        if (response.data.length > 0) {
          setSelectedId(response.data[0].id);
          await loadHistory(response.data[0].id);
        }
      } catch (requestError: unknown) {
        if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        setError(apiErrorMessage(requestError, "Impossible de charger vos dépôts analysés."));
      } finally {
        setLoadingDepots(false);
      }
    };
    loadDepots();
    // La fonction est exécutée uniquement au chargement initial, comme la page de configuration existante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selectDepot = async (id: number) => {
    setSelectedId(id);
    await loadHistory(id);
  };

  const summary = useMemo(() => {
    const pipelines = history?.pipelines ?? [];
    return {
      total: pipelines.length,
      success: pipelines.filter((pipeline) => pipeline.status === "success").length,
      failed: pipelines.filter((pipeline) => pipeline.status === "failed").length,
      running: pipelines.filter((pipeline) => ["running", "pending", "created", "preparing"].includes(pipeline.status || "")).length,
    };
  }, [history]);

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "Inter, Arial, sans-serif" }}>
      <style jsx global>{`
        @keyframes pipelineSpin { to { transform: rotate(360deg); } }
        .pipeline-spin { animation: pipelineSpin 1s linear infinite; }
      `}</style>
      <header style={{ height: 72, background: D.panel, borderBottom: `1px solid ${D.border}`, padding: "0 30px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.push("/dashboard")} style={{ display: "flex", gap: 7, alignItems: "center", padding: "9px 13px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.card, color: D.text, cursor: "pointer" }}>
            <ArrowLeft size={16} /> Tableau de bord
          </button>
          <div>
            <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>Pipelines CI/CD</h1>
            <p style={{ margin: "3px 0 0", color: D.faint, fontSize: 12 }}>Suivi réel des exécutions GitLab</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div style={{ maxWidth: 1450, margin: "0 auto", padding: "25px 28px", display: "grid", gridTemplateColumns: "245px minmax(680px, 1fr)", gap: 25 }}>
        <aside style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 17, padding: 15, height: "fit-content" }}>
          <button onClick={() => router.push("/pipelines-monitoring")} style={{ width: "100%", height: 56, border: "none", borderRadius: 12, background: D.sidebarActive, color: D.sidebarActiveText, fontWeight: 650, fontSize: 15, display: "flex", gap: 12, alignItems: "center", padding: "0 16px", cursor: "pointer", marginBottom: 8 }}>
            <Workflow size={21} /> Pipelines
          </button>
          <button onClick={() => router.push("/pipelines")} style={{ width: "100%", height: 56, border: "none", borderRadius: 12, background: "transparent", color: D.text, fontWeight: 550, fontSize: 15, display: "flex", gap: 12, alignItems: "center", padding: "0 16px", cursor: "pointer" }}>
            <Settings2 size={21} /> Configuration CI/CD
          </button>
        </aside>

        <main style={{ display: "grid", gap: 22 }}>
          <section style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 17, padding: "20px 24px", display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20 }}>
            <div style={{ minWidth: 280 }}>
              <label style={{ color: D.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8 }}>DÉPÔT ANALYSÉ</label>
              {loadingDepots ? (
                <div style={{ color: D.muted, fontSize: 14 }}>Chargement des dépôts...</div>
              ) : depots.length === 0 ? (
                <div style={{ color: D.muted, fontSize: 14 }}>Aucun dépôt disponible.</div>
              ) : (
                <select value={selectedId} onChange={(event) => selectDepot(Number(event.target.value))} style={{ width: 310, height: 44, borderRadius: 10, border: `1px solid ${D.border}`, color: D.text, background: D.input, padding: "0 12px", fontSize: 14 }}>
                  {depots.map((depot) => <option value={depot.id} key={depot.id}>{depot.nom}</option>)}
                </select>
              )}
            </div>
            <button disabled={!selectedId || loadingPipelines} onClick={() => selectedId && loadHistory(Number(selectedId))} style={{ height: 44, border: `1px solid ${D.border}`, borderRadius: 10, background: D.card, color: D.text, display: "flex", alignItems: "center", gap: 8, padding: "0 17px", cursor: loadingPipelines ? "not-allowed" : "pointer", opacity: loadingPipelines ? 0.7 : 1 }}>
              <RefreshCw size={16} className={loadingPipelines ? "pipeline-spin" : ""} /> Actualiser
            </button>
          </section>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "14px 18px", borderRadius: 12, fontSize: 14 }}>{error}</div>
          )}

          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, 1fr))", gap: 14 }}>
            {[
              { label: "Total", value: summary.total, color: "#2563eb" },
              { label: "Réussis", value: summary.success, color: "#059669" },
              { label: "Échoués", value: summary.failed, color: "#dc2626" },
              { label: "En cours", value: summary.running, color: "#d97706" },
            ].map((item) => (
              <div key={item.label} style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 14, padding: "17px 19px" }}>
                <div style={{ color: D.muted, fontSize: 13, marginBottom: 7 }}>{item.label}</div>
                <div style={{ fontSize: 29, fontWeight: 720, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </section>

          <section style={{ background: D.bluePanel, border: `1px solid ${D.blueBorder}`, borderRadius: 16, padding: "22px 26px" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 19, color: isDark ? D.text : "#1e3a8a" }}>Étapes du pipeline</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {STAGES.map(({ key, label, description, Icon }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 42, height: 42, background: isDark ? "#202e4a" : "#dbeafe", borderRadius: 7, display: "grid", placeItems: "center", color: "#2563eb" }}><Icon size={23} /></div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: isDark ? D.text : "#1e3a8a" }}>{label}</div>
                    <div style={{ fontSize: 14, color: isDark ? D.muted : "#2563eb", marginTop: 3 }}>{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {loadingPipelines ? (
            <section style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 17, padding: 34, color: D.muted, display: "flex", alignItems: "center", gap: 10 }}>
              <LoaderCircle size={20} className="pipeline-spin" /> Chargement des pipelines GitLab...
            </section>
          ) : history && history.pipelines.length === 0 ? (
            <section style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 17, padding: "34px 28px", textAlign: "center" }}>
              <Workflow size={34} style={{ margin: "0 auto 12px", color: D.faint }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Aucune exécution GitLab trouvée</h3>
              <p style={{ color: D.muted, margin: "0 auto 20px", maxWidth: 560, lineHeight: 1.5 }}>Configurez un pipeline puis créez une branche et une Merge Request pour déclencher une première exécution.</p>
              <button onClick={() => router.push("/pipelines")} style={{ border: "none", borderRadius: 10, padding: "12px 18px", color: "white", background: "#2563eb", fontWeight: 650, cursor: "pointer" }}>Configurer CI/CD</button>
            </section>
          ) : (
            history?.pipelines.map((pipeline) => {
              const pipelineTone = toneForStatus(pipeline.status);
              return (
                <article key={pipeline.id} style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 17, padding: "27px 29px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, marginBottom: 21 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 49, height: 49, borderRadius: 12, display: "grid", placeItems: "center", color: pipelineTone.color, background: pipelineTone.background, border: `1px solid ${pipelineTone.border}` }}>
                        <StatusIcon status={pipeline.status} />
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 5px", fontSize: 21 }}>Pipeline #{pipeline.id}</h3>
                        <div style={{ color: D.muted, fontSize: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          <span>{history.project_name}</span>
                          <span style={{ display: "flex", gap: 5, alignItems: "center" }}><GitBranch size={13} /> {pipeline.ref || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-block", color: pipelineTone.color, background: pipelineTone.background, border: `1px solid ${pipelineTone.border}`, borderRadius: 7, padding: "8px 15px", fontWeight: 700, fontSize: 13 }}>{pipelineTone.label}</span>
                      <div style={{ marginTop: 10, color: D.muted, fontSize: 13 }}>{formatDate(pipeline.created_at)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 20 }}>
                    {STAGES.map(({ key, label }) => {
                      const jobs = pipeline.jobs.filter((job) => job.stage === key);
                      const status = stageStatus(jobs);
                      const tone = toneForStatus(status);
                      const duration = stageDuration(jobs);
                      return (
                        <div key={key} style={{ minHeight: 107, background: status ? tone.background : D.card, border: `1px solid ${status ? tone.border : D.border}`, borderRadius: 13, padding: "17px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                            <strong style={{ fontSize: 16 }}>{label}</strong>
                            {status && <span style={{ width: 9, height: 9, borderRadius: 99, background: tone.color }} />}
                          </div>
                          {jobs.length === 0 ? (
                            <span style={{ color: D.faint, fontSize: 13 }}>Non exécuté</span>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "end" }}>
                              <span style={{ color: tone.color, fontWeight: 650, fontSize: 14 }}>{tone.label}</span>
                              <span style={{ color: D.muted, fontSize: 13 }}>{formatDuration(duration)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 19, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 18, color: D.muted, fontSize: 14 }}>
                      <span>Durée totale : <strong style={{ color: D.text }}>{formatDuration(pipeline.duration)}</strong></span>
                      {pipeline.coverage !== null && pipeline.coverage !== undefined && <span>Couverture : <strong style={{ color: D.text }}>{pipeline.coverage}%</strong></span>}
                    </div>
                    {pipeline.web_url && (
                      <a href={pipeline.web_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: D.text, border: `1px solid ${D.border}`, borderRadius: 11, height: 43, padding: "0 16px", display: "flex", alignItems: "center", gap: 8, fontWeight: 550, fontSize: 14 }}>
                        Voir les logs GitLab <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
