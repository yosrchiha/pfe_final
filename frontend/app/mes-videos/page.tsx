"use client";
// frontend/app/mes-videos/page.tsx
// Fix: le token JWT ne peut pas être envoyé via <video src=...>
// Solution : on fetch le MP4 en blob avec le token, puis on crée un blob URL local

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://localhost:8000";

interface VideoItem {
  id: number;
  type_video: "application" | "vulnerabilite" | "rapport";
  titre: string;
  nom_projet: string | null;
  langue: string;
  score_qualite: number | null;
  score_securite: number | null;
  score_performance: number | null;
  created_at: string;
  stream_url: string;
  existe: boolean;
}

const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  rapport:       { label: "Rapport d'audit", emoji: "📊", color: "#6366f1" },
  vulnerabilite: { label: "Vulnérabilité",   emoji: "🛡️", color: "#ef4444" },
  application:   { label: "Présentation",    emoji: "🎬", color: "#10b981" },
};

function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const color = value >= 75 ? "#10b981" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: color + "18", border: `1px solid ${color}40`,
      borderRadius: 10, padding: "6px 12px", minWidth: 64,
    }}>
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function VideoCard({
  video,
  onPlay,
  onDelete,
  isPlaying,
  isLoading,
}: {
  video: VideoItem;
  onPlay: (v: VideoItem) => void;
  onDelete: (id: number) => void;
  isPlaying: boolean;
  isLoading: boolean;
}) {
  const meta = TYPE_LABELS[video.type_video] || TYPE_LABELS.application;
  const date = new Date(video.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      style={{
        background: isPlaying ? "#1e293b" : "#0f172a",
        border: `1px solid ${isPlaying ? meta.color : "#1e293b"}`,
        borderRadius: 16,
        padding: 20,
        transition: "all 0.2s",
        cursor: video.existe ? "pointer" : "default",
        boxShadow: isPlaying ? `0 0 20px ${meta.color}40` : "none",
        opacity: video.existe ? 1 : 0.6,
      }}
      onClick={() => video.existe && onPlay(video)}
    >
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: meta.color + "20", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            {meta.emoji}
          </div>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: meta.color,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 2,
            }}>
              {meta.label}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "#f1f5f9",
              maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {video.titre}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
          style={{
            background: "transparent", border: "none", color: "#ef4444",
            cursor: "pointer", fontSize: 16, padding: 4, borderRadius: 6,
            opacity: 0.6,
          }}
          title="Supprimer"
        >
          🗑️
        </button>
      </div>

      {/* Scores */}
      {(video.score_qualite !== null || video.score_securite !== null || video.score_performance !== null) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <ScoreBadge label="Qualité"  value={video.score_qualite} />
          <ScoreBadge label="Sécurité" value={video.score_securite} />
          <ScoreBadge label="Perf."    value={video.score_performance} />
        </div>
      )}

      {/* Métadonnées */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: "#64748b" }}>{date}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {video.nom_projet && (
            <span style={{
              fontSize: 10, background: "#1e293b", color: "#94a3b8",
              borderRadius: 6, padding: "2px 8px", border: "1px solid #334155",
            }}>
              {video.nom_projet}
            </span>
          )}
          <span style={{
            fontSize: 10, background: "#1e293b", color: "#94a3b8",
            borderRadius: 6, padding: "2px 8px", border: "1px solid #334155",
          }}>
            {video.langue.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Statut fichier */}
      {!video.existe && (
        <div style={{
          marginTop: 8, fontSize: 11, color: "#f59e0b",
          background: "#f59e0b18", borderRadius: 6, padding: "4px 8px",
        }}>
          ⚠️ Fichier supprimé du serveur
        </div>
      )}

      {/* Indicateur */}
      {isLoading && isPlaying && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, color: meta.color, fontSize: 12 }}>
          <span style={{
            width: 12, height: 12, border: `2px solid ${meta.color}`,
            borderTopColor: "transparent", borderRadius: "50%",
            display: "inline-block", animation: "spin 0.6s linear infinite",
          }} />
          Chargement de la vidéo…
        </div>
      )}
      {isPlaying && !isLoading && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, color: meta.color, fontSize: 12, fontWeight: 600 }}>
          <span style={{ animation: "pulse 1s infinite" }}>▶</span> Lecture en cours
        </div>
      )}
    </div>
  );
}

