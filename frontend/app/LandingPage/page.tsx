"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          background: #f8fafc;
        }
        
        .landing {
          min-height: 100vh;
        }
        
        /* NAVBAR */
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #eef2ff;
          padding: 16px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 1000;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          color: white;
        }
        
        .logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        
        .logo-sub {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        
        .nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        
        .nav-link {
          text-decoration: none;
          color: #475569;
          font-weight: 500;
          font-size: 14px;
          transition: color 0.2s;
        }
        
        .nav-link:hover {
          color: #6366f1;
        }
        
        .btn-outline {
          padding: 8px 20px;
          background: transparent;
          border: 1.5px solid #e2e8f0;
          border-radius: 40px;
          font-weight: 600;
          font-size: 14px;
          color: #1e293b;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-outline:hover {
          border-color: #6366f1;
          color: #6366f1;
        }
        
        .btn-primary {
          padding: 8px 24px;
          background: #0f172a;
          border: none;
          border-radius: 40px;
          font-weight: 600;
          font-size: 14px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary:hover {
          background: #6366f1;
          transform: translateY(-1px);
        }
        
        .btn-large {
          padding: 14px 32px;
          font-size: 16px;
        }
        
        /* HERO SECTION */
        .hero {
          padding: 120px 32px 80px;
          text-align: center;
          background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
        }
        
        .hero-badge {
          display: inline-block;
          padding: 6px 14px;
          background: #eef2ff;
          border-radius: 40px;
          font-size: 13px;
          font-weight: 500;
          color: #6366f1;
          margin-bottom: 24px;
        }
        
        .hero-title {
          font-size: 56px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin-bottom: 24px;
          line-height: 1.2;
        }
        
        .hero-gradient {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        
        .hero-subtitle {
          font-size: 18px;
          color: #475569;
          max-width: 600px;
          margin: 0 auto 32px;
          line-height: 1.6;
        }
        
        .hero-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 60px;
        }
        
        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 48px;
          margin-top: 40px;
        }
        
        .stat {
          text-align: center;
        }
        
        .stat-number {
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
        }
        
        .stat-label {
          font-size: 13px;
          color: #64748b;
        }
        
        /* FEATURES */
        .features {
          padding: 80px 32px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .section-title {
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 16px;
        }
        
        .section-subtitle {
          text-align: center;
          font-size: 16px;
          color: #64748b;
          margin-bottom: 48px;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }
        
        .feature-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 24px;
          padding: 32px;
          transition: all 0.3s;
        }
        
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: #cbd5e1;
          box-shadow: 0 20px 25px -12px rgba(0, 0, 0, 0.1);
        }
        
        .feature-icon {
          width: 56px;
          height: 56px;
          background: #eef2ff;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-bottom: 20px;
        }
        
        .feature-title {
          font-size: 20px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 12px;
        }
        
        .feature-desc {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }
        
        /* CTA */
        .cta {
          background: #0f172a;
          margin: 0 32px 80px;
          border-radius: 32px;
          padding: 64px;
          text-align: center;
        }
        
        .cta-title {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin-bottom: 16px;
        }
        
        .cta-subtitle {
          font-size: 16px;
          color: #94a3b8;
          margin-bottom: 32px;
        }
        
        .cta-button {
          background: #6366f1;
          padding: 14px 32px;
          border: none;
          border-radius: 40px;
          font-weight: 600;
          font-size: 16px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .cta-button:hover {
          background: #8b5cf6;
          transform: translateY(-2px);
        }
        
        /* FOOTER */
        .footer {
          border-top: 1px solid #eef2ff;
          padding: 48px 32px;
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
        }
        
        @media (max-width: 768px) {
          .hero-title { font-size: 36px; }
          .features-grid { grid-template-columns: 1fr; }
          .hero-stats { flex-direction: column; gap: 16px; }
          .hero-buttons { flex-direction: column; align-items: center; }
          .navbar { flex-direction: column; gap: 16px; }
        }
      `}</style>

      <div className="landing">
        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-icon">A</div>
            <div>
              <div className="logo-text">AuditPlatform</div>
              <div className="logo-sub">GitLab · IA · PFE 2025</div>
            </div>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Fonctionnalités</a>
            <a href="/documentation" className="nav-link">Documentation</a>
            <a href="/help" className="nav-link">Aide</a>
            <button className="btn-outline" onClick={() => router.push("/login")}>Connexion</button>
            <button className="btn-primary" onClick={() => router.push("/login")}>S'inscrire</button>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-badge">✨ Audit intelligent par IA</div>
          <h1 className="hero-title">
            Analysez votre code<br />
            avec <span className="hero-gradient">l'intelligence artificielle</span>
          </h1>
          <p className="hero-subtitle">
            Détectez les vulnérabilités, améliorez la qualité et générez des tests automatiquement.
            Intégration transparente avec GitLab.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary btn-large" onClick={() => router.push("/login")}>Commencer gratuitement</button>
            <button className="btn-outline btn-large" onClick={() => router.push("/documentation")}>En savoir plus</button>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-number">99.9%</div><div className="stat-label">Précision d'analyse</div></div>
            <div className="stat"><div className="stat-number">-60%</div><div className="stat-label">Temps de revue</div></div>
            <div className="stat"><div className="stat-number">+85%</div><div className="stat-label">Couverture de tests</div></div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="features">
          <h2 className="section-title">Une plateforme complète</h2>
          <p className="section-subtitle">Tout ce dont vous avez besoin pour auditer votre code</p>
          <div className="features-grid">
            <div className="feature-card"><div className="feature-icon">🔍</div><div className="feature-title">Analyse IA avancée</div><div className="feature-desc">Détection de vulnérabilités, analyse de qualité et performances avec LLM.</div></div>
            <div className="feature-card"><div className="feature-icon">🧪</div><div className="feature-title">Génération automatique de tests</div><div className="feature-desc">Tests unitaires générés par IA avec création automatique de branches et MR.</div></div>
            <div className="feature-card"><div className="feature-icon">⟁</div><div className="feature-title">Merge Requests intelligentes</div><div className="feature-desc">MR automatiques avec suggestions de correction intégrées.</div></div>
            <div className="feature-card"><div className="feature-icon">⚙️</div><div className="feature-title">Pipelines CI/CD auto-configurés</div><div className="feature-desc">Fichiers .gitlab-ci.yml générés automatiquement pour analyse, tests et validation.</div></div>
            <div className="feature-card"><div className="feature-icon">📊</div><div className="feature-title">Tableau de bord complet</div><div className="feature-desc">Suivez l'évolution de vos scores et visualisez les vulnérabilités.</div></div>
            <div className="feature-card"><div className="feature-icon">🔗</div><div className="feature-title">Intégration GitLab native</div><div className="feature-desc">Connexion OAuth, synchronisation des dépôts et création automatique d'issues.</div></div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <h2 className="cta-title">Prêt à améliorer la qualité de votre code ?</h2>
          <p className="cta-subtitle">Rejoignez des centaines de développeurs qui utilisent AuditPlatform</p>
          <button className="cta-button" onClick={() => router.push("/login")}>Commencer maintenant →</button>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <p>© 2025 AuditPlatform - Plateforme Intelligente d'Audit GitLab (LLM) - PFE</p>
          <p style={{ marginTop: 12 }}>
            <a href="/documentation" style={{ color: "#64748b", margin: "0 12px", textDecoration: "none" }}>Documentation</a> | 
            <a href="/help" style={{ color: "#64748b", margin: "0 12px", textDecoration: "none" }}>Aide</a> | 
            <a href="#" style={{ color: "#64748b", margin: "0 12px", textDecoration: "none" }}>Contact</a>
          </p>
        </footer>
      </div>
    </>
  );
}