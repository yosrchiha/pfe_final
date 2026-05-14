"use client";

import { useState, useEffect, Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";

const API = "http://localhost:8000";

function FeedbackContent() {
   
  const router = useRouter();
  const searchParams = useSearchParams();
  const analyseId = searchParams.get("analyse_id");
  const projet = searchParams.get("projet") || "Analyse";

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
    if (rating === 0) {
      setErreur("Veuillez sélectionner une note");
      return;
    }

    setLoading(true);
    setErreur("");

    try {
      const res = await axios.post(
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

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          className={`star ${i <= (hoverRating || rating) ? "active" : ""}`}
          onClick={() => setRating(i)}
          onMouseEnter={() => setHoverRating(i)}
          onMouseLeave={() => setHoverRating(0)}
        >
          ★
        </button>
      );
    }
    return stars;
  };

  const categories = [
    { value: "qualite", label: "Qualité du code", icon: "📊", color: "#10b981" },
    { value: "securite", label: "Analyse sécurité", icon: "🛡️", color: "#6366f1" },
    { value: "performance", label: "Performance", icon: "⚡", color: "#f59e0b" },
    { value: "tests", label: "Tests générés", icon: "🧪", color: "#8b5cf6" },
    { value: "interface", label: "Interface utilisateur", icon: "🎨", color: "#ec489a" },
    { value: "global", label: "Expérience globale", icon: "⭐", color: "#ef4444" },
  ];

  if (submitted) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .thanks-card {
            background: white;
            border-radius: 32px;
            padding: 48px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            animation: fadeInUp 0.5s ease;
          }
          .thanks-icon {
            font-size: 72px;
            margin-bottom: 24px;
          }
          .thanks-title {
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
          }
          .thanks-text {
            font-size: 15px;
            color: #64748b;
            margin-bottom: 32px;
            line-height: 1.6;
          }
          .btn-dashboard {
            padding: 12px 28px;
            background: #0f172a;
            border: none;
            border-radius: 40px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-dashboard:hover {
            background: #1e293b;
            transform: translateY(-2px);
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div className="thanks-card">
          <div className="thanks-icon">🎉</div>
          <div className="thanks-title">Merci pour votre retour !</div>
          <div className="thanks-text">
            Votre avis nous est précieux et nous aide à améliorer AuditPlatform.
            {rating >= 4 && " ✨"}
          </div>
          <button className="btn-dashboard" onClick={() => router.push("/dashboard")}>
            ← Retour au tableau de bord
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .feedback-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Inter', sans-serif;
        }

        .feedback-card {
          background: white;
          border-radius: 32px;
          max-width: 560px;
          width: 100%;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          animation: slideUp 0.4s ease;
        }

        .feedback-header {
          background: linear-gradient(135deg, #0f172a, #1e293b);
          padding: 32px;
          text-align: center;
          color: white;
        }

        .feedback-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .feedback-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .feedback-sub {
          font-size: 13px;
          opacity: 0.8;
        }

        .feedback-content {
          padding: 32px;
        }

        .project-badge {
          background: #f1f5f9;
          border-radius: 40px;
          padding: 8px 16px;
          font-size: 13px;
          color: #475569;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
        }

        .stars-container {
          margin-bottom: 24px;
        }

        .stars-label {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 12px;
        }

        .stars {
          display: flex;
          gap: 8px;
        }

        .star {
          font-size: 36px;
          background: none;
          border: none;
          cursor: pointer;
          color: #cbd5e1;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
        }

        .star:hover {
          transform: scale(1.1);
        }

        .star.active {
          color: #f59e0b;
        }

        .rating-text {
          margin-top: 12px;
          font-size: 12px;
          color: #64748b;
        }

        .categories {
          margin-bottom: 24px;
        }

        .categories-label {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 12px;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .category-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .category-option:hover {
          border-color: #6366f1;
          background: #f8fafc;
        }

        .category-option.selected {
          border-color: #6366f1;
          background: #eef2ff;
        }

        .category-icon {
          font-size: 18px;
        }

        .category-label {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
        }

        .comment-field {
          margin-bottom: 24px;
        }

        .comment-label {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .comment-count {
          font-size: 11px;
          color: #94a3b8;
          font-weight: normal;
        }

        .comment-input {
          width: 100%;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          transition: all 0.2s;
        }

        .comment-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 13px;
          color: #ef4444;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .feedback-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-submit {
          flex: 2;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 40px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99,102,241,0.3);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-cancel {
          flex: 1;
          padding: 14px;
          background: #f1f5f9;
          border: none;
          border-radius: 40px;
          color: #475569;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel:hover {
          background: #e2e8f0;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 500px) {
          .categories-grid { grid-template-columns: 1fr; }
          .feedback-actions { flex-direction: column; }
        }
      `}</style>

      <div className="feedback-page">
        <div className="feedback-card">
          <div className="feedback-header">
            <div className="feedback-icon">⭐</div>
            <div className="feedback-title">Votre avis compte</div>
            <div className="feedback-sub">Aidez-nous à améliorer AuditPlatform</div>
          </div>

          <div className="feedback-content">
            <div className="project-badge">
              <span>📁</span> {projet}
            </div>

            <div className="stars-container">
              <div className="stars-label">Note globale</div>
              <div className="stars">{renderStars()}</div>
              <div className="rating-text">
                {rating === 1 && "😞 Très insatisfait"}
                {rating === 2 && "😕 Insatisfait"}
                {rating === 3 && "😐 Neutre"}
                {rating === 4 && "😊 Satisfait"}
                {rating === 5 && "🤩 Très satisfait"}
                {rating === 0 && "Cliquez sur une étoile pour noter"}
              </div>
            </div>

            <div className="categories">
              <div className="categories-label">Catégorie</div>
              <div className="categories-grid">
                {categories.map(cat => (
                  <div
                    key={cat.value}
                    className={`category-option ${category === cat.value ? "selected" : ""}`}
                    onClick={() => setCategory(cat.value)}
                  >
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-label">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="comment-field">
              <div className="comment-label">
                Commentaire (optionnel)
                <span className="comment-count">{comment.length}/500</span>
              </div>
              <textarea
                className="comment-input"
                rows={4}
                placeholder="Partagez votre expérience, suggestions d'amélioration, ou ce que vous avez aimé..."
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, 500))}
              />
            </div>

            {erreur && (
              <div className="error">
                <span>⚠️</span> {erreur}
              </div>
            )}

            <div className="feedback-actions">
              <button className="btn-cancel" onClick={() => router.back()}>
                Annuler
              </button>
              <button className="btn-submit" onClick={handleSubmit} disabled={loading || rating === 0}>
                {loading ? <><div className="spinner" /> Envoi...</> : "📤 Envoyer mon avis"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ✅ Export avec Suspense boundary
export default function FeedbackPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <FeedbackContent />
    </Suspense>
  );
}

