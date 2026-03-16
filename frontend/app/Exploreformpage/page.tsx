"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function ExploreFormPage() {
  const router = useRouter();
  const [nom, setNom]         = useState("");
  const [branche, setBranche] = useState("main");
  const [token, setToken]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async () => {
    if (!nom.trim() || !branche.trim() || !token.trim()) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/explorer/files", {
        nom: nom.trim(),
        branche: branche.trim(),
        token: token.trim(),
      });

      // ✅ CORRECTION : stocke dans sessionStorage au lieu de l'URL
      // L'URL encodée causait une erreur 431 (Request Header Fields Too Large)
      sessionStorage.setItem("explorer_data", JSON.stringify(res.data));

      // Redirige sans données dans l'URL
      router.push("/explorer");

    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Erreur de connexion au serveur.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-10">

        <button
          onClick={() => router.push("/dashboard")}
          className="mb-6 text-gray-500 text-sm border border-gray-800 rounded-lg px-3 py-1 hover:text-gray-300 hover:border-gray-600 transition"
        >
          ← Retour
        </button>
        <div className="text-2xl mb-1 text-white font-bold">Explorer un dépôt</div>
        <div className="text-gray-500 text-sm mb-8 font-mono">code source · branche directe</div>

        <div className="flex flex-col gap-5">

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">
              Nom du dépôt
            </label>
            <input
              className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-100 text-sm font-mono placeholder-gray-700 outline-none focus:border-indigo-500 transition"
              placeholder="ex: username/mon-projet"
              value={nom}
              onChange={e => setNom(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            <div className="text-xs text-gray-700 font-mono">Format : user/repo  ou URL SSH/HTTPS GitLab</div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">
              Branche
            </label>
            <input
              className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-100 text-sm font-mono placeholder-gray-700 outline-none focus:border-indigo-500 transition"
              placeholder="ex: main, dev, feature/xxx"
              value={branche}
              onChange={e => setBranche(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            <div className="text-xs text-gray-700 font-mono">Nom exact de la branche GitLab</div>
          </div>

          <hr className="border-gray-800" />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">
              Token GitLab
            </label>
            <input
              type="password"
              className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-gray-100 text-sm font-mono placeholder-gray-700 outline-none focus:border-indigo-500 transition"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            <div className="text-xs text-gray-700 font-mono">Settings → Access Tokens → scopes: read_api, read_repository</div>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-xs font-mono">
              ✕  {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 mt-1"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Chargement du code...
              </>
            ) : (
              "◈  Voir le code de la branche"
            )}
          </button>

        </div>

        <div className="mt-6 pt-5 border-t border-gray-800 text-center text-xs text-gray-700 font-mono leading-relaxed">
          Le token est utilisé uniquement pour cette session.<br />
          Il n'est pas sauvegardé en base de données.
        </div>

      </div>
    </div>
  );
}