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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser({ email, password });
      localStorage.setItem("token", data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

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