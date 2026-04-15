"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  Zap, 
  Code2, 
  GitBranch, 
  Cpu, 
  ArrowRight, 
  LayoutDashboard,
  BookOpen,
  Lock
} from "lucide-react";

// Composant SVG personnalisé pour le logo GitLab pour éviter les erreurs d'importation
const GitLabIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M22.65 14.39L20.21 6.8a.62.62 0 0 0-1.18 0l-2.44 7.59h-9.18l-2.44-7.59a.62.62 0 0 0-1.18 0L1.35 14.39a.84.84 0 0 0 .3.92l9.99 7.26a.5.5 0 0 0 .59 0l9.99-7.26a.84.84 0 0 0 .43-.92z" />
  </svg>
);

export default function LandingPage() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    const token = localStorage.getItem("token");
    if (token) router.push("/dashboard");
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router]);

  const features = [
    {
      title: "Audit LLM Intelligent",
      desc: "Analyse sémantique profonde de votre code par intelligence artificielle pour détecter les erreurs logiques complexes.",
      icon: <Cpu className="w-6 h-6 text-indigo-500" />,
      color: "bg-indigo-50"
    },
    {
      title: "Scan Sécurité OWASP",
      desc: "Détection automatique des vulnérabilités critiques et des failles de sécurité avant qu'elles n'atteignent la production.",
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
      color: "bg-emerald-50"
    },
    {
      title: "Tests Unitaires Auto",
      desc: "Génération automatique de suites de tests complètes pour garantir une couverture maximale de votre logique métier.",
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      color: "bg-amber-50"
    },
    {
      title: "Intégration GitLab Native",
      desc: "Synchronisation bidirectionnelle avec vos dépôts GitLab, gestion des webhooks et des pipelines CI/CD.",
      icon: <GitBranch className="w-6 h-6 text-orange-500" />,
      color: "bg-orange-50"
    },
    {
      title: "Quality Gate Automatisé",
      desc: "Blocage intelligent des Merge Requests si les standards de qualité ou de sécurité ne sont pas respectés.",
      icon: <Lock className="w-6 h-6 text-rose-500" />,
      color: "bg-rose-50"
    },
    {
      title: "Dashboard Analytique",
      desc: "Visualisation en temps réel de la santé technique de vos projets via des indicateurs de performance clés.",
      icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
      color: "bg-blue-50"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-700">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md border-b border-slate-100 py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
              <Code2 className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Audit<span className="text-indigo-600">IA</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Fonctionnalités</a>
            <a href="/documentation" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Documentation</a>
            <div className="h-4 w-px bg-slate-200"></div>
            <button onClick={() => router.push("/login")} className="text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors">Connexion</button>
            <button onClick={() => router.push("/login")} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-600 transition-all shadow-md active:scale-95">
              Démarrer le projet
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-50"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-50 rounded-full blur-[100px] opacity-50"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">PFE 2025 · Plateforme d'Audit IA</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-[1.1]">
            L'Audit de Code Réinventé par <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">l'Intelligence Artificielle</span>
          </h1>
          
          <p className="text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            Automatisez la revue de code, sécurisez vos déploiements et générez des tests unitaires en un clic. La plateforme ultime pour l'excellence technique.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button 
              onClick={() => router.push("/login")}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 group"
            >
              Commencer l'audit
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => router.push("/documentation")}
              className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Voir la Doc
            </button>
          </div>

          {/* Dashboard Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] blur opacity-20"></div>
            <div className="relative bg-slate-900 rounded-[1.8rem] p-2 shadow-2xl overflow-hidden border border-slate-800">
              <div className="bg-slate-800/50 rounded-t-xl p-3 flex items-center gap-2 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                <div className="mx-auto bg-slate-700/50 px-4 py-1 rounded-md text-[10px] text-slate-400 font-mono">
                  audit-platform.ia/dashboard
                </div>
              </div>
              <div className="aspect-video bg-slate-900 flex items-center justify-center p-8">
                <div className="grid grid-cols-3 gap-4 w-full h-full">
                  <div className="col-span-2 bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 flex flex-col gap-3">
                    <div className="h-4 w-1/3 bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-32 w-full bg-slate-700/30 rounded-lg"></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-20 bg-slate-700/30 rounded-lg"></div>
                      <div className="h-20 bg-slate-700/30 rounded-lg"></div>
                    </div>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 flex flex-col gap-4">
                    <div className="h-4 w-1/2 bg-slate-700 rounded animate-pulse"></div>
                    <div className="space-y-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-8 w-full bg-slate-700/30 rounded flex items-center px-2 gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                          <div className="h-2 w-full bg-slate-600 rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-4">Fonctionnalités Clés</h2>
            <p className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">Une suite d'outils complète pour votre cycle de développement</p>
            <p className="text-lg text-slate-600">Notre plateforme combine les meilleures pratiques de DevOps avec la puissance des modèles de langage à grande échelle.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50 transition-all group">
                <div className={`${f.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { label: "Précision IA", val: "99.9%" },
              { label: "Temps de Revue", val: "-65%" },
              { label: "Vulnérabilités", val: "0" },
              { label: "Projets Actifs", val: "500+" }
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-black text-slate-900 mb-2">{s.val}</div>
                <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-indigo-600 rounded-[3rem] p-12 lg:p-20 text-center relative overflow-hidden shadow-2xl shadow-indigo-200">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8 relative z-10">Prêt à sécuriser votre code ?</h2>
            <p className="text-indigo-100 text-lg mb-12 max-w-xl mx-auto relative z-10">Rejoignez les développeurs qui utilisent l'IA pour construire des applications plus robustes et plus sûres.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button 
                onClick={() => router.push("/login")}
                className="w-full sm:w-auto bg-white text-indigo-600 px-10 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-lg active:scale-95"
              >
                Créer un compte
              </button>
              <button 
                onClick={() => router.push("/documentation")}
                className="w-full sm:w-auto bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-400 transition-all flex items-center justify-center gap-2"
              >
                <GitLabIcon className="w-5 h-5" />
                Dépôt GitLab
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Code2 className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">AuditIA</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">Politique de confidentialité</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Conditions d'utilisation</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
          <div className="text-sm text-slate-400 font-medium">
            © 2025 PFE - Plateforme d'Audit IA. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
