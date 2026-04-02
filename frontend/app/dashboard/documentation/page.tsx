"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DocumentationPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  const sections = [
    {
      title: "🚀 Guide de démarrage",
      icon: "🚀",
      content: [
        { title: "Créer un compte", desc: "Inscrivez-vous avec email ou via GitLab OAuth pour accéder à la plateforme." },
        { title: "Connecter un dépôt GitLab", desc: "Ajoutez vos dépôts GitLab avec leur URL, branche et token d'accès." },
        { title: "Lancer votre première analyse", desc: "Cliquez sur 'Nouvelle analyse' et laissez l'IA auditer votre code." },
        { title: "Consulter les résultats", desc: "Visualisez les scores, vulnérabilités et recommandations dans le tableau de bord." },
      ]
    },
    {
      title: "🔍 Analyse du code",
      icon: "🔍",
      content: [
        { title: "Analyse de qualité", desc: "Évalue la complexité, les duplications et la lisibilité du code." },
        { title: "Analyse de sécurité", desc: "Détecte les vulnérabilités OWASP et les failles de sécurité." },
        { title: "Analyse de performance", desc: "Identifie les requêtes inefficaces et les boucles coûteuses." },
        { title: "Score global", desc: "Note synthétique sur 100 combinant qualité, sécurité et performance." },
      ]
    },
    {
      title: "🧪 Génération de tests",
      icon: "🧪",
      content: [
        { title: "Tests unitaires automatiques", desc: "L'IA génère des tests adaptés au langage de votre projet." },
        { title: "Branche dédiée", desc: "Une branche ai/tests/<date> est créée pour isoler les tests." },
        { title: "Merge Request automatique", desc: "Une MR est créée pour soumettre les tests à la revue humaine." },
      ]
    },
    {
      title: "⟁ Merge Requests",
      icon: "⟁",
      content: [
        { title: "MR générées par IA", desc: "Les corrections sont proposées via des MR automatiques." },
        { title: "Validation humaine", desc: "Vous pouvez approuver ou rejeter les MR avant fusion." },
        { title: "Diff ligne par ligne", desc: "Visualisez précisément chaque modification proposée." },
      ]
    },
    {
      title: "⚙️ Pipelines CI/CD",
      icon: "⚙️",
      content: [
        { title: "Pipeline d'analyse LLM", desc: "Se déclenche à chaque push pour auditer le code en continu." },
        { title: "Pipeline de tests", desc: "Mesure la couverture de code à chaque Merge Request." },
        { title: "Pipeline de validation", desc: "Bloque la MR si le score est sous le seuil configuré." },
      ]
    },
    {
      title: "📊 Tableau de bord",
      icon: "📊",
      content: [
        { title: "Statistiques globales", desc: "Projets analysés, analyses totales, score moyen, vulnérabilités." },
        { title: "Évolution des scores", desc: "Graphique montrant la progression dans le temps." },
        { title: "Export PDF", desc: "Générez un rapport de qualité à partager avec votre équipe." },
      ]
    },
    {
      title: "🛠️ Administration",
      icon: "🛠️",
      content: [
        { title: "Gestion des utilisateurs", desc: "Voir, activer/désactiver, supprimer et modifier les rôles." },
        { title: "Supervision globale", desc: "Visualiser tous les dépôts et statistiques de la plateforme." },
        { title: "Configuration LLM", desc: "Choisir entre API externe ou modèle local pour l'IA." },
      ]
    },
    {
      title: "❓ FAQ",
      icon: "❓",
      content: [
        { title: "Quels langages sont supportés ?", desc: "Python, JavaScript, TypeScript, Java, PHP, Ruby, Go et plus." },
        { title: "L'analyse est-elle gratuite ?", desc: "Oui pour la version académique. Contactez-nous pour des besoins spécifiques." },
        { title: "Mes données sont-elles sécurisées ?", desc: "Oui, les tokens sont chiffrés et les analyses sont privées." },
        { title: "Comment configurer le seuil de score ?", desc: "Dans les paramètres d'analyse, définissez un seuil minimal (0-100)." },
      ]
    }
  ];

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f8fafc; }
        
        .docs-container {
          display: flex;
          min-height: 100vh;
        }
        
        /* SIDEBAR */
        .docs-sidebar {
          width: 280px;
          background: white;
          border-right: 1px solid #eef2ff;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 24px 0;
        }
        
        .sidebar-header {
          padding: 0 20px 20px;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 20px;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }
        
        .logo-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
        }
        
        .logo-text {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
        
        .sidebar-nav {
          list-style: none;
          padding: 0 12px;
        }
        
        .sidebar-nav-item {
          margin-bottom: 4px;
        }
        
        .sidebar-nav-link {
          display: block;
          padding: 10px 12px;
          color: #475569;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          border-radius: 10px;
          transition: all 0.2s;
        }
        
        .sidebar-nav-link:hover {
          background: #f8fafc;
          color: #6366f1;
        }
        
        /* MAIN CONTENT */
        .docs-content {
          flex: 1;
          margin-left: 280px;
          padding: 40px 48px;
          max-width: 900px;
        }
        
        .docs-header {
          margin-bottom: 40px;
        }
        
        .docs-title {
          font-size: 36px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 12px;
        }
        
        .docs-subtitle {
          font-size: 16px;
          color: #64748b;
        }
        
        .section {
          margin-bottom: 48px;
        }
        
        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 2px solid #eef2ff;
        }
        
        .section-icon {
          font-size: 28px;
        }
        
        .card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        
        .doc-card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s;
        }
        
        .doc-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-2px);
        }
        
        .doc-card-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 8px;
        }
        
        .doc-card-desc {
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }
        
        .back-home {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #f1f5f9;
          border: none;
          padding: 8px 16px;
          border-radius: 40px;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          margin-bottom: 24px;
        }
        
        @media (max-width: 768px) {
          .docs-sidebar { display: none; }
          .docs-content { margin-left: 0; padding: 24px; }
          .card-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="docs-container">
        {/* SIDEBAR */}
        <aside className="docs-sidebar">
          <div className="sidebar-header">
            <div className="logo" onClick={() => router.push(isLoggedIn ? "/dashboard" : "/")}>
              <div className="logo-icon">A</div>
              <div className="logo-text">AuditPlatform</div>
            </div>
          </div>
          <ul className="sidebar-nav">
            <li className="sidebar-nav-item"><a href="#guide" className="sidebar-nav-link">🚀 Guide de démarrage</a></li>
            <li className="sidebar-nav-item"><a href="#analyse" className="sidebar-nav-link">🔍 Analyse du code</a></li>
            <li className="sidebar-nav-item"><a href="#tests" className="sidebar-nav-link">🧪 Génération de tests</a></li>
            <li className="sidebar-nav-item"><a href="#mr" className="sidebar-nav-link">⟁ Merge Requests</a></li>
            <li className="sidebar-nav-item"><a href="#pipelines" className="sidebar-nav-link">⚙️ Pipelines CI/CD</a></li>
            <li className="sidebar-nav-item"><a href="#dashboard" className="sidebar-nav-link">📊 Tableau de bord</a></li>
            <li className="sidebar-nav-item"><a href="#admin" className="sidebar-nav-link">🛠️ Administration</a></li>
            <li className="sidebar-nav-item"><a href="#faq" className="sidebar-nav-link">❓ FAQ</a></li>
          </ul>
        </aside>

        {/* MAIN CONTENT */}
        <main className="docs-content">
          <button className="back-home" onClick={() => router.push(isLoggedIn ? "/dashboard" : "/")}>
            ← Retour à l'accueil
          </button>
          
          <div className="docs-header">
            <h1 className="docs-title">Documentation</h1>
            <p className="docs-subtitle">Tout ce que vous devez savoir pour utiliser AuditPlatform</p>
          </div>

          {sections.map((section, idx) => (
            <section key={idx} id={section.title.toLowerCase().replace(/ /g, '-').replace(/[^a-z-]/g, '')} className="section">
              <h2 className="section-title">
                <span className="section-icon">{section.icon}</span>
                {section.title}
              </h2>
              <div className="card-grid">
                {section.content.map((item, i) => (
                  <div key={i} className="doc-card">
                    <div className="doc-card-title">{item.title}</div>
                    <div className="doc-card-desc">{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}