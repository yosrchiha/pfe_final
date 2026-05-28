/**
 * Mode personnel administrateur.
 * L'administrateur exécute exactement le même parcours qu'un utilisateur :
 * son compte applicatif, son token GitLab et ses propres projets.
 * Aucune route /admin/new-analyse/run n'est appelée.
 */
export { default } from "../../analyse/page";
