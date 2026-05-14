// frontend/components/VideoPlayer.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  Composant VideoPlayer — Lecteur vidéo intégré avec contrôles personnalisés
//  Inclut : lecture, pause, plein écran, téléchargement, progression
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef, useState, useEffect } from "react";

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
  isDark?: boolean;
}

export default function VideoPlayer({
  videoUrl,
  title = "Vidéo explicative",
  onClose,
  isDark = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const bg    = isDark ? "#1a2030" : "white";
  const text  = isDark ? "#f8fafc" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#64748b";
  const ctrl  = isDark ? "#0f1117" : "#f1f5f9";

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const ct = videoRef.current.currentTime;
    const du = videoRef.current.duration || 1;
    setCurrentTime(ct);
    setProgress((ct / du) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = Number(e.target.value);
    videoRef.current.currentTime = (val / 100) * (videoRef.current.duration || 0);
    setProgress(val);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (videoRef.current) videoRef.current.volume = val;
    setVolume(val);
  };

  const toggleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${title.replace(/\s+/g, "_")}.mp4`;
    a.click();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        background: bg,
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        maxWidth: 720,
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(99,102,241,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎬</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: text }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{
              padding: "5px 12px",
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              color: "#6366f1",
              fontWeight: 500,
            }}
          >
            ⬇ Télécharger
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "5px 10px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                color: "#ef4444",
              }}
            >
              ✖
            </button>
          )}
        </div>
      </div>

      {/* Video */}
      <div style={{ position: "relative", background: "#000", aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          src={videoUrl}
          style={{ width: "100%", height: "100%", display: "block" }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />

        {/* Big play/pause button overlay */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "rgba(99,102,241,0.9)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}
            >
              ▶
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ background: ctrl, padding: "12px 20px" }}>
        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={handleSeek}
          style={{
            width: "100%",
            height: 4,
            accentColor: "#6366f1",
            cursor: "pointer",
            marginBottom: 10,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Play/pause */}
          <button
            onClick={togglePlay}
            style={{
              background: "#6366f1",
              border: "none",
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              color: "white",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          {/* Time */}
          <span style={{ fontSize: 12, color: muted, fontFamily: "monospace" }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume */}
          <span style={{ fontSize: 12, color: muted }}>🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={handleVolume}
            style={{ width: 70, accentColor: "#6366f1", cursor: "pointer" }}
          />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: muted,
              fontSize: 16,
            }}
          >
            {isFullscreen ? "⊡" : "⛶"}
          </button>
        </div>
      </div>
    </div>
  );
}


