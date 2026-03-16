"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./reset.module.css";

export default function ResetPassword() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("http://127.0.0.1:8000/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Erreur lors de la réinitialisation");
      }

      router.replace("/login");

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
          <div className={styles.logoWrap}>🔒</div>
          <p className={styles.appName}>GitLab Audit Platform</p>
          <h1 className={styles.title}>Réinitialiser le mot de passe</h1>
          <p className={styles.subtitle}>
            Entrez le code OTP et votre nouveau mot de passe
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className={styles.form}>

          {error && <div className={styles.error}>✕ {error}</div>}

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

          <div className={styles.field}>
            <label className={styles.label}>Code OTP</label>
            <input
              type="text"
              placeholder="Code reçu par email"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Nouveau mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirmer le mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              ? <><div className={styles.spinner} /> Réinitialisation...</>
              : "Changer le mot de passe"}
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