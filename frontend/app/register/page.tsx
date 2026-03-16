"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./register.module.css";
import { registerUser } from "../lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
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
      await registerUser({ email, username, password });
      alert("Inscription réussie !");
      router.push("/login");
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
          <div className={styles.logoWrap}>📝</div>
          <p className={styles.appName}>GitLab Audit Platform</p>
          <h1 className={styles.title}>Créer un compte</h1>
          <p className={styles.subtitle}>
            Entrez vos informations pour vous inscrire
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
            <label className={styles.label}>Nom d'utilisateur</label>
            <input
              type="text"
              placeholder="Votre pseudo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Mot de passe</label>
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
              ? <><div className={styles.spinner} /> Inscription...</>
              : "S'inscrire"}
          </button>

          <div className={styles.registerRow}>
            Déjà un compte ?{" "}
            <Link href="/login" className={styles.registerLink}>
              Connexion
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