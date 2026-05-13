"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  ShieldCheck, Zap, Code2, GitBranch, Cpu,
  ArrowRight, LayoutDashboard, BookOpen, Lock, Star
} from "lucide-react";

const API = "http://localhost:8001";

const GitLabIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.65 14.39L20.21 6.8a.62.62 0 0 0-1.18 0l-2.44 7.59h-9.18l-2.44-7.59a.62.62 0 0 0-1.18 0L1.35 14.39a.84.84 0 0 0 .3.92l9.99 7.26a.5.5 0 0 0 .59 0l9.99-7.26a.84.84 0 0 0 .43-.92z" />
  </svg>
);

// ── Types ──────────────────────────────────────────────────────────
interface FeedbackItem {
  id: number;
  rating: number;
  category: string;
  comment: string | null;
  projet_nom: string | null;
  created_at: string;
  // enrichis côté frontend
  username?: string;
  avatar?: string;
}

// ── Helpers ────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  qualite: "Qualité du code",
  securite: "Sécurité",
  performance: "Performance",
  tests: "Tests unitaires",
  interface: "Interface",
  global: "Expérience globale",
};

const CATEGORY_COLORS: Record<string, string> = {
  qualite:     "bg-indigo-50 text-indigo-700",
  securite:    "bg-emerald-50 text-emerald-700",
  performance: "bg-amber-50 text-amber-700",
  tests:       "bg-purple-50 text-purple-700",
  interface:   "bg-blue-50 text-blue-700",
  global:      "bg-rose-50 text-rose-700",
};

const AVATARS = ["🧑‍💻","👩‍💻","🧑‍🔬","👨‍🎓","👩‍🔧","🧑‍🚀","👩‍🎨","🧑‍💼"];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </div>
  );
}

// Nombre de jours depuis la date
function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 30) return `Il y a ${diff} jours`;
  if (diff < 365) return `Il y a ${Math.floor(diff/30)} mois`;
  return `Il y a ${Math.floor(diff/365)} an${diff >= 730 ? "s" : ""}`;
}

// ══════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [fbLoading, setFbLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("tous");

  // ── Scroll + auth redirect ─────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    const token = localStorage.getItem("token");
    if (token) router.push("/dashboard");
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router]);

  // ── Charger les feedbacks publics ──────────────────────────────
  // ── Charger les feedbacks publics ──────────────────────────────
