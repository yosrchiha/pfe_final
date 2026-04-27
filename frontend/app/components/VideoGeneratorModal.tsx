// frontend/components/VideoGeneratorModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Composant modal de génération de vidéos
//  À intégrer dans rapport/page.tsx
//
//  Props :
//    rapport        → données du rapport (scores, vulns, recos)
//    nomProjet      → nom du projet analysé
//    isDark         → thème sombre / clair
//    ttsLangue      → langue sélectionnée ("fr" | "en")
//    onClose        → fermer le modal
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useVideoGenerator } from "@/hooks/useVideoGenerator";
import VideoPlayer from "./VideoPlayer";

interface VideoGeneratorModalProps {
  rapport: any;
  nomProjet: string;
  isDark: boolean;
  ttsLangue: "fr" | "en";
  onClose: () => void;
}

export default function VideoGeneratorModal({
  rapport,
  nomProjet,
  isDark,
  ttsLangue,
  onClose,
}: VideoGeneratorModalProps) {
  const { genererVideo, loading, progression, erreur, videoUrl, resetVideo } =
    useVideoGenerator();

  const [selectedType, setSelectedType] = useState<
    "application" | "vulnerabilite" | "rapport" | null
  >(null);
  const [selectedVulnIndex, setSelectedVulnIndex] = useState(0);

  const bg     = isDark ? "#1a2030" : "white";
  const bgSec  = isDark ? "#0f1117" : "#f8fafc";
  const border = isDark ? "#2d3748" : "#e2e8f0";
  const text   = isDark ? "#f8fafc" : "#0f172a";
  const muted  = isDark ? "#94a3b8" : "#64748b";

  const vulns = rapport?.vulnerabilites || [];

  const videoTypes = [
    {
      id: "application" as const,
      icon: "🎬",
      label: ttsLangue === "fr" ? "Présentation Application" : "App Presentation",
      desc: ttsLangue === "fr"
        ? "Vidéo de présentation complète de la plateforme d'audit IA (~50s)"
        : "Full presentation video of the AI audit platform (~50s)",
      duration: ttsLangue === "fr" ? "~50 secondes" : "~50 seconds",
    },
    {
      id: "vulnerabilite" as const,
      icon: "⚠️",
      label: ttsLangue === "fr" ? "Explication Vulnérabilité" : "Vulnerability Explanation",
      desc: ttsLangue === "fr"
        ? "Vidéo explicative pour une vulnérabilité spécifique (~35s)"
        : "Explanatory video for a specific vulnerability (~35s)",
      duration: ttsLangue === "fr" ? "~35 secondes" : "~35 seconds",
    },
    {
      id: "rapport" as const,
      icon: "📊",
      label: ttsLangue === "fr" ? "Résumé du Rapport" : "Report Summary",
      desc: ttsLangue === "fr"
        ? "Vidéo de synthèse du rapport d'audit complet (~70s)"
        : "Summary video of the complete audit report (~70s)",
      duration: ttsLangue === "fr" ? "~70 secondes" : "~70 seconds",
    },
  ];

  const handleGenerate = async () => {
    if (!selectedType) return;

    if (selectedType === "application") {
      await genererVideo("application", { langue: ttsLangue });
    } else if (selectedType === "vulnerabilite") {
      const vuln = vulns[selectedVulnIndex];
      if (!vuln) return;
      await genererVideo("vulnerabilite", {
        type_vuln: vuln.type,
        severite: vuln.severite,
        fichier: vuln.fichier,
        ligne: vuln.ligne,
        suggestion: vuln.suggestion,
        langue: ttsLangue,
      });
    } else if (selectedType === "rapport") {
      await genererVideo("rapport", {
        nom_projet: nomProjet,
        score_qualite: rapport?.score_qualite,
        score_securite: rapport?.score_securite,
        score_performance: rapport?.score_performance,
        vulnerabilites: vulns,
        recommandations: rapport?.recommandations || [],
        langue: ttsLangue,
      });
    }
  };

  const handleReset = () => {
    resetVideo();
    setSelectedType(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 24,
          padding: 28,
          maxWidth: videoUrl ? 760 : 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          border: "1px solid rgba(99,102,241,0.2)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: text, margin: 0 }}>
              🎬 {ttsLangue === "fr" ? "Générer une Vidéo" : "Generate a Video"}
            </h2>
            <p style={{ fontSize: 12, color: muted, marginTop: 4, marginBottom: 0 }}>
              {ttsLangue === "fr"
                ? "Powered by MoviePy + FFmpeg — Vidéos HD 1280×720"
                : "Powered by MoviePy + FFmpeg — HD 1280×720 Videos"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 20 }}
          >
            ✖
          </button>
        </div>

        {/* Affichage vidéo si générée */}
        {videoUrl && (
          <div style={{ marginBottom: 24 }}>
            <VideoPlayer
              videoUrl={videoUrl}
              title={
                selectedType === "application"
                  ? (ttsLangue === "fr" ? "Présentation Plateforme" : "Platform Presentation")
                  : selectedType === "vulnerabilite"
                  ? `Vulnérabilité — ${vulns[selectedVulnIndex]?.type}`
                  : `Rapport — ${nomProjet}`
              }
              isDark={isDark}
              onClose={handleReset}
            />
            <button
              onClick={handleReset}
              style={{
                marginTop: 12,
                padding: "8px 16px",
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
                color: "#6366f1",
              }}
            >
              ← {ttsLangue === "fr" ? "Générer une autre vidéo" : "Generate another video"}
            </button>
          </div>
        )}

        {/* Sélection du type (masqué si vidéo déjà générée) */}
        {!videoUrl && (
          <>
            {/* Types de vidéos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {videoTypes.map((vt) => (
                <div
                  key={vt.id}
                  onClick={() => { setSelectedType(vt.id); resetVideo(); }}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 14,
                    border: `2px solid ${selectedType === vt.id ? "#6366f1" : border}`,
                    background: selectedType === vt.id
                      ? "rgba(99,102,241,0.08)"
                      : bgSec,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <span style={{ fontSize: 24 }}>{vt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{vt.label}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{vt.desc}</div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    background: "rgba(99,102,241,0.1)",
                    color: "#6366f1",
                    borderRadius: 20,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}>
                    {vt.duration}
                  </span>
                </div>
              ))}
            </div>

            {/* Sélection de vulnérabilité si type = vulnerabilite */}
            {selectedType === "vulnerabilite" && vulns.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: muted, display: "block", marginBottom: 8 }}>
                  {ttsLangue === "fr" ? "Choisir la vulnérabilité :" : "Select vulnerability:"}
                </label>
                <select
                  value={selectedVulnIndex}
                  onChange={e => setSelectedVulnIndex(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    background: bgSec,
                    color: text,
                    fontSize: 13,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {vulns.map((v: any, i: number) => (
                    <option key={i} value={i}>
                      [{v.severite}] {v.type} — {v.fichier?.split("/").pop()} (ligne {v.ligne})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedType === "vulnerabilite" && vulns.length === 0 && (
              <div style={{ padding: "12px 16px", background: "rgba(16,185,129,0.1)", borderRadius: 10, color: "#10b981", fontSize: 13, marginBottom: 16 }}>
                ✅ {ttsLangue === "fr" ? "Aucune vulnérabilité détectée dans ce rapport." : "No vulnerabilities detected in this report."}
              </div>
            )}

            {/* Info technique */}
            <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: muted, lineHeight: 1.7 }}>
                ℹ️ <strong style={{ color: text }}>MoviePy + FFmpeg :</strong>{" "}
                {ttsLangue === "fr"
                  ? "MoviePy compose les slides et synchronise l'audio TTS. FFmpeg encode le résultat final en H.264/AAC (MP4). La génération prend 15-60 secondes selon la durée de la vidéo."
                  : "MoviePy composes slides and syncs TTS audio. FFmpeg encodes the final result in H.264/AAC (MP4). Generation takes 15-60 seconds depending on video length."}
              </div>
            </div>

            {/* Erreur */}
            {erreur && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
                ⚠ {erreur}
              </div>
            )}

            {/* Progression */}
            {loading && (
              <div style={{ padding: "12px 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 16, height: 16,
                    border: "2px solid #6366f1",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#6366f1" }}>{progression}</span>
                </div>
                <div style={{ fontSize: 11, color: muted }}>
                  {ttsLangue === "fr"
                    ? "La vidéo est en cours de génération. Ne fermez pas cette fenêtre."
                    : "Video is being generated. Do not close this window."}
                </div>
              </div>
            )}

            {/* Bouton générer */}
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedType || (selectedType === "vulnerabilite" && vulns.length === 0)}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "rgba(99,102,241,0.4)" : "#6366f1",
                border: "none",
                borderRadius: 12,
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !selectedType ? "not-allowed" : "pointer",
                opacity: !selectedType ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14,
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.6s linear infinite",
                  }} />
                  {ttsLangue === "fr" ? "Génération en cours…" : "Generating…"}
                </>
              ) : (
                <>🎬 {ttsLangue === "fr" ? "Générer la Vidéo" : "Generate Video"}</>
              )}
            </button>
          </>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
