"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Book, 
  Rocket, 
  Search, 
  Shield, 
  Zap, 
  GitPullRequest, 
  Settings, 
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Terminal,
  Code2,
  CheckCircle2
} from "lucide-react";

export default function DocumentationPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("guide");

  const sections = [
    {
      id: "guide",
      title: "Guide de démarrage",
      icon: <Rocket className="w-5 h-5" />,
      content: [
        { title: "Configuration initiale", desc: "Apprenez à configurer votre compte et à lier votre premier dépôt GitLab en quelques minutes." },
        { title: "Authentification OAuth", desc: "Utilisez vos identifiants GitLab pour une connexion sécurisée et rapide." },
        { title: "Structure du projet", desc: "Comprendre comment organiser vos fichiers pour une analyse optimale par l'IA." }
      ]
    },
    {
      id: "analyse",
      title: "Analyse du code",
      icon: <Search className="w-5 h-5" />,
      content: [
        { title: "Audit Qualité LLM", desc: "L'IA analyse la lisibilité, la maintenabilité et la complexité cyclomatique de votre code." },
        { title: "Scan de Sécurité", desc: "Détection des failles OWASP, injections SQL et vulnérabilités XSS en temps réel." },
        { title: "Optimisation Performance", desc: "Identification des goulots d'étranglement et suggestions d'optimisation algorithmique." }
      ]
    },
    {
      id: "tests",
      title: "Génération de tests",
      icon: <Zap className="w-5 h-5" />,
      content: [
        { title: "Tests Unitaires Auto", desc: "Génération de suites de tests complètes (Pytest, Jest) basées sur votre logique métier." },
        { title: "Couverture de code", desc: "Mesure automatique de la couverture après chaque génération de tests." },
        { title: "Mocking Intelligent", desc: "L'IA crée automatiquement des mocks pour vos dépendances externes." }
      ]
    },
    {
      id: "pipelines",
      title: "Pipelines CI/CD",
      icon: <Terminal className="w-5 h-5" />,
      content: [
        { title: "Intégration GitLab CI", desc: "Comment configurer votre fichier .gitlab-ci.yml pour automatiser les audits." },
        { title: "Quality Gates", desc: "Définition de seuils critiques pour bloquer les déploiements non conformes." },
        { title: "Webhooks", desc: "Configuration des notifications en temps réel sur l'état de vos pipelines." }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 bg-slate-50 border-r border-slate-200 p-8 lg:fixed lg:h-full overflow-y-auto">
        <div className="flex items-center gap-2 mb-12 cursor-pointer" onClick={() => router.push("/")}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <Code2 className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">Audit<span className="text-indigo-600">IA</span></span>
        </div>

        <nav className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-3">Documentation</p>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeSection === s.id 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {s.icon}
                {s.title}
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeSection === s.id ? "rotate-90" : ""}`} />
            </button>
          ))}
        </nav>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-80 p-8 lg:p-20 max-w-5xl">
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <Book className="w-3 h-3" />
            Documentation Officielle
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-6 tracking-tight">
            {sections.find(s => s.id === activeSection)?.title}
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Découvrez comment exploiter toute la puissance de l'intelligence artificielle pour auditer, sécuriser et tester vos applications GitLab.
          </p>
        </div>

        <div className="grid gap-8">
          {sections.find(s => s.id === activeSection)?.content.map((item, i) => (
            <div key={i} className="group p-8 rounded-3xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6">
                {item.desc}
              </p>
              <div className="flex items-center gap-4">
                <button className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all">
                  En savoir plus <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Code Example Section */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Exemple de configuration CI/CD
          </h2>
          <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl overflow-hidden border border-slate-800">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              </div>
              <span className="text-xs text-slate-500 font-mono ml-4">.gitlab-ci.yml</span>
            </div>
            <pre className="text-sm font-mono text-indigo-300 overflow-x-auto">
              <code>{`stages:
  - analyze
  - test

llm-audit:
  stage: analyze
  image: python:3.11
  script:
    - python backend/run_audit.py
  artifacts:
    paths:
      - audit_report.json

unit-tests:
  stage: test
  script:
    - pytest --cov=backend/app`}</code>
            </pre>
          </div>
        </div>

        {/* Footer Help */}
        <div className="mt-24 p-12 rounded-[2.5rem] bg-slate-900 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <HelpCircle className="w-12 h-12 text-indigo-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Besoin d'aide supplémentaire ?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">Notre équipe de support et la communauté sont là pour vous accompagner dans votre intégration.</p>
          <button className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold hover:bg-indigo-50 transition-all active:scale-95">
            Contacter le support
          </button>
        </div>
      </main>
    </div>
  );
}


