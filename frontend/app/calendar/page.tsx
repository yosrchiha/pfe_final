"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

interface Task {
  id: number;
  type: "analyse" | "mr" | "issue" | "test";
  title: string;
  description: string | null;
  date: string;
  status: string;
  url?: string;
  projectName: string;
}

interface DayTasks {
  date: string;
  tasks: Task[];
}

interface WeekData {
  weekNumber: number;
  year: number;
  days: DayTasks[];
}

export default function CalendarPage() {
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
    selectedBg: isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",  // ← AJOUTER
    taskBg: isDark ? "#131625" : "#ffffff",
    taskBorder: isDark ? "#1e2538" : "#eef2ff",
    taskHover: isDark ? "#1a2030" : "#faf9fe",
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState("");

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  // Récupérer les tâches de l'utilisateur
  const fetchTasks = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const me = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
      const userId = me.data.id;

      const allTasks: Task[] = [];

      // 1. Récupérer les dépôts et analyses
      const depotsRes = await axios.get(`${API}/analyses/depots-user/${userId}`, { headers: getHeaders() });
      
      for (const depot of depotsRes.data) {
        try {
          const analysesRes = await axios.get(`${API}/analyses/depot/${depot.id}`, { headers: getHeaders() });
          for (const analyse of analysesRes.data) {
            allTasks.push({
              id: analyse.id,
              type: "analyse",
              title: `Analyse du dépôt ${depot.nom}`,
              description: `Score qualité: ${analyse.score_qualite || "—"}/100, Sécurité: ${analyse.score_securite || "—"}/100`,
              date: analyse.created_at,
              status: analyse.statut,
              projectName: depot.nom,
            });
          }
        } catch {}
      }

      // 2. Récupérer les MR
      for (const depot of depotsRes.data) {
        try {
          const mrRes = await axios.get(`${API}/merge-requests/depot/${depot.id}`, { headers: getHeaders() });
          for (const mr of mrRes.data) {
            allTasks.push({
              id: mr.id,
              type: "mr",
              title: mr.titre || `MR #${mr.mr_id_gitlab}`,
              description: `De ${mr.branche_source} → ${mr.branche_cible}`,
              date: mr.created_at,
              status: mr.statut,
              url: mr.mr_url,
              projectName: depot.nom,
            });
          }
        } catch {}
      }

      // 3. Récupérer les issues
      for (const depot of depotsRes.data) {
        try {
          const issuesRes = await axios.get(`${API}/issues/depot/${depot.id}`, { headers: getHeaders() });
          for (const issue of issuesRes.data) {
            allTasks.push({
              id: issue.id,
              type: "issue",
              title: issue.titre,
              description: issue.type_vuln ? `Vulnérabilité: ${issue.type_vuln} - ${issue.severite}` : null,
              date: issue.created_at,
              status: issue.statut,
              url: issue.issue_url,
              projectName: depot.nom,
            });
          }
        } catch {}
      }

      // 4. Récupérer les tests générés
      try {
        const testsRes = await axios.get(`${API}/tests/`, { headers: getHeaders() });
        for (const test of testsRes.data) {
          allTasks.push({
            id: test.id,
            type: "test",
            title: `Test généré: ${test.nom_fichier || "test"}`,
            description: `${test.nb_tests || 0} tests · Framework: ${test.framework || "—"}`,
            date: test.created_at,
            status: test.statut,
            projectName: test.projet_nom || "Inconnu",
          });
        }
      } catch {}

      // Trier par date (plus récent en premier)
      allTasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTasks(allTasks);
    } catch (err: any) {
      console.error("Erreur chargement tâches:", err);
      setError("Erreur lors du chargement des tâches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Obtenir le premier jour de la semaine (lundi)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // Obtenir toutes les dates d'une semaine
  const getWeekDates = (date: Date) => {
    const start = getStartOfWeek(new Date(date));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // Grouper les tâches par date
  const getTasksByDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return tasks.filter(task => {
      const taskDate = new Date(task.date).toISOString().split("T")[0];
      return taskDate === dateStr;
    });
  };

  const weekDays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const currentWeekDates = getWeekDates(currentDate);
  const weekNumber = Math.ceil((((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 4);

  const prevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "analyse": return "🔍";
      case "mr": return "🔀";
      case "issue": return "⚠️";
      case "test": return "🧪";
      default: return "📌";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "analyse": return "#6366f1";
      case "mr": return "#f59e0b";
      case "issue": return "#ef4444";
      case "test": return "#10b981";
      default: return "#64748b";
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "termine" || status === "merged" || status === "closed") return "#10b981";
    if (status === "en_cours" || status === "opened") return "#f59e0b";
    return "#64748b";
  };

  const getStatusLabel = (status: string) => {
    if (status === "termine") return "Terminé";
    if (status === "en_cours") return "En cours";
    if (status === "merged") return "Fusionné";
    if (status === "closed") return "Fermé";
    if (status === "opened") return "Ouvert";
    return status;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  };

  const selectedDateTasks = selectedDate ? tasks.filter(t => new Date(t.date).toISOString().split("T")[0] === selectedDate) : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text }}>
        
        {/* Header */}
        <div style={{ background: D.card, borderBottom: `1px solid ${D.border}`, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => router.push("/dashboard")} style={{ background: D.btnSec, border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: D.muted }}>
              ← Retour
            </button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", margin: 0 }}>📅 Calendrier des tâches</h1>
              <p style={{ fontSize: 13, color: D.faint, margin: "4px 0 0" }}>Suivez vos analyses, MR et issues semaine par semaine</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />
            <button onClick={fetchTasks} style={{ background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: D.muted }}>
              ↻ Rafraîchir
            </button>
          </div>
        </div>

        {/* Navigation semaine */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", background: D.card, borderBottom: `1px solid ${D.border}`, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={prevWeek} style={{ background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: D.muted }}>
              ← Semaine précédente
            </button>
            <button onClick={goToToday} style={{ background: D.btnPrimary, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: 600 }}>
              Aujourd'hui
            </button>
            <button onClick={nextWeek} style={{ background: D.btnSec, border: `1px solid ${D.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: D.muted }}>
              Semaine suivante →
            </button>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: D.text }}>
              Semaine {weekNumber} · {currentDate.getFullYear()}
            </div>
            <div style={{ fontSize: 12, color: D.faint }}>
              {formatDate(currentWeekDates[0])} - {formatDate(currentWeekDates[6])}
            </div>
          </div>
        </div>

        {/* Calendrier - Grille des jours */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", color: D.faint }}>
            <div style={{ width: 24, height: 24, borderWidth: 2, borderStyle: "solid", borderColor: D.border, borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: 12 }} />
            Chargement de vos tâches...
          </div>
        ) : (
          <div style={{ padding: "24px 32px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 32 }}>
              {currentWeekDates.map((date, idx) => {
                const dateStr = date.toISOString().split("T")[0];
                const dayTasks = getTasksByDate(date);
                const isToday = new Date().toISOString().split("T")[0] === dateStr;
                const isSelected = selectedDate === dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(dateStr)}
                    style={{
                      background: isSelected ? D.selectedBg : D.card,
                      border: `1px solid ${isToday ? "#6366f1" : D.border}`,
                      borderRadius: 16,
                      padding: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>{weekDays[idx]}</span>
                      <span style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: isToday ? "#6366f1" : D.text,
                        background: isToday ? D.selectedBg : "transparent",
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                      }}>
                        {date.getDate()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: D.faint, marginBottom: 8 }}>{formatDate(date)}</div>
                    {dayTasks.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {dayTasks.slice(0, 3).map((task, i) => (
                          <span key={i} style={{ fontSize: 10, color: getTypeColor(task.type) }}>{getTypeIcon(task.type)}</span>
                        ))}
                        {dayTasks.length > 3 && (
                          <span style={{ fontSize: 10, color: D.faint }}>+{dayTasks.length - 3}</span>
                        )}
                      </div>
                    )}
                    {dayTasks.length === 0 && (
                      <div style={{ fontSize: 11, color: D.faint, textAlign: "center", padding: "8px 0" }}>—</div>
                    )}
                    {dayTasks.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 10, color: getTypeColor(dayTasks[0].type) }}>
                        {dayTasks.length} tâche{dayTasks.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Détail des tâches pour la date sélectionnée */}
            {selectedDate && (
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 24, marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: D.text }}>
                    📋 Tâches du {new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </h2>
                  <button onClick={() => setSelectedDate(null)} style={{ background: D.btnSec, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: D.muted, fontSize: 12 }}>
                    Fermer
                  </button>
                </div>

                {selectedDateTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: D.faint }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                    <div>Aucune tâche pour cette journée</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {selectedDateTasks.map(task => (
                      <div
                        key={`${task.type}-${task.id}`}
                        style={{
                          background: D.taskBg,
                          border: `1px solid ${D.taskBorder}`,
                          borderRadius: 12,
                          padding: 16,
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 20 }}>{getTypeIcon(task.type)}</span>
                          <span style={{
                            fontSize: 11,
                            padding: "2px 10px",
                            borderRadius: 20,
                            background: `${getTypeColor(task.type)}20`,
                            color: getTypeColor(task.type),
                            fontWeight: 600,
                          }}>
                            {task.type === "analyse" ? "Analyse" : task.type === "mr" ? "Merge Request" : task.type === "issue" ? "Issue" : "Test"}
                          </span>
                          <span style={{
                            fontSize: 11,
                            padding: "2px 10px",
                            borderRadius: 20,
                            background: `${getStatusColor(task.status)}20`,
                            color: getStatusColor(task.status),
                          }}>
                            {getStatusLabel(task.status)}
                          </span>
                          {task.url && (
                            <a href={task.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#6366f1", textDecoration: "none" }}>
                              🔗 Voir sur GitLab
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: D.text, marginBottom: 6 }}>{task.title}</div>
                        <div style={{ fontSize: 12, color: D.faint, marginBottom: 6 }}>📁 {task.projectName}</div>
                        {task.description && (
                          <div style={{ fontSize: 12, color: D.muted, background: D.inputBg, padding: "8px 12px", borderRadius: 8, marginTop: 8 }}>
                            {task.description}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: D.faint, fontFamily: "monospace", marginTop: 8 }}>
                          {new Date(task.date).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Résumé des statistiques */}
            <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: D.faint, marginBottom: 8 }}>📊 Total des tâches</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#6366f1" }}>{tasks.length}</div>
              </div>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: D.faint, marginBottom: 8 }}>🔍 Analyses</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#10b981" }}>{tasks.filter(t => t.type === "analyse").length}</div>
              </div>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: D.faint, marginBottom: 8 }}>🔀 Merge Requests</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>{tasks.filter(t => t.type === "mr").length}</div>
              </div>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: D.faint, marginBottom: 8 }}>⚠️ Issues</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#ef4444" }}>{tasks.filter(t => t.type === "issue").length}</div>
              </div>
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: D.faint, marginBottom: 8 }}>🧪 Tests générés</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#8b5cf6" }}>{tasks.filter(t => t.type === "test").length}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

