"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8000";

interface UserData {
  id: number; email: string; username: string;
  role: string; is_active: boolean; created_at: string | null;
}
interface FullStats {
  depots_analyse: number; depots_comparaison: number;
  analyses_branche: number; analyses_diff: number;
  tests: number; issues: number; recommandations: number; exports: number;
  mr_tests: number; mr_diff: number;
  avg_qualite: number; avg_securite: number; avg_performance: number;
  merge_autorise: number; merge_bloque: number; aucun_changement: number;
}
const EMPTY: FullStats = {
  depots_analyse:0, depots_comparaison:0, analyses_branche:0, analyses_diff:0,
  tests:0, issues:0, recommandations:0, exports:0, mr_tests:0, mr_diff:0,
  avg_qualite:0, avg_securite:0, avg_performance:0,
  merge_autorise:0, merge_bloque:0, aucun_changement:0,
};

export default function ProfilePage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const D = {
    bg: theme.bg, card: theme.bgSecondary, border: theme.border,
    text: theme.text, muted: theme.textMuted, faint: theme.textFaint,
    inputBg: isDark?"#0f1117":"white", statBg: isDark?"#0f1117":"#f8fafc",
    infoBg: isDark?"#0f1117":"#f8fafc", btnSec: isDark?"#1e2538":"#f1f5f9",
    btnPrimary: isDark?"#6366f1":"#0f172a", selectedBg: isDark?"rgba(99,102,241,0.15)":"#eef2ff",
    modalBg: isDark?"#141921":"white", dangerBg: isDark?"rgba(239,68,68,0.12)":"#fef2f2",
    successBg: isDark?"rgba(16,185,129,0.12)":"#ecfdf5",
  };

  const [user,         setUser]         = useState<UserData|null>(null);
  const [stats,        setStats]        = useState<FullStats>(EMPTY);
  const [loading,      setLoading]      = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editOpen,  setEditOpen]  = useState(false);
  const [editForm,  setEditForm]  = useState({ username:"", email:"" });
  const [editLoad,  setEditLoad]  = useState(false);
  const [editError, setEditError] = useState<string|null>(null);
  const [editOk,    setEditOk]    = useState(false);
  const [pwdOpen,  setPwdOpen]  = useState(false);
  const [pwdForm,  setPwdForm]  = useState({ otp:"", password:"", confirm:"" });
  const [pwdLoad,  setPwdLoad]  = useState(false);
  const [pwdError, setPwdError] = useState<string|null>(null);
  const [pwdOk,    setPwdOk]    = useState(false);
  const [otpSent,  setOtpSent]  = useState(false);
  const [otpLoad,  setOtpLoad]  = useState(false);

  const H = () => {
    const t = localStorage.getItem("token");
    return { Authorization: t ? `Bearer ${t}` : "" };
  };

  useEffect(() => {
    const load = async () => {
      if (!localStorage.getItem("token")) { router.push("/login"); return; }
      try {
        const res = await axios.get(`${API}/auth/me`, { headers: H() });
        const u: UserData = res.data;
        if (!u.username || u.username === u.email) u.username = u.email.split("@")[0];
        setUser(u);
        setEditForm({ username: u.username, email: u.email });
        localStorage.setItem("user_id", String(u.id));
        loadStats(u.id);
      } catch (e: any) {
        if (e?.response?.status === 401) { localStorage.removeItem("token"); router.push("/login"); }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const loadStats = async (userId: number) => {
    setStatsLoading(true);
    const s: FullStats = { ...EMPTY };
    const [r0, r1, r3, r4, r5, r6, r7, r8] = await Promise.allSettled([
      axios.get(`${API}/analyses/depots-user/${userId}`, { headers: H() }),     // 0 depots_analyse
      axios.get(`${API}/depots/user/${userId}`, { headers: H() }),               // 1 depots_comparaison
      axios.get(`${API}/analyses-diff/stats/summary`, { headers: H() }),         // 3 diff stats
      axios.get(`${API}/tests/`, { headers: H() }),                              // 4 tests
      axios.get(`${API}/issues/`, { headers: H() }),                             // 5 issues
      axios.get(`${API}/recommandations/`, { headers: H() }),                    // 6 recommandations
      axios.get(`${API}/exports/`, { headers: H() }),                            // 7 exports
      axios.get(`${API}/merge-requests/`, { headers: H() }),                     // 8 mr tests
    ]);

    // DepotAnalyse → analyses branche
    if (r0.status === "fulfilled") {
      const depots = r0.value.data;
      s.depots_analyse = depots.length;
      const ars = await Promise.allSettled(
        depots.map((d: any) => axios.get(`${API}/analyses/depot/${d.id}`, { headers: H() }))
      );
      ars.forEach(r => { if (r.status === "fulfilled") s.analyses_branche += r.value.data.length; });
    }

    // Depot → comparaisons → analyses diff + MR diff
    if (r1.status === "fulfilled") {
      const depots = r1.value.data;
      s.depots_comparaison = depots.length;
      const [mrDiffRes, compRes] = await Promise.allSettled([
        Promise.allSettled(depots.map((d: any) => axios.get(`${API}/merge-requests-diff/depot/${d.id}`, { headers: H() }))),
        Promise.allSettled(depots.map((d: any) => axios.get(`${API}/comparaisons/depot/${d.id}`, { headers: H() }))),
      ]);
      if (mrDiffRes.status === "fulfilled") {
        mrDiffRes.value.forEach((r: any) => { if (r.status === "fulfilled") s.mr_diff += r.value.data.length; });
      }
      if (compRes.status === "fulfilled") {
        for (const cr of compRes.value as any[]) {
          if (cr.status === "fulfilled") {
            const adRes = await Promise.allSettled(
              cr.value.data.map((c: any) => axios.get(`${API}/comparaisons/${c.id}/analyses`, { headers: H() }))
            );
            adRes.forEach((r: any) => { if (r.status === "fulfilled") s.analyses_diff += r.value.data.length; });
          }
        }
      }
    }

    // Diff stats summary
    if (r3.status === "fulfilled") {
      const d = r3.value.data;
      s.avg_qualite      = Math.round(d.average_qualite      || 0);
      s.avg_securite     = Math.round(d.average_securite     || 0);
      s.avg_performance  = Math.round(d.average_performance  || 0);
      s.merge_autorise   = d.merge_autorise_count   || 0;
      s.merge_bloque     = d.merge_bloque_count     || 0;
      s.aucun_changement = d.aucun_changement_count || 0;
    }
    if (r4.status === "fulfilled") s.tests          = r4.value.data.length;
    if (r5.status === "fulfilled") s.issues         = r5.value.data.length;
    if (r6.status === "fulfilled") s.recommandations = r6.value.data.length;
    if (r7.status === "fulfilled") s.exports        = r7.value.data.length;
    if (r8.status === "fulfilled") s.mr_tests       = r8.value.data.length;

    setStats(s);
    setStatsLoading(false);
  };

  const handleSave = async () => {
    if (!editForm.username.trim()) { setEditError("Nom d'utilisateur requis"); return; }
    if (!editForm.email.trim())    { setEditError("Email requis"); return; }
    setEditLoad(true); setEditError(null); setEditOk(false);
    try {
      const res = await axios.put(`${API}/auth/update`,
        { username: editForm.username.trim(), email: editForm.email.trim() }, { headers: H() }
      );
      const u: UserData = res.data;
      if (!u.username || u.username === u.email) u.username = u.email.split("@")[0];
      setUser(u); setEditOk(true);
      setTimeout(() => { setEditOpen(false); setEditOk(false); }, 1400);
    } catch (e: any) { setEditError(e?.response?.data?.detail || "Erreur mise à jour"); }
    finally { setEditLoad(false); }
  };

  const sendOtp = async () => {
    if (!user) return; setOtpLoad(true); setPwdError(null);
    try { await axios.post(`${API}/auth/forgot-password`, { email: user.email }); setOtpSent(true); }
    catch (e: any) { setPwdError(e?.response?.data?.detail || "Erreur envoi OTP"); }
    finally { setOtpLoad(false); }
  };

  const handleResetPwd = async () => {
    if (pwdForm.password !== pwdForm.confirm) { setPwdError("Mots de passe différents"); return; }
    if (pwdForm.password.length < 6)           { setPwdError("Minimum 6 caractères"); return; }
    if (!pwdForm.otp.trim())                   { setPwdError("Code OTP requis"); return; }
    setPwdLoad(true); setPwdError(null); setPwdOk(false);
    try {
      await axios.post(`${API}/auth/reset-password`,
        { email: user!.email, otp: pwdForm.otp, password: pwdForm.password }
      );
      setPwdOk(true);
      setTimeout(() => { setPwdOpen(false); setPwdOk(false); setOtpSent(false); setPwdForm({ otp:"", password:"", confirm:"" }); }, 1600);
    } catch (e: any) { setPwdError(e?.response?.data?.detail || "Erreur reset"); }
    finally { setPwdLoad(false); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user_id"); router.push("/login"); };
  const fmtDate = (d?: string|null) => d ? new Date(d).toLocaleDateString("fr-FR", { month:"long", year:"numeric" }) : "Récemment";
  const colorScore = (v: number) => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
  const totalMR      = stats.mr_tests + stats.mr_diff;
  const totalDepots  = Math.max(stats.depots_analyse, stats.depots_comparaison);
  const totalAnalyses = stats.analyses_branche + stats.analyses_diff;

  // ── Composants ────────────────────────────────────────────────
  const Inp = ({ label, val, onChange, type="text", ph="" }: any) => (
    <div style={{ marginBottom:18 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:D.muted, marginBottom:6 }}>{label}</label>
      <input type={type} value={val} onChange={(e:any)=>onChange(e.target.value)} placeholder={ph}
        onFocus={(e:any)=>e.target.style.borderColor="#6366f1"} onBlur={(e:any)=>e.target.style.borderColor=D.border}
        style={{ width:"100%", padding:"11px 14px", border:`1px solid ${D.border}`, borderRadius:12, fontSize:14, background:D.inputBg, color:D.text, outline:"none", fontFamily:"inherit" }} />
    </div>
  );

  const StatCard = ({ icon, label, value, color, sub }: any) => (
    <div style={{ background:D.statBg, borderRadius:14, padding:"14px 12px", border:`1px solid ${D.border}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:17 }}>{icon}</span>
        {statsLoading
          ? <div style={{ width:28, height:22, background:D.border, borderRadius:6, animation:"pulse 1.4s ease infinite" }} />
          : <span style={{ fontSize:24, fontWeight:800, color, fontFamily:"monospace", lineHeight:1 }}>{value}</span>
        }
      </div>
      <div style={{ fontSize:11, fontWeight:600, color:D.muted }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:D.faint, marginTop:2 }}>{sub}</div>}
    </div>
  );

  const ScoreBar = ({ label, value, color }: any) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:12, color:D.muted, fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color, fontFamily:"monospace" }}>{statsLoading ? "—" : `${value}/100`}</span>
      </div>
      <div style={{ height:6, background:D.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${statsLoading?0:value}%`, background:color, borderRadius:3, transition:"width 0.8s ease" }} />
      </div>
    </div>
  );

  const SectionTitle = ({ title }: any) => (
    <div style={{ fontSize:10, fontWeight:700, color:D.faint, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, marginTop:4 }}>{title}</div>
  );

  if (loading) return (
    <div style={{ minHeight:"100vh", background:D.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:28, height:28, border:`3px solid ${D.border}`, borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight:"100vh", background:D.bg, display:"flex", alignItems:"center", justifyContent:"center", color:D.faint, gap:12 }}>
      Profil introuvable
      <button onClick={()=>router.push("/dashboard")} style={{ background:D.btnSec, border:"none", borderRadius:10, padding:"8px 16px", cursor:"pointer", color:D.muted }}>Retour</button>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:${D.bg}}
        ::-webkit-scrollbar-thumb{background:${D.border};border-radius:3px}
      `}</style>

      <div style={{ minHeight:"100vh", background:D.bg, fontFamily:"'Inter',sans-serif", color:D.text }}>

        {/* TOPBAR */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 32px", background:D.card, borderBottom:`1px solid ${D.border}`, position:"sticky", top:0, zIndex:10, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <button onClick={()=>router.push("/dashboard")} style={{ background:D.btnSec, border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:500, cursor:"pointer", color:D.muted }}>← Tableau de bord</button>
            <div>
              <h1 style={{ fontSize:20, fontWeight:700, color:D.text, letterSpacing:"-0.02em", margin:0 }}>Mon profil</h1>
              <p style={{ fontSize:11, color:D.faint, margin:0 }}>Informations personnelles & statistiques complètes</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <ThemeToggle />
            <button onClick={()=>{ setEditOpen(true); setEditError(null); setEditOk(false); }} style={{ background:D.btnSec, border:"none", borderRadius:10, padding:"7px 14px", fontSize:13, fontWeight:500, cursor:"pointer", color:D.muted }}>✎ Modifier</button>
            <button onClick={()=>{ setPwdOpen(true); setPwdError(null); setPwdOk(false); setOtpSent(false); setPwdForm({otp:"",password:"",confirm:""}); }} style={{ background:D.btnSec, border:"none", borderRadius:10, padding:"7px 14px", fontSize:13, fontWeight:500, cursor:"pointer", color:D.muted }}>🔑 Mot de passe</button>
            <button onClick={handleLogout} style={{ background:D.dangerBg, border:"none", borderRadius:10, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer", color:"#ef4444" }}>⎋ Déconnexion</button>
          </div>
        </div>

        {/* GRID */}
        <div style={{ maxWidth:1220, margin:"0 auto", padding:"28px 24px", display:"grid", gridTemplateColumns:"280px 1fr", gap:24, animation:"fadeUp 0.3s ease" }}>

          {/* ─── COLONNE GAUCHE ─── */}
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

            {/* Avatar */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:22, padding:24, textAlign:"center" }}>
              <div style={{ width:84, height:84, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", fontSize:32, fontWeight:700, color:"white", boxShadow:"0 8px 24px rgba(99,102,241,0.3)" }}>
                {user.username?.[0]?.toUpperCase()||"U"}
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:D.text, marginBottom:3 }}>{user.username}</div>
              <div style={{ fontSize:11, color:D.faint, fontFamily:"monospace", marginBottom:12 }}>{user.email}</div>
              <span style={{ fontSize:11, fontWeight:600, padding:"4px 14px", borderRadius:30, background:user.role==="admin"?"rgba(245,158,11,0.15)":"rgba(99,102,241,0.15)", color:user.role==="admin"?"#f59e0b":"#6366f1" }}>
                {user.role==="admin"?"👑 Administrateur":"👤 Utilisateur"}
              </span>
              <div style={{ height:1, background:D.border, margin:"18px 0" }} />
              {/* 4 chiffres clés */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { icon:"📁", val:totalDepots,    label:"Projets",  color:"#6366f1" },
                  { icon:"🔍", val:totalAnalyses,  label:"Analyses", color:"#10b981" },
                  { icon:"◇",  val:stats.issues,   label:"Issues",   color:"#f59e0b" },
                  { icon:"🔀", val:totalMR,        label:"MR",       color:"#ef4444" },
                ].map(s=>(
                  <div key={s.label} style={{ background:D.statBg, borderRadius:12, padding:"10px 6px", textAlign:"center" }}>
                    <div style={{ fontSize:14, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:s.color, lineHeight:1, fontFamily:"monospace" }}>
                      {statsLoading?"·":s.val}
                    </div>
                    <div style={{ fontSize:10, color:D.faint, marginTop:3, fontWeight:500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height:1, background:D.border, margin:"18px 0" }} />
              <div style={{ fontSize:11, color:D.faint, fontFamily:"monospace" }}>Membre depuis {fmtDate(user.created_at)}</div>
            </div>

            {/* Statut */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:18, padding:18 }}>
              <div style={{ fontSize:10, fontWeight:700, color:D.faint, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Statut du compte</div>
              {[
                { label:"État", val:user.is_active?"✓ Actif":"✕ Inactif", color:user.is_active?"#10b981":"#ef4444", bg:user.is_active?D.successBg:D.dangerBg },
                { label:"Rôle", val:user.role==="admin"?"Administrateur":"Utilisateur", color:user.role==="admin"?"#f59e0b":"#6366f1", bg:user.role==="admin"?"rgba(245,158,11,0.12)":"rgba(99,102,241,0.12)" },
                { label:"ID",   val:`#${user.id}`, color:D.faint, bg:D.statBg },
              ].map(r=>(
                <div key={r.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:12, color:D.muted }}>{r.label}</span>
                  <span style={{ fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20, background:r.bg, color:r.color }}>{r.val}</span>
                </div>
              ))}
            </div>

            {/* Scores moyens */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:18, padding:18 }}>
              <div style={{ fontSize:10, fontWeight:700, color:D.faint, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>Scores moyens · analyses diff</div>
              <ScoreBar label="Qualité"     value={stats.avg_qualite}    color={colorScore(stats.avg_qualite)} />
              <ScoreBar label="Sécurité"    value={stats.avg_securite}   color={colorScore(stats.avg_securite)} />
              <ScoreBar label="Performance" value={stats.avg_performance} color={colorScore(stats.avg_performance)} />
            </div>

          </div>

          {/* ─── COLONNE DROITE ─── */}
          <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

            {/* Infos compte */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:22, padding:26 }}>
              <div style={{ fontSize:14, fontWeight:700, color:D.text, marginBottom:18, paddingBottom:12, borderBottom:`1px solid ${D.border}` }}>📋 Informations du compte</div>
              {[
                { icon:"👤", label:"Nom d'utilisateur", value:user.username, badge:{ text:"✓ Vérifié", color:"#6366f1", bg:"rgba(99,102,241,0.12)" } },
                { icon:"📧", label:"Adresse email",     value:user.email,    badge:{ text:user.is_active?"Actif":"Inactif", color:user.is_active?"#10b981":"#ef4444", bg:user.is_active?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)" } },
                { icon:"🔐", label:"Connexion via",     value:"GitLab OAuth / Email", badge:{ text:"GitLab", color:"#f59e0b", bg:"rgba(245,158,11,0.12)" } },
                { icon:"📅", label:"Membre depuis",     value:fmtDate(user.created_at) },
              ].map((r,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:D.infoBg, borderRadius:13, marginBottom:10 }}>
                  <div style={{ width:38, height:38, background:D.card, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{r.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:D.faint, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>{r.label}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:D.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.value}</div>
                  </div>
                  {r.badge && <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, background:r.badge.bg, color:r.badge.color, flexShrink:0 }}>{r.badge.text}</span>}
                </div>
              ))}
            </div>

            {/* ── STATISTIQUES COMPLÈTES ── */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:22, padding:26 }}>
              <div style={{ fontSize:14, fontWeight:700, color:D.text, marginBottom:20, paddingBottom:12, borderBottom:`1px solid ${D.border}` }}>📊 Statistiques complètes</div>

              <SectionTitle title="Projets GitLab" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:22 }}>
                <StatCard icon="📁" label="Dépôts analysés"    value={stats.depots_analyse}    color="#6366f1" sub="Analyses branche" />
                <StatCard icon="⚡" label="Dépôts comparaison" value={stats.depots_comparaison} color="#8b5cf6" sub="Diff branches" />
                <StatCard icon="📂" label="Total projets"       value={totalDepots}              color="#a78bfa" sub="Tous types" />
              </div>

              <SectionTitle title="Analyses IA" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:22 }}>
                <StatCard icon="🔍" label="Analyses branche" value={stats.analyses_branche} color="#10b981" sub="Code complet" />
                <StatCard icon="⚡" label="Analyses diff"    value={stats.analyses_diff}    color="#ec4899" sub="Entre branches" />
                <StatCard icon="📊" label="Total analyses"   value={totalAnalyses}           color="#14b8a6" sub="Tous types" />
              </div>

              <SectionTitle title="Résultats analyses diff" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:22 }}>
                <StatCard icon="✅" label="Merge autorisé"  value={stats.merge_autorise}   color="#10b981" />
                <StatCard icon="🚫" label="Merge bloqué"    value={stats.merge_bloque}     color="#ef4444" />
                <StatCard icon="○"  label="Sans changement" value={stats.aucun_changement} color="#6b7280" />
              </div>

              <SectionTitle title="Post-analyse" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
                <StatCard icon="◇"  label="Issues GitLab"   value={stats.issues}          color="#f59e0b" />
                <StatCard icon="🧪" label="Tests générés"   value={stats.tests}           color="#8b5cf6" />
                <StatCard icon="💡" label="Recommandations" value={stats.recommandations} color="#06b6d4" />
                <StatCard icon="📄" label="Rapports PDF"    value={stats.exports}         color="#64748b" />
              </div>

              <SectionTitle title="Merge Requests" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                <StatCard icon="🧪" label="MR tests IA"      value={stats.mr_tests} color="#7c3aed" sub="Tests unitaires" />
                <StatCard icon="⚡" label="MR diff branches" value={stats.mr_diff}  color="#d97706" sub="Auto / forcée" />
                <StatCard icon="🔀" label="Total MR"         value={totalMR}         color="#ef4444" sub="Toutes sources" />
              </div>
            </div>

            {/* Activité récente */}
            <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:22, padding:26 }}>
              <div style={{ fontSize:14, fontWeight:700, color:D.text, marginBottom:18, paddingBottom:12, borderBottom:`1px solid ${D.border}` }}>🕐 Activité récente</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { dot:"#6366f1", text:"Connexion active",     sub:"Session en cours",           time:"Maintenant" },
                  { dot:"#10b981", text:"Compte créé",          sub:user.email,                   time:fmtDate(user.created_at) },
                  ...(totalAnalyses>0  ?[{ dot:"#10b981", text:`${totalAnalyses} analyse${totalAnalyses>1?"s":""}`, sub:`${stats.analyses_branche} branche · ${stats.analyses_diff} diff`,  time:"Récemment" }]:[]),
                  ...(stats.issues>0   ?[{ dot:"#f59e0b", text:`${stats.issues} issue${stats.issues>1?"s":""}`,     sub:"Créées automatiquement",     time:"Récemment" }]:[]),
                  ...(stats.tests>0    ?[{ dot:"#8b5cf6", text:`${stats.tests} test${stats.tests>1?"s":""} générés`,sub:"Par le LLM",                  time:"Récemment" }]:[]),
                  ...(totalMR>0        ?[{ dot:"#ef4444", text:`${totalMR} Merge Request${totalMR>1?"s":""}`,       sub:`${stats.mr_tests} tests · ${stats.mr_diff} diff`, time:"Récemment" }]:[]),
                  ...(stats.recommandations>0?[{ dot:"#06b6d4", text:`${stats.recommandations} recommandation${stats.recommandations>1?"s":""}`, sub:"Générées par l'IA", time:"Récemment" }]:[]),
                  ...(stats.exports>0  ?[{ dot:"#64748b", text:`${stats.exports} rapport${stats.exports>1?"s":""} exporté${stats.exports>1?"s":""}`, sub:"Export PDF", time:"Récemment" }]:[]),
                ].map((item,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:D.infoBg, borderRadius:12 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:item.dot, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:D.text }}>{item.text}</div>
                      <div style={{ fontSize:11, color:D.faint }}>{item.sub}</div>
                    </div>
                    <div style={{ fontSize:10, color:D.faint, fontFamily:"monospace", flexShrink:0 }}>{item.time}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* MODAL MODIFIER PROFIL */}
      {editOpen&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }} onClick={()=>setEditOpen(false)}>
          <div style={{ background:D.modalBg, borderRadius:22, maxWidth:460, width:"100%", padding:28, boxShadow:"0 24px 64px rgba(0,0,0,0.3)", border:`1px solid ${D.border}`, animation:"fadeUp 0.25s ease" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:19, fontWeight:700, color:D.text, marginBottom:4 }}>✎ Modifier le profil</div>
            <div style={{ fontSize:13, color:D.faint, marginBottom:22 }}>Mettez à jour vos informations personnelles</div>
            <Inp label="Nom d'utilisateur" val={editForm.username} onChange={(v:string)=>setEditForm(f=>({...f,username:v}))} ph="Votre nom d'utilisateur" />
            <Inp label="Adresse email" val={editForm.email} onChange={(v:string)=>setEditForm(f=>({...f,email:v}))} type="email" ph="votre@email.com" />
            {editError&&<div style={{ background:D.dangerBg, border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#ef4444", marginBottom:16 }}>⚠️ {editError}</div>}
            {editOk   &&<div style={{ background:D.successBg, border:"1px solid rgba(16,185,129,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#10b981", marginBottom:16 }}>✓ Profil mis à jour !</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setEditOpen(false)} style={{ flex:1, padding:11, background:D.btnSec, border:"none", borderRadius:12, fontSize:14, fontWeight:500, cursor:"pointer", color:D.muted }}>Annuler</button>
              <button onClick={handleSave} disabled={editLoad} style={{ flex:2, padding:11, background:D.btnPrimary, border:"none", borderRadius:12, color:"white", fontSize:14, fontWeight:600, cursor:editLoad?"not-allowed":"pointer", opacity:editLoad?0.65:1 }}>
                {editLoad?"Enregistrement...":"Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOT DE PASSE */}
      {pwdOpen&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }} onClick={()=>setPwdOpen(false)}>
          <div style={{ background:D.modalBg, borderRadius:22, maxWidth:460, width:"100%", padding:28, boxShadow:"0 24px 64px rgba(0,0,0,0.3)", border:`1px solid ${D.border}`, animation:"fadeUp 0.25s ease" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:19, fontWeight:700, color:D.text, marginBottom:4 }}>🔑 Changer le mot de passe</div>
            <div style={{ fontSize:13, color:D.faint, marginBottom:22 }}>{!otpSent?"Un code OTP sera envoyé à votre email":"Entrez le code et votre nouveau mot de passe"}</div>
            {!otpSent?(
              <>
                <div style={{ background:D.infoBg, borderRadius:12, padding:"12px 16px", fontSize:13, color:D.muted, marginBottom:20 }}>
                  📧 Code envoyé à : <strong style={{ color:D.text }}>{user.email}</strong>
                </div>
                <button onClick={sendOtp} disabled={otpLoad} style={{ width:"100%", padding:12, background:"#6366f1", border:"none", borderRadius:12, color:"white", fontSize:14, fontWeight:600, cursor:otpLoad?"not-allowed":"pointer", opacity:otpLoad?0.65:1 }}>
                  {otpLoad?"Envoi...":"📨 Envoyer le code OTP"}
                </button>
              </>
            ):(
              <>
                <Inp label="Code OTP" val={pwdForm.otp} onChange={(v:string)=>setPwdForm(f=>({...f,otp:v}))} ph="123456" />
                <Inp label="Nouveau mot de passe" val={pwdForm.password} onChange={(v:string)=>setPwdForm(f=>({...f,password:v}))} type="password" ph="Minimum 6 caractères" />
                <Inp label="Confirmer" val={pwdForm.confirm} onChange={(v:string)=>setPwdForm(f=>({...f,confirm:v}))} type="password" ph="Répéter le mot de passe" />
              </>
            )}
            {pwdError&&<div style={{ background:D.dangerBg, border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#ef4444", marginBottom:14, marginTop:8 }}>⚠️ {pwdError}</div>}
            {pwdOk   &&<div style={{ background:D.successBg, border:"1px solid rgba(16,185,129,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#10b981", marginBottom:14, marginTop:8 }}>✓ Mot de passe modifié !</div>}
            {otpSent&&(
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button onClick={()=>setPwdOpen(false)} style={{ flex:1, padding:11, background:D.btnSec, border:"none", borderRadius:12, fontSize:14, fontWeight:500, cursor:"pointer", color:D.muted }}>Annuler</button>
                <button onClick={handleResetPwd} disabled={pwdLoad} style={{ flex:2, padding:11, background:D.btnPrimary, border:"none", borderRadius:12, color:"white", fontSize:14, fontWeight:600, cursor:pwdLoad?"not-allowed":"pointer", opacity:pwdLoad?0.65:1 }}>
                  {pwdLoad?"Modification...":"Confirmer"}
                </button>
              </div>
            )}
            {!otpSent&&<button onClick={()=>setPwdOpen(false)} style={{ width:"100%", marginTop:10, padding:11, background:D.btnSec, border:"none", borderRadius:12, fontSize:14, fontWeight:500, cursor:"pointer", color:D.muted }}>Annuler</button>}
          </div>
        </div>
      )}
    </>
  );
}

