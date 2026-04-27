// frontend/hooks/useVideoGenerator.ts
// ─────────────────────────────────────────────────────────────────────────────
//  Hook React pour la génération de vidéos via le backend MoviePy/FFmpeg
//
//  Usage :
//    const { genererVideo, loading, progression } = useVideoGenerator();
//    await genererVideo("vulnerabilite", { type_vuln: "SQL_INJECTION", ... });
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";

const API = "http://127.0.0.1:8000";

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
  videoUrl: string | null;
  resetVideo: () => void;
  verifierStatus: () => Promise<{ ready: boolean; dependencies: Record<string, boolean> }>;
}

export function useVideoGenerator(): UseVideoGeneratorReturn {
  const [loading, setLoading] = useState(false);
  const [progression, setProgression] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const resetVideo = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setErreur(null);
    setProgression("");
  }, [videoUrl]);

  const genererVideo = useCallback(
    async (type: VideoType, payload: VideoPayload) => {
      setLoading(true);
      setErreur(null);
      setProgression("Préparation de la génération vidéo…");

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);

      try {
        const jwt = localStorage.getItem("token");

        // Messages de progression simulés (la génération prend 10-60 secondes)
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

        // Afficher les messages de progression pendant la génération
        const progressInterval = setInterval(() => {
          if (msgIndex < messages.length - 1) {
            msgIndex++;
            setProgression(messages[msgIndex]);
          }
        }, 4000);

        setProgression(messages[0]);

        const endpoint = `/video/${type}`;
        const response = await fetch(`${API}${endpoint}`, {
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
          throw new Error(
            errorData.detail || `Erreur serveur ${response.status}`
          );
        }

        setProgression("Téléchargement de la vidéo…");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setProgression("Vidéo prête !");
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

  return { genererVideo, loading, progression, erreur, videoUrl, resetVideo, verifierStatus };
}
