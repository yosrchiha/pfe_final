// frontend/hooks/useVideoGenerator.ts

import { useState, useCallback } from "react";

const API = "http://localhost:8000";

export type VideoType = "application" | "vulnerabilite" | "rapport";

interface VideoVulnPayload {
  type_vuln: string;
  severite: string;
  fichier: string;
  ligne: number;
  suggestion: string;
  langue?: "fr" | "en";
}

interface VideoRapportPayload {
  nom_projet: string;
  score_qualite?: number;
  score_securite?: number;
  score_performance?: number;
  vulnerabilites?: any[];
  recommandations?: any[];
  langue?: "fr" | "en";
}

interface VideoApplicationPayload {
  langue?: "fr" | "en";
  style?: string;
}

type VideoPayload = VideoVulnPayload | VideoRapportPayload | VideoApplicationPayload;

interface UseVideoGeneratorReturn {
  genererVideo: (type: VideoType, payload: VideoPayload) => Promise<void>;
  loading: boolean;
  progression: string;
  erreur: string | null;
  videoUrl: string | null;       // blob URL pour lecture immédiate
  savedVideoId: number | null;   // ← ID en base pour "mes-videos"
  resetVideo: () => void;
  verifierStatus: () => Promise<{ ready: boolean; dependencies: Record<string, boolean> }>;
}

export function useVideoGenerator(): UseVideoGeneratorReturn {
  const [loading,      setLoading]      = useState(false);
  const [progression,  setProgression]  = useState("");
  const [erreur,       setErreur]       = useState<string | null>(null);
  const [videoUrl,     setVideoUrl]     = useState<string | null>(null);
  const [savedVideoId, setSavedVideoId] = useState<number | null>(null);

  const resetVideo = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setSavedVideoId(null);
    setErreur(null);
    setProgression("");
  }, [videoUrl]);

  const genererVideo = useCallback(
    async (type: VideoType, payload: VideoPayload) => {
      setLoading(true);
      setErreur(null);
      setSavedVideoId(null);
      setProgression("Préparation de la génération vidéo…");

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);

      try {
        const jwt = localStorage.getItem("token");

        const progressMessages = {
          application: [
            "Création des slides de présentation…",
            "Génération de la narration audio TTS…",
            "Composition des frames vidéo avec MoviePy…",
            "Encodage MP4 en cours via FFmpeg (H.264)…",
            "Finalisation de la vidéo…",
          ],
          vulnerabilite: [
            "Analyse de la vulnérabilité OWASP…",
            "Création des slides explicatifs…",
            "Génération de la narration audio TTS…",
            "Composition vidéo avec MoviePy…",
            "Encodage via FFmpeg…",
          ],
          rapport: [
            "Analyse du rapport d'audit…",
            "Création des slides de synthèse…",
            "Génération de la narration TTS…",
            "Composition de la vidéo avec MoviePy…",
            "Encodage final via FFmpeg…",
          ],
        };

        const messages = progressMessages[type];
        let msgIndex = 0;
        const progressInterval = setInterval(() => {
          if (msgIndex < messages.length - 1) {
            msgIndex++;
            setProgression(messages[msgIndex]);
          }
        }, 4000);

        setProgression(messages[0]);

        // ── 1. Génération de la vidéo (reçoit le fichier MP4) ──────────────
        const response = await fetch(`${API}/video/${type}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwt ? `Bearer ${jwt}` : "",
          },
          body: JSON.stringify(payload),
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Erreur serveur ${response.status}`);
        }

        setProgression("Téléchargement de la vidéo…");

        // Blob pour lecture immédiate dans le player
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setProgression("Vidéo prête !");

        // ── 2. Récupérer l'ID de la vidéo sauvegardée en base ─────────────
        //    On appelle mes-videos et on prend la première (la plus récente)
        if (jwt) {
          try {
            const listRes = await fetch(`${API}/video/mes-videos`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (listRes.ok) {
              const videos = await listRes.json();
              if (videos.length > 0) {
                setSavedVideoId(videos[0].id); // triées par created_at DESC
              }
            }
          } catch {
            // Non bloquant : la vidéo joue quand même
          }
        }
      } catch (e: any) {
        setErreur(e.message || "Erreur inconnue lors de la génération vidéo");
        setProgression("");
      } finally {
        setLoading(false);
      }
    },
    [videoUrl]
  );

  const verifierStatus = useCallback(async () => {
    const jwt = localStorage.getItem("token");
    const res = await fetch(`${API}/video/status`, {
      headers: { Authorization: jwt ? `Bearer ${jwt}` : "" },
    });
    return await res.json();
  }, []);

  return { genererVideo, loading, progression, erreur, videoUrl, savedVideoId, resetVideo, verifierStatus };
}

