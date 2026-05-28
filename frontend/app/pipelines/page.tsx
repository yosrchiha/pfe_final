"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

type Depot = {
  id: number;
  nom: string;
  project_url: string;
  branche: string;
};

type Preview = {
  depot_analyse_id: number;
  project_name: string;
  target_branch: string;
  languages: string[];
  has_existing_pipeline: boolean;
  existing_pipeline_content: string | null;
  yaml_content: string;
  warning: string | null;
};

type PublishResult = {
  depot_analyse_id: number;
  project_name: string;
  target_branch: string;
  source_branch: string;
  languages: string[];
  file_path: string;
  replaced_existing_pipeline: boolean;
  merge_request_iid: number;
  merge_request_url: string;
  merge_request_status: string;
};

type PipelineJob = {
  id: number;
  name: string;
  stage: string;
  status: string;
  web_url?: string | null;
};

type PipelineStatus = {
  found: boolean;
  ref: string;
  pipeline_id?: number | null;
  status?: string | null;
  web_url?: string | null;
  coverage?: number | null;
  jobs: PipelineJob[];
  message?: string | null;
};

function statusColor(status?: string | null) {
  if (status === "success") return "#10b981";
  if (status === "failed" || status === "canceled") return "#ef4444";
  if (status === "running") return "#3b82f6";
  return "#f59e0b";
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail || fallback;
  }
  return fallback;
}

