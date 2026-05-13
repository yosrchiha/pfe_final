// frontend/app/authUtils.ts
//
// Utilitaire centralisé de déconnexion.
// À importer dans TOUTES les pages qui ont un bouton "Déconnexion" :
//
//   import { logout } from "@/app/authUtils";
//   ...
//   const handleLogout = () => logout(router);
//
// Il appelle POST /auth/logout (marque logout_at en base) AVANT de
// supprimer le token local — même si l'appel échoue, la déconnexion
// locale se fait quand même.

const API = "http://localhost:8001";

/**
 * Déconnecte l'utilisateur :
 * 1. Appelle POST /auth/logout pour enregistrer logout_at en base
 * 2. Supprime le token local (localStorage)
 * 3. Redirige vers /login
 */
export async function logout(router: { push: (path: string) => void }): Promise<void> {
  const token = localStorage.getItem("token");

  // Appel backend — fire-and-forget avec timeout court
  if (token) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 3000); // 3 s max

      await fetch(`${API}/auth/logout`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch {
      // Silencieux : réseau indisponible ou token déjà expiré
      // La déconnexion locale se fait quand même ci-dessous
    }
  }

  // Nettoyage local
  localStorage.removeItem("token");
  localStorage.removeItem("user_id");

  // Redirection
  router.push("/login");
}
