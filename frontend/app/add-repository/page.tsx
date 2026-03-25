"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddDepot() {
  const router = useRouter();

  const [form, setForm] = useState({
    nom                       : "",
    url_branche_principale    : "",
    url_branche_developpement : "",
    token_gitlab              : "",
    proprietaire_id           : 0,
  });

  const [loading, setLoading] = useState(false);
  const [erreur,  setErreur]  = useState("");

  // ── localStorage uniquement côté client ──────────────────
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (userId) {
      setForm(prev => ({ ...prev, proprietaire_id: Number(userId) }));
    }
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErreur("");

    try {
      // 1. Créer le dépôt en base
      const res = await fetch("http://127.0.0.1:8000/depots/", {
        method  : "POST",
        headers : {
          "Content-Type": "application/json",
          Authorization : `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erreur lors de l'ajout du dépôt");
      }

      const depot = await res.json();

      // 2. Comparer les branches
      const compareRes = await fetch(
        `http://127.0.0.1:8000/depots/${depot.id}/compare`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (!compareRes.ok) {
        const errText = await compareRes.text();
        throw new Error(`Erreur comparaison : ${errText}`);
      }

      const compareData = await compareRes.json();

      // 3. Redirection vers /difference
      router.push(
        `/difference?data=${encodeURIComponent(JSON.stringify(compareData))}`
      );

    } catch (error: any) {
      setErreur(error.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh; background: #0d0e12;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; font-family: 'Inter', sans-serif;
        }

        .card {
          background: #111218; border: 1px solid #1c1d26;
          border-radius: 14px; padding: 36px;
          width: 100%; max-width: 480px;
        }

        .card-title { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .card-sub   { font-size: 11px; color: #444; font-family: 'JetBrains Mono', monospace; margin-bottom: 28px; }

        .field { margin-bottom: 18px; }

        .label {
          display: block; font-size: 11px; font-weight: 600;
          color: #666; font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 7px;
        }

        .input {
          width: 100%; padding: 10px 14px; background: #0d0e12;
          border: 1px solid #1c1d26; border-radius: 8px;
          color: #e8e8f0; font-family: 'JetBrains Mono', monospace;
          font-size: 13px; outline: none; transition: border-color 0.15s;
        }
        .input::placeholder { color: #2e3355; }
        .input:focus { border-color: #6c63ff55; box-shadow: 0 0 0 3px #6c63ff10; }

        .hint { display: block; font-size: 10px; color: #333; font-family: 'JetBrains Mono', monospace; margin-top: 5px; }

        .erreur {
          background: #ff6b6b10; border: 1px solid #ff6b6b30;
          border-radius: 8px; padding: 10px 14px;
          font-size: 12px; color: #ff6b6b;
          font-family: 'JetBrains Mono', monospace; margin-bottom: 16px;
        }

        .btn {
          width: 100%; padding: 13px; background: #6c63ff;
          border: none; border-radius: 8px; color: #fff;
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700;
          cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn:hover:not(:disabled) { background: #5b52e0; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .spin { width: 14px; height: 14px; border: 2px solid #ffffff30; border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="page">
        <form className="card" onSubmit={handleSubmit}>

          <div className="card-title">Ajouter un dépôt GitLab</div>
          <div className="card-sub">Renseigne les infos du dépôt pour lancer la comparaison de branches</div>

          <div className="field">
            <label className="label">Nom du dépôt</label>
            <input className="input" type="text"
              placeholder="git@gitlab.com:user/projet.git"
              value={form.nom}
              onChange={e => setForm({ ...form, nom: e.target.value })}
              required
            />
            <span className="hint">SSH ou URL HTTPS complète</span>
          </div>

          <div className="field">
            <label className="label">Branche principale</label>
            <input className="input" type="text"
              placeholder="main"
              value={form.url_branche_principale}
              onChange={e => setForm({ ...form, url_branche_principale: e.target.value })}
              required
            />
            <span className="hint">Ex : main, master</span>
          </div>

          <div className="field">
            <label className="label">Branche développement</label>
            <input className="input" type="text"
              placeholder="develop"
              value={form.url_branche_developpement}
              onChange={e => setForm({ ...form, url_branche_developpement: e.target.value })}
              required
            />
            <span className="hint">Ex : develop, dev, feature/xxx</span>
          </div>

          <div className="field">
            <label className="label">Token GitLab</label>
            <input className="input" type="password"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={form.token_gitlab}
              onChange={e => setForm({ ...form, token_gitlab: e.target.value })}
              required
            />
            <span className="hint">Settings → Access Tokens → scopes : api, read_repository</span>
          </div>

          {erreur && <div className="erreur">⚠ {erreur}</div>}

          <button className="btn" type="submit" disabled={loading}>
            {loading
              ? <><div className="spin"/> Comparaison en cours...</>
              : "Comparer les branches →"
            }
          </button>

        </form>
      </div>
    </>
  );
}