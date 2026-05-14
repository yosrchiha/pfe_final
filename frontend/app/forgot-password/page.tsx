"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./forgot.module.css";

export default function ForgotPassword() {

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("http://localhost:8000/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Erreur");
      }

      router.push(`/reset-password?email=${email}`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>

      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>🔑</div>
          <p className={styles.appName}>GitLab Audit Platform</p>
          <h1 className={styles.title}>Mot de passe oublié</h1>
          <p className={styles.subtitle}>
            Entrez votre email pour recevoir un code OTP
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className={styles.form}>

          {error && <div className={styles.error}>✕ {error}</div>}

          {message && <div className={styles.success}>{message}</div>}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>

            <input
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.btnSubmit}
          >
            {loading
              ? <><div className={styles.spinner} /> Envoi...</>
              : "Envoyer le code OTP"}
          </button>

          <div className={styles.registerRow}>
            Retour à{" "}
            <Link href="/login" className={styles.registerLink}>
              connexion
            </Link>
          </div>

        </form>

      </div>

      <div className={styles.version}>
        <div className={styles.versionDot} />
        v1.0.0 · PFE 2025 · FastAPI + Next.js
      </div>

    </div>
  );
}

