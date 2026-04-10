"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser } from "../lib/api";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [stage,    setStage]    = useState<"idle" | "choosing">("idle");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser({ email, password });
      localStorage.setItem("token", data.access_token);

      const meRes = await fetch("http://127.0.0.1:8000/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const me = await meRes.json();

      if (me.role === "admin") {
        setStage("choosing");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  if (stage === "choosing") {
    return (
      <div className={styles.page}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: none; }
          }
        `}</style>

        <div style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 520,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 28,
          padding: "0 16px",
          animation: "fadeUp 0.35s ease",
        }}>

          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 58, height: 58, borderRadius: 16, margin: "0 auto 18px",
              background: "linear-gradient(135deg, #5b63f5, #9b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, boxShadow: "0 0 36px rgba(91,99,245,0.45)",
            }}>⬡</div>
            <p style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
              color: "#22c55e", textTransform: "uppercase",
              letterSpacing: "0.18em", marginBottom: 10,
            }}>
              ● Connexion réussie
            </p>
            <h2 style={{
              fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800,
              color: "#f1f3fc", letterSpacing: "-0.02em", marginBottom: 8,
            }}>
              Quel espace souhaitez-vous ?
            </h2>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#5a6080" }}>
              Compte administrateur détecté
            </p>
          </div>

          {/* Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%" }}>

            {/* ESPACE CLIENT */}
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                background: "#0f1117", border: "1px solid #1e2235", borderRadius: 18,
                padding: "28px 22px", cursor: "pointer", textAlign: "left",
                transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                fontFamily: "'Syne',sans-serif",
                display: "flex", flexDirection: "column", gap: 14,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(34,197,94,0.4)";
                el.style.background  = "rgba(34,197,94,0.06)";
                el.style.transform   = "translateY(-3px) scale(1.01)";
                el.style.boxShadow   = "0 12px 36px rgba(34,197,94,0.14)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#1e2235";
                el.style.background  = "#0f1117";
                el.style.transform   = "none";
                el.style.boxShadow   = "none";
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>◎</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f3fc", marginBottom: 8 }}>
                  Espace client
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                  color: "#5a6080", lineHeight: 1.7,
                }}>
                  Analyses IA<br />Diff · Explorer<br />Tests · MR
                </div>
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                color: "#22c55e", marginTop: "auto",
              }}>
                Dashboard →
              </div>
            </button>

            {/* ESPACE ADMIN */}
            <button
              onClick={() => router.push("/admin-pages")}
              style={{
                background: "#0f1117", border: "1px solid #1e2235", borderRadius: 18,
                padding: "28px 22px", cursor: "pointer", textAlign: "left",
                transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                fontFamily: "'Syne',sans-serif",
                display: "flex", flexDirection: "column", gap: 14,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(91,99,245,0.5)";
                el.style.background  = "rgba(91,99,245,0.07)";
                el.style.transform   = "translateY(-3px) scale(1.01)";
                el.style.boxShadow   = "0 12px 36px rgba(91,99,245,0.18)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "#1e2235";
                el.style.background  = "#0f1117";
                el.style.transform   = "none";
                el.style.boxShadow   = "none";
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(91,99,245,0.12)", border: "1px solid rgba(91,99,245,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>🛡️</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f3fc", marginBottom: 8 }}>
                  Espace admin
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                  color: "#5a6080", lineHeight: 1.7,
                }}>
                  Utilisateurs<br />Dépôts · Stats<br />Supervision
                </div>
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                color: "#818cf8", marginTop: "auto",
              }}>
                Admin panel →
              </div>
            </button>

          </div>

          <p style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
            color: "#3a4060", textAlign: "center",
          }}>
            Vous pouvez basculer entre les deux espaces à tout moment
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* Card centrale */}
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>⬡</div>
          <p className={styles.appName}>GitLab Audit Platform</p>
          <h1 className={styles.title}>Bon retour 👋</h1>
          <p className={styles.subtitle}>Connectez-vous pour accéder à votre espace d'audit</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className={styles.form}>

          {error && <div className={styles.error}>✕  {error}</div>}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Mot de passe</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className={styles.forgotRow}>
            <Link href="/forgot-password" className={styles.forgotLink}>
              Mot de passe oublié ?
            </Link>
          </div>

          <button type="submit" className={styles.btnSubmit} disabled={loading}>
            {loading
              ? <><div className={styles.spinner} /> Connexion...</>
              : "Se connecter →"}
          </button>

          <div className={styles.divider}>ou</div>

          <button
            type="button"
            className={styles.btnGitlab}
            onClick={() => { window.location.href = "http://127.0.0.1:8000/auth/gitlab/login"; }}
          >
            <span className={styles.gitlabIcon}>🦊</span>
            Continuer avec GitLab
          </button>

          <div className={styles.registerRow}>
            Pas encore de compte ?{" "}
            <Link href="/register" className={styles.registerLink}>S'inscrire</Link>
          </div>

        </form>
      </div>

      {/* Badge version */}
      <div className={styles.version}>
        <div className={styles.versionDot} />
        v1.0.0 · PFE 2025 · FastAPI + Next.js
      </div>

    </div>
  );
}