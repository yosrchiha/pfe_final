"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

function FeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analyseId = searchParams.get("analyse_id");
  const projet = searchParams.get("projet") || "Analyse";

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
  };

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState("qualite");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [erreur, setErreur] = useState("");

  const getHeaders = () => {
    const jwt = localStorage.getItem("token");
    return { Authorization: jwt ? `Bearer ${jwt}` : "" };
  };

  const handleSubmit = async () => {
    if (rating === 0) { setErreur("Veuillez sélectionner une note"); return; }
    setLoading(true);
    setErreur("");
    try {
      await axios.post(
        `${API}/feedback/`,
        {
          analyse_id: analyseId ? parseInt(analyseId) : null,
          rating,
          comment: comment.trim() || null,
          category,
          projet_nom: projet,
        },
        { headers: getHeaders() }
      );
      setSubmitted(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setErreur(typeof detail === "string" ? detail : "Erreur lors de l'envoi du feedback");
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: "qualite",     label: "Qualité du code",       icon: "📊" },
    { value: "securite",    label: "Analyse sécurité",      icon: "🛡️" },
    { value: "performance", label: "Performance",           icon: "⚡" },
    { value: "tests",       label: "Tests générés",         icon: "🧪" },
    { value: "interface",   label: "Interface utilisateur", icon: "🎨" },
    { value: "global",      label: "Expérience globale",    icon: "⭐" },
  ];

  const ratingLabels: Record<number, string> = {
    1: "😞 Très insatisfait",
    2: "😕 Insatisfait",
    3: "😐 Neutre",
    4: "😊 Satisfait",
    5: "🤩 Très satisfait",
  };

  if (submitted) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
          <div style={{ width: "100%", maxWidth: 480, textAlign: "center", animation: "fadeIn 0.4s ease" }}>
            <div style={{ width: 72, height: 72, background: "rgba(16,185,129,0.15)", border: "2px solid #10b981", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 24px" }}>🎉</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: D.text, marginBottom: 10 }}>Merci pour votre retour !</h1>
            <p style={{ fontSize: 14, color: D.faint, marginBottom: 32, lineHeight: 1.6 }}>
              Votre avis nous aide à améliorer AuditPlatform.{rating >= 4 ? " ✨" : ""}
            </p>
            <button onClick={() => router.push("/dashboard")}
              style={{ padding: "12px 28px", background: D.btnPrimary, border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              ← Retour au tableau de bord
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cat-opt:hover { border-color: #6366f1 !important; }
        .star-btn { background: none; border: none; cursor: pointer; font-size: 32px; padding: 0; transition: transform 0.15s; line-height: 1; }
        .star-btn:hover { transform: scale(1.15); }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text, padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", animation: "fadeIn 0.4s ease" }}>

          {/* Header nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <button onClick={() => router.back()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", fontSize: 13, color: D.muted, cursor: "pointer" }}>
              ← Retour
            </button>
            <ThemeToggle />
          </div>

          {/* Titre */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: D.tag, border: `1px solid ${D.border}`, borderRadius: 100, padding: "5px 16px", fontSize: 12, fontWeight: 500, color: D.muted, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, background: "#6366f1", borderRadius: "50%" }} />
              AuditPlatform · Feedback
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: D.text, letterSpacing: "-0.02em", marginBottom: 8 }}>Votre avis compte</h1>
            <p style={{ fontSize: 14, color: D.faint }}>
              Projet : <strong style={{ color: D.text }}>{projet}</strong>
            </p>
          </div>

          {/* Card Note */}
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>
              ⭐ Note globale
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} className="star-btn"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ color: i <= (hoverRating || rating) ? "#f59e0b" : D.border }}>
                  ★
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: rating ? D.muted : D.faint }}>
              {ratingLabels[rating] || "Cliquez sur une étoile pour noter"}
            </p>
          </div>

          {/* Card Catégorie */}
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}` }}>
              🏷️ Catégorie
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {categories.map(cat => (
                <div key={cat.value} className="cat-opt"
                  onClick={() => setCategory(cat.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px",
                    border: `1px solid ${category === cat.value ? "#6366f1" : D.border}`,
                    borderRadius: 14, cursor: "pointer",
                    background: category === cat.value ? "rgba(99,102,241,0.08)" : "transparent",
                    borderLeft: category === cat.value ? "3px solid #6366f1" : `1px solid ${D.border}`,
                    transition: "all 0.15s",
                  }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: category === cat.value ? 600 : 500, color: D.text }}>{cat.label}</span>
                  {category === cat.value && <span style={{ marginLeft: "auto", color: "#6366f1", fontSize: 14 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Card Commentaire */}
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: D.text, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${D.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>💬 Commentaire <span style={{ fontSize: 12, fontWeight: 400, color: D.faint }}>(optionnel)</span></span>
              <span style={{ fontSize: 12, color: D.faint, fontWeight: 400 }}>{comment.length}/500</span>
            </div>
            <textarea
              rows={4}
              placeholder="Partagez votre expérience, suggestions d'amélioration..."
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              style={{
                width: "100%", padding: "12px 14px",
                border: `1px solid ${D.border}`, borderRadius: 14,
                fontSize: 14, fontFamily: "inherit",
                background: D.inputBg, color: D.text,
                resize: "vertical", outline: "none",
              }}
            />
          </div>

          {erreur && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "14px 18px", fontSize: 13, color: "#ef4444", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>⚠️</span> {erreur}
            </div>
          )}

          {/* Bouton */}
          <button onClick={handleSubmit} disabled={loading || rating === 0}
            style={{
              width: "100%", padding: "14px 24px",
              background: D.btnPrimary, color: "white",
              border: "none", borderRadius: 14,
              fontSize: 15, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              opacity: (loading || rating === 0) ? 0.6 : 1,
            }}>
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Envoi en cours…
              </>
            ) : "📤 Envoyer mon avis"}
          </button>

        </div>
      </div>
    </>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <FeedbackContent />
    </Suspense>
  );
}