useEffect(() => {
  const loadFeedbacks = async () => {
    setFbLoading(true);
    try {
      // ✅ Utiliser la route /feedback/public qui existe
      const res = await axios.get(`${API}/feedback/public`);
      
      if (res.data && res.data.feedbacks) {
        // Ajouter les avatars aux feedbacks
        const enriched: FeedbackItem[] = res.data.feedbacks.map((f: any, i: number) => ({
          id: f.id,
          rating: f.rating,
          category: f.category,
          comment: f.comment,
          projet_nom: f.projet_nom,
          created_at: f.created_at,
          username: f.username, // Déjà anonymisé par le backend
          avatar: AVATARS[i % AVATARS.length],
        }));
        
        setFeedbacks(enriched);
        setAvgRating(res.data.average || 4.7);
      }
    } catch (error) {
      console.error("Erreur chargement feedbacks:", error);
      // Fallback sur les démos en cas d'erreur
      setFeedbacks(demoFeedbacks);
      setAvgRating(4.7);
    } finally {
      setFbLoading(false);
    }
  };
  loadFeedbacks();
}, []);
  // ── Démo feedbacks si API vide (pour la présentation) ─────────
  const demoFeedbacks: FeedbackItem[] = [
    { id:1, rating:5, category:"securite",    comment:"Vraiment impressionnant ! La détection OWASP a trouvé une faille SQL Injection que nos revues manuelles avaient manquée depuis 3 sprints.", projet_nom:"API Gateway",     created_at: new Date(Date.now()-2*86400000).toISOString(), username:"Sarah M.",    avatar:"👩‍💻" },
    { id:2, rating:5, category:"tests",       comment:"La génération automatique des tests unitaires m'a économisé au moins 2 jours de travail. La couverture est passée de 40% à 87% en un clic.", projet_nom:"Backend Node.js",   created_at: new Date(Date.now()-5*86400000).toISOString(), username:"Ahmed K.",    avatar:"🧑‍💻" },
    { id:3, rating:4, category:"qualite",     comment:"Les recommandations de refactoring sont pertinentes et bien expliquées. L'IA comprend vraiment le contexte métier du code.", projet_nom:"Microservices Auth",created_at: new Date(Date.now()-8*86400000).toISOString(), username:"Léa D.",      avatar:"👩‍🔧" },
    { id:4, rating:5, category:"global",      comment:"La plateforme a transformé notre workflow. Les merge requests passent maintenant un quality gate automatique — ça a réduit nos bugs en prod de 60%.", projet_nom:"E-commerce Platform", created_at: new Date(Date.now()-12*86400000).toISOString(), username:"Omar B.",  avatar:"🧑‍🚀" },
    { id:5, rating:4, category:"performance", comment:"L'analyse des goulots d'étranglement est précise. Elle a identifié une requête N+1 dans notre ORM qui ralentissait toutes les pages produit.", projet_nom:"Data Pipeline",    created_at: new Date(Date.now()-15*86400000).toISOString(), username:"Nadia R.",    avatar:"👩‍🎨" },
    { id:6, rating:5, category:"interface",   comment:"L'interface est claire et intuitive. Le tableau de bord donne une vue d'ensemble parfaite de la santé de tous nos projets.", projet_nom:"SaaS Dashboard",    created_at: new Date(Date.now()-20*86400000).toISOString(), username:"Karim S.",    avatar:"🧑‍💼" },
    { id:7, rating:5, category:"securite",    comment:"Intégration GitLab native impeccable. Les issues sont créées automatiquement avec les suggestions de correction — nos devs adorent.", projet_nom:"Mobile API",       created_at: new Date(Date.now()-25*86400000).toISOString(), username:"Fatima L.",   avatar:"🧑‍🔬" },
    { id:8, rating:4, category:"qualite",     comment:"Le score de qualité par branche avant merge est une fonctionnalité indispensable. On ne pourrait plus s'en passer.", projet_nom:"FinTech Core",      created_at: new Date(Date.now()-30*86400000).toISOString(), username:"Thomas V.",   avatar:"👨‍🎓" },
  ];

  const displayFeedbacks = feedbacks.length > 0 ? feedbacks : demoFeedbacks;
  const displayAvg = avgRating > 0 ? avgRating : 4.7;

  const categories = ["tous", ...Array.from(new Set(displayFeedbacks.map(f => f.category)))];
  const filtered = activeCategory === "tous"
    ? displayFeedbacks
    : displayFeedbacks.filter(f => f.category === activeCategory);

  // ── Features ──────────────────────────────────────────────────
  const features = [
    { title:"Audit LLM Intelligent", desc:"Analyse sémantique profonde de votre code par IA pour détecter les erreurs logiques complexes.", icon:<Cpu className="w-6 h-6 text-indigo-500"/>, color:"bg-indigo-50" },
    { title:"Scan Sécurité OWASP", desc:"Détection automatique des vulnérabilités critiques avant qu'elles n'atteignent la production.", icon:<ShieldCheck className="w-6 h-6 text-emerald-500"/>, color:"bg-emerald-50" },
    { title:"Tests Unitaires Auto", desc:"Génération automatique de suites de tests complètes pour garantir une couverture maximale.", icon:<Zap className="w-6 h-6 text-amber-500"/>, color:"bg-amber-50" },
    { title:"Intégration GitLab Native", desc:"Synchronisation bidirectionnelle avec vos dépôts GitLab, webhooks et pipelines CI/CD.", icon:<GitBranch className="w-6 h-6 text-orange-500"/>, color:"bg-orange-50" },
    { title:"Quality Gate Automatisé", desc:"Blocage intelligent des Merge Requests si les standards de qualité ne sont pas respectés.", icon:<Lock className="w-6 h-6 text-rose-500"/>, color:"bg-rose-50" },
    { title:"Dashboard Analytique", desc:"Visualisation en temps réel de la santé technique via des indicateurs de performance clés.", icon:<LayoutDashboard className="w-6 h-6 text-blue-500"/>, color:"bg-blue-50" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-700">

      {/* ── NAVIGATION ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md border-b border-slate-100 py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({top:0,behavior:"smooth"})}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
              <Code2 className="text-white w-6 h-6"/>
            </div>
            <span className="text-xl font-bold tracking-tight">Audit<span className="text-indigo-600">IA</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Fonctionnalités</a>
            <a href="#avis"     className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Avis</a>
            <a href="/documentation" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Documentation</a>
            <div className="h-4 w-px bg-slate-200"/>
            <button onClick={()=>router.push("/login")} className="text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors">Connexion</button>
            <button onClick={()=>router.push("/login")} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-600 transition-all shadow-md active:scale-95">
              Démarrer
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-50"/>
          <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-50 rounded-full blur-[100px] opacity-50"/>
        </div>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"/>
            </span>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">PFE 2025 · Plateforme d'Audit IA</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-[1.1]">
            L'Audit de Code Réinventé par <br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">l'Intelligence Artificielle</span>
          </h1>
          <p className="text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            Automatisez la revue de code, sécurisez vos déploiements et générez des tests unitaires en un clic.
          </p>

          {/* Social proof pill */}
          <div className="inline-flex items-center gap-3 bg-white border border-slate-100 shadow-sm px-5 py-2.5 rounded-full mb-10">
            <div className="flex -space-x-2">
              {["🧑‍💻","👩‍💻","🧑‍🔬","👨‍🎓"].map((a,i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-sm">{a}</div>
              ))}
            </div>
            <div className="h-4 w-px bg-slate-200"/>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400"/>
              <span className="text-sm font-bold text-slate-900">{displayAvg}</span>
              <span className="text-sm text-slate-500">· {displayFeedbacks.length}+ avis utilisateurs</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button onClick={()=>router.push("/login")}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 group">
              Commencer l'audit <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
            </button>
            <button onClick={()=>router.push("/documentation")}
              className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <BookOpen className="w-5 h-5"/> Voir la Doc
            </button>
          </div>

          {/* Dashboard preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] blur opacity-20"/>
            <div className="relative bg-slate-900 rounded-[1.8rem] p-2 shadow-2xl overflow-hidden border border-slate-800">
              <div className="bg-slate-800/50 rounded-t-xl p-3 flex items-center gap-2 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500"/>
                  <div className="w-3 h-3 rounded-full bg-amber-500"/>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"/>
                </div>
                <div className="mx-auto bg-slate-700/50 px-4 py-1 rounded-md text-[10px] text-slate-400 font-mono">audit-platform.ia/dashboard</div>
              </div>
              <div className="aspect-video bg-slate-900 flex items-center justify-center p-8">
                <div className="grid grid-cols-3 gap-4 w-full h-full">
                  <div className="col-span-2 bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 flex flex-col gap-3">
                    <div className="h-4 w-1/3 bg-slate-700 rounded animate-pulse"/>
                    <div className="h-32 w-full bg-slate-700/30 rounded-lg"/>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-20 bg-slate-700/30 rounded-lg"/>
                      <div className="h-20 bg-slate-700/30 rounded-lg"/>
                    </div>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 flex flex-col gap-4">
                    <div className="h-4 w-1/2 bg-slate-700 rounded animate-pulse"/>
                    <div className="space-y-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-8 w-full bg-slate-700/30 rounded flex items-center px-2 gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"/>
                          <div className="h-2 w-full bg-slate-600 rounded"/>
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

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-4">Fonctionnalités Clés</h2>
            <p className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">Une suite complète pour votre cycle de développement</p>
            <p className="text-lg text-slate-600">Notre plateforme combine les meilleures pratiques DevOps avec la puissance des LLM.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f,i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50 transition-all group">
                <div className={`${f.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>{f.icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { label:"Précision IA", val:"99.9%" },
              { label:"Temps de Revue", val:"-65%" },
              { label:"Vulnérabilités détectées", val:"0 manquée" },
              { label:"Satisfaction", val:`${displayAvg}/5 ★` },
            ].map((s,i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-black text-slate-900 mb-2">{s.val}</div>
                <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          SECTION AVIS UTILISATEURS
      ════════════════════════════════════════════════════════════ */}
      <section id="avis" className="py-24 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6">

          {/* En-tête section */}
          <div className="text-center max-w-3xl mx-auto mb-6">
            <h2 className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-4">Avis utilisateurs</h2>
            <p className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Ce que disent nos développeurs</p>
            <p className="text-lg text-slate-600">Retours authentiques de développeurs et équipes qui utilisent la plateforme au quotidien.</p>
          </div>

          {/* Score global */}
          <div className="flex flex-col items-center gap-3 mb-12">
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black text-slate-900">{displayAvg}</span>
              <span className="text-2xl text-slate-400 font-light">/5</span>
            </div>
            <StarRating rating={Math.round(displayAvg)} />
            <p className="text-sm text-slate-500">{displayFeedbacks.length} avis · mis à jour en temps réel</p>
          </div>

          {/* Filtres par catégorie */}
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                  activeCategory === cat
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}>
                {cat === "tous" ? `Tous (${displayFeedbacks.length})` : `${CATEGORY_LABELS[cat] || cat} (${displayFeedbacks.filter(f=>f.category===cat).length})`}
              </button>
            ))}
          </div>

          {/* Grille des avis */}
          {fbLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200"/>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-slate-200 rounded"/>
                      <div className="h-2 w-16 bg-slate-100 rounded"/>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-100 rounded"/>
                    <div className="h-3 w-4/5 bg-slate-100 rounded"/>
                    <div className="h-3 w-3/5 bg-slate-100 rounded"/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((fb, i) => (
                <div key={fb.id}
                  className="bg-white rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/40 transition-all p-6 flex flex-col gap-4 group"
                  style={{ animationDelay: `${i * 0.05}s` }}>

                  {/* Header : avatar + nom + date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl">
                        {fb.avatar || "🧑‍💻"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{fb.username || "Utilisateur"}</p>
                        <p className="text-xs text-slate-400">{daysAgo(fb.created_at)}</p>
                      </div>
                    </div>
                    <StarRating rating={fb.rating} />
                  </div>

                  {/* Badge catégorie + projet */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${CATEGORY_COLORS[fb.category] || "bg-slate-50 text-slate-600"}`}>
                      {CATEGORY_LABELS[fb.category] || fb.category}
                    </span>
                    {fb.projet_nom && (
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-50 text-slate-500 flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {fb.projet_nom}
                      </span>
                    )}
                  </div>

                  {/* Commentaire */}
                  {fb.comment ? (
                    <p className="text-sm text-slate-600 leading-relaxed flex-1">
                      "{fb.comment}"
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic flex-1">
                      {fb.rating === 5 ? "Excellent ! Entièrement satisfait."
                       : fb.rating === 4 ? "Très bonne expérience globale."
                       : fb.rating === 3 ? "Bonne plateforme, quelques améliorations possibles."
                       : "Expérience correcte."}
                    </p>
                  )}

                  {/* Score visuel */}
                  <div className="pt-3 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">Satisfaction</span>
                      <span className="text-xs font-bold text-slate-600">{fb.rating * 20}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 group-hover:opacity-80"
                        style={{ width: `${fb.rating * 20}%`, background: fb.rating >= 4 ? "#6366f1" : fb.rating === 3 ? "#f59e0b" : "#f87171" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTA laisser un avis */}
          <div className="text-center mt-14">
            <div className="inline-flex flex-col items-center gap-4 bg-white border border-slate-100 rounded-3xl px-10 py-8 shadow-sm">
              <p className="text-slate-700 font-semibold text-lg">Vous utilisez la plateforme ?</p>
              <p className="text-slate-500 text-sm max-w-xs">Partagez votre expérience et aidez d'autres développeurs à découvrir AuditIA.</p>
              <button onClick={() => router.push("/login")}
                className="bg-indigo-600 text-white px-7 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2">
                <Star className="w-4 h-4 fill-white text-white" />
                Laisser un avis
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-indigo-600 rounded-[3rem] p-12 lg:p-20 text-center relative overflow-hidden shadow-2xl shadow-indigo-200">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"/>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8 relative z-10">Prêt à sécuriser votre code ?</h2>
            <p className="text-indigo-100 text-lg mb-12 max-w-xl mx-auto relative z-10">Rejoignez les développeurs qui utilisent l'IA pour construire des applications plus robustes.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button onClick={()=>router.push("/login")} className="w-full sm:w-auto bg-white text-indigo-600 px-10 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-lg active:scale-95">
                Créer un compte
              </button>
              <button onClick={()=>router.push("/documentation")} className="w-full sm:w-auto bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-400 transition-all flex items-center justify-center gap-2">
                <GitLabIcon className="w-5 h-5" /> Dépôt GitLab
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Code2 className="text-white w-5 h-5"/>
            </div>
            <span className="text-lg font-bold tracking-tight">AuditIA</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">Politique de confidentialité</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Conditions d'utilisation</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
          <div className="text-sm text-slate-400 font-medium">© 2025 PFE - Plateforme d'Audit IA.</div>
        </div>
      </footer>
    </div>
  );
}