export default function PipelinesPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [testsEnabled, setTestsEnabled] = useState(true);
  const [coverageEnabled, setCoverageEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [qualityEnabled, setQualityEnabled] = useState(true);
  const [coverageThreshold, setCoverageThreshold] = useState(70);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedDepot = useMemo(
    () => depots.find((depot) => depot.id === selectedId) ?? null,
    [depots, selectedId]
  );

  const headers = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "" };
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
          setTargetBranch(response.data[0].branche || "main");
        }
      } catch (requestError: unknown) {
        if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        setError(apiErrorMessage(requestError, "Impossible de charger vos dépôts analysés."));
      } finally {
        setLoading(false);
      }
    };
    loadDepots();
  }, [router]);

  const changeDepot = (id: number) => {
    setSelectedId(id);
    const depot = depots.find((item) => item.id === id);
    setTargetBranch(depot?.branche || "main");
    setPreview(null);
    setPublished(null);
    setPipelineStatus(null);
    setReplaceExisting(false);
    setError("");
    setSuccess("");
  };

  const payload = () => ({
    depot_analyse_id: Number(selectedId),
    target_branch: targetBranch.trim() || "main",
    tests_enabled: testsEnabled,
    coverage_enabled: coverageEnabled && testsEnabled,
    security_enabled: securityEnabled,
    quality_enabled: qualityEnabled,
    coverage_threshold: coverageThreshold,
  });

  const previewPipeline = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    setPublished(null);
    setPipelineStatus(null);
    try {
      const response = await axios.post<Preview>(`${API}/pipelines/preview`, payload(), { headers: headers() });
      setPreview(response.data);
      setReplaceExisting(false);
      setSuccess("Prévisualisation générée. Aucune modification n'a été effectuée sur GitLab.");
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, "Impossible de générer le pipeline."));
    } finally {
      setActionLoading(false);
    }
  };

  const publishPipeline = async () => {
    if (!selectedId || !preview) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await axios.post<PublishResult>(
        `${API}/pipelines/publish`,
        { ...payload(), replace_existing_pipeline: replaceExisting },
        { headers: headers() }
      );
      setPublished(response.data);
      setSuccess("Branche dédiée créée et Merge Request ouverte avec succès.");
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, "Impossible de publier le pipeline."));
    } finally {
      setActionLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!published) return;
    setStatusLoading(true);
    setError("");
    try {
      const response = await axios.get<PipelineStatus>(
        `${API}/pipelines/status/${published.depot_analyse_id}`,
        { headers: headers(), params: { ref: published.source_branch } }
      );
      setPipelineStatus(response.data);
    } catch (requestError: unknown) {
      setError(apiErrorMessage(requestError, "Impossible de récupérer le statut GitLab CI/CD."));
    } finally {
      setStatusLoading(false);
    }
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
    accent: "#6366f1",
    secondary: isDark ? "#1e2538" : "#f1f5f9",
  };

  const checkbox = (label: string, value: boolean, onChange: (checked: boolean) => void, disabled = false) => (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, color: disabled ? D.faint : D.text, cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={value} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
    </label>
  );

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "Inter, Arial, sans-serif" }}>
      <header style={{ height: 72, padding: "0 32px", borderBottom: `1px solid ${D.border}`, background: D.panel, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.push("/dashboard")} style={{ border: `1px solid ${D.border}`, background: D.secondary, color: D.text, borderRadius: 10, padding: "9px 14px", cursor: "pointer" }}>← Tableau de bord</button>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>Pipelines CI/CD</div>
            <div style={{ color: D.faint, fontSize: 12 }}>Configuration sécurisée du dépôt analysé</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "30px 26px", display: "grid", gridTemplateColumns: "minmax(340px, 430px) 1fr", gap: 22 }}>
        <section style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 18, padding: 22, height: "fit-content" }}>
          <h2 style={{ fontSize: 17, marginBottom: 6 }}>Configurer un pipeline</h2>
          <p style={{ fontSize: 13, color: D.muted, lineHeight: 1.5, marginBottom: 20 }}>Le pipeline sera d&apos;abord prévisualisé. La publication crée uniquement une branche séparée et une Merge Request.</p>

          {loading ? (
            <div style={{ color: D.muted, fontSize: 14 }}>Chargement des dépôts...</div>
          ) : depots.length === 0 ? (
            <div style={{ padding: 14, background: D.card, borderRadius: 12, color: D.muted, fontSize: 13 }}>Aucun dépôt analysé disponible. Lancez d&apos;abord une analyse.</div>
          ) : (
            <>
              <label style={{ display: "block", color: D.muted, fontSize: 12, fontWeight: 600, marginBottom: 7 }}>DÉPÔT ANALYSÉ</label>
              <select value={selectedId} onChange={(event) => changeDepot(Number(event.target.value))} style={{ width: "100%", height: 45, background: D.input, color: D.text, border: `1px solid ${D.border}`, borderRadius: 10, padding: "0 12px", marginBottom: 16 }}>
                {depots.map((depot) => <option key={depot.id} value={depot.id}>{depot.nom}</option>)}
              </select>

              <label style={{ display: "block", color: D.muted, fontSize: 12, fontWeight: 600, marginBottom: 7 }}>BRANCHE CIBLE</label>
              <input value={targetBranch} onChange={(event) => setTargetBranch(event.target.value)} style={{ width: "100%", height: 45, background: D.input, color: D.text, border: `1px solid ${D.border}`, borderRadius: 10, padding: "0 12px", marginBottom: 18 }} />

              <div style={{ display: "grid", gap: 9, marginBottom: 18 }}>
                {checkbox("Exécuter les tests unitaires", testsEnabled, (value) => {
                  setTestsEnabled(value);
                  if (!value) setCoverageEnabled(false);
                })}
                {checkbox("Mesurer la couverture", coverageEnabled, setCoverageEnabled, !testsEnabled)}
                {checkbox("Scanner la sécurité", securityEnabled, setSecurityEnabled)}
                {checkbox("Vérifier la qualité", qualityEnabled, setQualityEnabled)}
              </div>

              <label style={{ display: "block", color: D.muted, fontSize: 12, fontWeight: 600, marginBottom: 7 }}>SEUIL DE COUVERTURE</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                <input type="number" min={0} max={100} disabled={!testsEnabled || !coverageEnabled} value={coverageThreshold} onChange={(event) => setCoverageThreshold(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} style={{ width: 100, height: 44, background: D.input, color: D.text, border: `1px solid ${D.border}`, borderRadius: 10, padding: "0 12px" }} />
                <span style={{ color: D.muted, fontSize: 14 }}>% minimum</span>
              </div>

              <button onClick={previewPipeline} disabled={actionLoading || !selectedDepot} style={{ width: "100%", height: 46, border: "none", borderRadius: 12, background: D.accent, color: "white", fontWeight: 650, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? "Génération..." : "Prévisualiser le pipeline"}
              </button>
            </>
          )}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && <div style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>{error}</div>}
          {success && <div style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", fontSize: 13 }}>{success}</div>}

          {!preview ? (
            <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 18, padding: 42, textAlign: "center", color: D.muted }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>⚙️</div>
              Sélectionnez un dépôt et générez une prévisualisation de <code>.gitlab-ci.yml</code>.
            </div>
          ) : (
            <>
              <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 18, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 650 }}>.gitlab-ci.yml proposé</div>
                    <div style={{ fontSize: 12, color: D.faint, marginTop: 4 }}>{preview.project_name} · {preview.target_branch} · {preview.languages.join(" + ")}</div>
                  </div>
                  <span style={{ background: preview.has_existing_pipeline ? "#fffbeb" : "#ecfdf5", color: preview.has_existing_pipeline ? "#b45309" : "#047857", borderRadius: 20, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>
                    {preview.has_existing_pipeline ? "Pipeline existant" : "Nouveau pipeline"}
                  </span>
                </div>

                {preview.warning && (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb", color: isDark ? "#fbbf24" : "#92400e", border: "1px solid #fde68a", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                    ⚠️ {preview.warning}
                  </div>
                )}

                <pre style={{ background: isDark ? "#0b0e14" : "#0f172a", color: "#e2e8f0", padding: 17, borderRadius: 12, fontSize: 12, lineHeight: 1.55, overflowX: "auto", maxHeight: 460 }}>{preview.yaml_content}</pre>

                {preview.has_existing_pipeline && (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 15, color: D.muted, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} style={{ marginTop: 2 }} />
                    J&apos;ai vérifié la proposition et j&apos;autorise le remplacement du pipeline existant uniquement dans une branche de Merge Request.
                  </label>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                  <button onClick={previewPipeline} disabled={actionLoading} style={{ height: 43, padding: "0 16px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.secondary, color: D.text, cursor: "pointer" }}>Régénérer</button>
                  <button onClick={publishPipeline} disabled={actionLoading || (preview.has_existing_pipeline && !replaceExisting)} style={{ height: 43, padding: "0 18px", borderRadius: 10, border: "none", background: "#10b981", color: "white", fontWeight: 650, cursor: "pointer", opacity: actionLoading || (preview.has_existing_pipeline && !replaceExisting) ? 0.55 : 1 }}>
                    Créer la branche et la MR
                  </button>
                </div>
              </div>

              {published && (
                <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 18, padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Publication GitLab</div>
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", rowGap: 10, fontSize: 13, marginBottom: 17 }}>
                    <span style={{ color: D.faint }}>Branche créée</span><code>{published.source_branch}</code>
                    <span style={{ color: D.faint }}>MR GitLab</span><a href={published.merge_request_url} target="_blank" rel="noreferrer" style={{ color: D.accent }}>!{published.merge_request_iid} · Ouvrir la Merge Request</a>
                    <span style={{ color: D.faint }}>Statut MR</span><span>{published.merge_request_status}</span>
                  </div>
                  <button onClick={refreshStatus} disabled={statusLoading} style={{ height: 42, padding: "0 16px", border: "none", borderRadius: 10, background: D.accent, color: "white", fontWeight: 600, cursor: "pointer" }}>
                    {statusLoading ? "Synchronisation..." : "Actualiser le statut du pipeline"}
                  </button>
                </div>
              )}

              {pipelineStatus && (
                <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 18, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 16, fontWeight: 650 }}>Dernière exécution GitLab CI/CD</div>
                    {pipelineStatus.found && <span style={{ color: statusColor(pipelineStatus.status), fontWeight: 650, fontSize: 13 }}>{pipelineStatus.status}</span>}
                  </div>
                  {!pipelineStatus.found ? (
                    <div style={{ color: D.muted, fontSize: 13 }}>{pipelineStatus.message}</div>
                  ) : (
                    <>
                      {pipelineStatus.web_url && <a href={pipelineStatus.web_url} target="_blank" rel="noreferrer" style={{ color: D.accent, fontSize: 13 }}>Ouvrir le pipeline sur GitLab ↗</a>}
                      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                        {pipelineStatus.jobs.map((job) => (
                          <div key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 13px", borderRadius: 10, border: `1px solid ${D.border}`, background: D.card, fontSize: 13 }}>
                            <div><strong>{job.name}</strong><span style={{ color: D.faint, marginLeft: 10 }}>{job.stage}</span></div>
                            <span style={{ color: statusColor(job.status), fontWeight: 600 }}>{job.status}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