export default function MesVideosPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videos,       setVideos]       = useState<VideoItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<"all" | "rapport" | "vulnerabilite" | "application">("all");
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  // ✅ blob URL local — pas de problème JWT
  const [blobUrl,      setBlobUrl]      = useState<string | null>(null);
  const [fetchingBlob, setFetchingBlob] = useState(false);
  const [blobError,    setBlobError]    = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState<number | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const authHeaders = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Libérer le blob URL quand on change de vidéo
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/video/mes-videos`, { headers: authHeaders() });
      setVideos(res.data);
    } catch (e: any) {
      if (e.response?.status === 401) router.push("/login");
      else setError("Impossible de charger les vidéos.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch le MP4 en blob avec le token JWT, crée un blob URL local
  const handlePlay = useCallback(async (video: VideoItem) => {
    if (!video.existe) return;

    // Déjà en cours de lecture → rien
    if (playingVideo?.id === video.id && blobUrl) return;

    // Libérer l'ancien blob
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }

    setPlayingVideo(video);
    setFetchingBlob(true);
    setBlobError(null);

    try {
      const token = getToken();
      const response = await fetch(`${API}${video.stream_url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status} : ${response.statusText}`);
      }

      const blob = await response.blob();

      // Vérifier que le blob est bien un MP4
      if (blob.size === 0) {
        throw new Error("Fichier vidéo vide reçu du serveur.");
      }

      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      // Lancer la lecture après que React a mis à jour le DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(() => {
            // Le navigateur peut bloquer l'autoplay — pas grave, l'utilisateur clique play
          });
        }
      }, 50);
    } catch (err: any) {
      setBlobError(err.message || "Impossible de charger la vidéo.");
      setPlayingVideo(null);
    } finally {
      setFetchingBlob(false);
    }
  }, [playingVideo, blobUrl]);

  const handleClosePlayer = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setPlayingVideo(null);
    setBlobError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette vidéo définitivement ?")) return;
    setDeleting(id);
    try {
      await axios.delete(`${API}/video/mes-videos/${id}`, { headers: authHeaders() });
      setVideos(prev => prev.filter(v => v.id !== id));
      if (playingVideo?.id === id) handleClosePlayer();
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = filter === "all" ? videos : videos.filter(v => v.type_video === filter);

  const counts = {
    all:           videos.length,
    rapport:       videos.filter(v => v.type_video === "rapport").length,
    vulnerabilite: videos.filter(v => v.type_video === "vulnerabilite").length,
    application:   videos.filter(v => v.type_video === "application").length,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #060b14 0%, #0a1020 50%, #0d1525 100%)",
      color: "#f1f5f9",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .vid-card { animation: fadeIn 0.3s ease forwards; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#0a1020ee",
        borderBottom: "1px solid #1e293b",
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, padding: "8px 14px", color: "#94a3b8",
              cursor: "pointer", fontSize: 14,
            }}
          >
            ← Retour
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>
              🎬 Mes Vidéos Générées
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              {counts.all} vidéo{counts.all !== 1 ? "s" : ""} dans votre bibliothèque
            </p>
          </div>
        </div>
        <button
          onClick={fetchVideos}
          style={{
            background: "#6366f120", border: "1px solid #6366f140",
            borderRadius: 10, padding: "8px 16px", color: "#6366f1",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          ↺ Actualiser
        </button>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px" }}>

        {/* ✅ Lecteur principal — utilise blobUrl, pas stream_url directement */}
        {playingVideo && (
          <div style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 28,
            animation: "fadeIn 0.3s ease",
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1e293b",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
                  {TYPE_LABELS[playingVideo.type_video]?.emoji} {playingVideo.titre}
                </div>
                {playingVideo.nom_projet && (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Projet : {playingVideo.nom_projet}
                  </div>
                )}
              </div>
              <button
                onClick={handleClosePlayer}
                style={{
                  background: "#1e293b", border: "none", borderRadius: 8,
                  color: "#94a3b8", cursor: "pointer", padding: "6px 12px",
                }}
              >
                ✕ Fermer
              </button>
            </div>

            {/* Chargement blob */}
            {fetchingBlob && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: 300, gap: 16, background: "#060b14",
              }}>
                <div style={{
                  width: 40, height: 40,
                  border: "3px solid #6366f1", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ color: "#6366f1", fontSize: 14, fontWeight: 500 }}>
                  Chargement de la vidéo…
                </span>
              </div>
            )}

            {/* Erreur blob */}
            {blobError && (
              <div style={{
                padding: 32, background: "#060b14",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  padding: "12px 20px", background: "#ef444410",
                  border: "1px solid #ef444440", borderRadius: 12,
                  color: "#ef4444", fontSize: 14, textAlign: "center",
                }}>
                  ⚠️ {blobError}
                </div>
                <button
                  onClick={() => handlePlay(playingVideo)}
                  style={{
                    padding: "8px 20px", background: "#6366f120",
                    border: "1px solid #6366f140", borderRadius: 10,
                    color: "#6366f1", cursor: "pointer", fontSize: 13,
                  }}
                >
                  ↺ Réessayer
                </button>
              </div>
            )}

            {/* ✅ Video element — src = blob URL local, pas d'appel réseau avec JWT */}
            {blobUrl && !fetchingBlob && (
              <video
                ref={videoRef}
                controls
                autoPlay
                style={{ width: "100%", maxHeight: 520, background: "#000", display: "block" }}
                src={blobUrl}
              >
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            )}
          </div>
        )}

        {/* Filtres */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {(["all", "rapport", "vulnerabilite", "application"] as const).map(f => {
            const isActive = filter === f;
            const meta     = f === "all" ? null : TYPE_LABELS[f];
            const count    = counts[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 18px", borderRadius: 10,
                  border: `1px solid ${isActive ? (meta?.color ?? "#6366f1") : "#1e293b"}`,
                  background: isActive ? (meta?.color ?? "#6366f1") + "20" : "#0f172a",
                  color: isActive ? (meta?.color ?? "#6366f1") : "#64748b",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {meta ? `${meta.emoji} ${meta.label}` : "🎯 Toutes"}
                <span style={{
                  marginLeft: 6,
                  background: isActive ? (meta?.color ?? "#6366f1") + "40" : "#1e293b",
                  borderRadius: 6, padding: "1px 6px", fontSize: 11,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🎬</div>
            <p>Chargement de vos vidéos…</p>
          </div>
        ) : error ? (
          <div style={{
            textAlign: "center", padding: 60,
            background: "#ef444410", border: "1px solid #ef444440",
            borderRadius: 16, color: "#ef4444",
          }}>
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 80, color: "#64748b",
            background: "#0f172a", borderRadius: 20, border: "1px dashed #1e293b",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
              Aucune vidéo trouvée
            </p>
            <p style={{ fontSize: 13 }}>
              Générez des vidéos depuis les rapports d'analyse ou les pages de vulnérabilités.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {filtered.map((v, i) => (
              <div key={v.id} className="vid-card" style={{ animationDelay: `${i * 40}ms` }}>
                <VideoCard
                  video={v}
                  onPlay={handlePlay}
                  onDelete={handleDelete}
                  isPlaying={playingVideo?.id === v.id}
                  isLoading={fetchingBlob && playingVideo?.id === v.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

