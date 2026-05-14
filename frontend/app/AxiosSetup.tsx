"use client";

/**
 * AxiosSetup.tsx
 *
 * Ce composant s'exécute UNE FOIS au démarrage de l'app (dans layout.tsx).
 * Il configure axios globalement → toutes tes pages héritent
 * automatiquement du cache, du token, et du redirect 401.
 * AUCUNE MODIFICATION DES PAGES EXISTANTES NÉCESSAIRE.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ── Cache en mémoire ────────────────────────────────────────────────────────
const CACHE_TTL = 30_000; // 30 secondes
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlight = new Map<string, Promise<unknown>>();

export default function AxiosSetup() {
  const router = useRouter();

  useEffect(() => {
    // ── 1. Base URL : plus besoin d'écrire http://localhost:8000 partout ──
    axios.defaults.baseURL = "http://localhost:8000";

    // ── 2. Intercepteur REQUEST : injecte le token automatiquement ──────────
    const reqId = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token && !config.headers["Authorization"]) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }

      // ── 3. Cache côté client pour les GET ──────────────────────────────
      if (config.method?.toLowerCase() === "get") {
        const key = config.url + JSON.stringify(config.params ?? {});
        const cached = cache.get(key);
        if (cached && Date.now() < cached.expiresAt) {
          // Astuce : on annule la vraie requête et on retourne le cache
          // via un signal d'annulation + adapter personnalisé
          config.adapter = () =>
            Promise.resolve({
              data: cached.data,
              status: 200,
              statusText: "OK (cache)",
              headers: {},
              config,
            });
        }
      }

      return config;
    });

    // ── 4. Intercepteur RESPONSE : cache + redirect 401 ─────────────────
    const resId = axios.interceptors.response.use(
      (response) => {
        // Mettre en cache les réponses GET réussies
        if (response.config.method?.toLowerCase() === "get") {
          const key =
            response.config.url +
            JSON.stringify(response.config.params ?? {});
          if (!response.config.url?.includes("unread")) {
            // Ne pas cacher les notifications temps-réel
            cache.set(key, {
              data: response.data,
              expiresAt: Date.now() + CACHE_TTL,
            });
          }
        }
        return response;
      },
      (error) => {
        // Redirect automatique si token expiré
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user_id");
          router.replace("/login");
        }
        return Promise.reject(error);
      }
    );

    // Nettoyage au démontage
    return () => {
      axios.interceptors.request.eject(reqId);
      axios.interceptors.response.eject(resId);
    };
  }, [router]);

  return null; // Ce composant ne rend rien
}

