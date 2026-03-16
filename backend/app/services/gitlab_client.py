import gitlab
from gitlab.exceptions import GitlabAuthenticationError, GitlabGetError

# ─────────────────────────────────────────────────────────────────
# CHANGEMENT : Remplacement de toutes les requêtes HTTP manuelles
# (requests.get) par python-gitlab qui gère l'API GitLab proprement
# ─────────────────────────────────────────────────────────────────


def _clean_project_name(project_name: str) -> str:
    """
    NOUVEAU : Nettoie le nom du projet pour extraire 'user/repo'
    peu importe le format saisi par l'utilisateur dans le formulaire.
    
    Exemples acceptés :
      - "user/mon-repo"                          → "user/mon-repo"
      - "git@gitlab.com:user/mon-repo.git"       → "user/mon-repo"
      - "https://gitlab.com/user/mon-repo.git"   → "user/mon-repo"
    """
    name = project_name.strip()
    if "git@gitlab.com:" in name:
        name = name.split("git@gitlab.com:")[-1]
    elif "gitlab.com/" in name:
        name = name.split("gitlab.com/")[-1]
    return name.replace(".git", "").strip("/")


def get_gitlab_project(token: str, project_name: str):
    """
    CHANGEMENT : Connexion à GitLab via python-gitlab au lieu de
    construire les headers Authorization manuellement.
    
    Args:
        token        : depot.token_gitlab stocké en base (glpat-xxx)
        project_name : depot.nom saisi dans le formulaire
    
    Returns:
        objet Project python-gitlab (donne accès à toutes les API GitLab)
    
    Raises:
        Exception si le token est révoqué ou le projet introuvable
    """
    clean_name = _clean_project_name(project_name)

    # CHANGEMENT : gl.Gitlab() remplace la construction manuelle des headers
    gl = gitlab.Gitlab("https://gitlab.com", private_token="glpat-uL9hpypebR1wrlFq1eM12m86MQp1Omtxdml5Cw.01.1201e08ki")

    try:
        # CHANGEMENT : gl.auth() vérifie le token avant toute opération
        gl.auth()
    except GitlabAuthenticationError:
        raise Exception("Token GitLab invalide ou révoqué")

    try:
        # CHANGEMENT : gl.projects.get() remplace requests.get(url/projects/...)
        project = gl.projects.get(clean_name)
    except GitlabGetError:
        raise Exception(f"Projet '{clean_name}' introuvable sur GitLab")

    return project


def compare_branches(token: str, project_name: str, from_branch: str, to_branch: str) -> dict:
    """
    CHANGEMENT : Cette fonction remplace entièrement le bloc de code
    dans l'ancien routes/depots.py qui utilisait requests.get() manuellement
    pour appeler https://gitlab.com/api/v4/projects/.../repository/compare
    
    Retourne exactement le même format JSON qu'avant pour ne pas
    casser le frontend (difference-page.tsx).
    
    Args:
        token        : depot.token_gitlab
        project_name : depot.nom
        from_branch  : depot.url_branche_principale
        to_branch    : depot.url_branche_developpement
    """
    # Récupère le projet via python-gitlab
    project = get_gitlab_project(token, project_name)
    clean_name = _clean_project_name(project_name)

    try:
        # CHANGEMENT : project.repository_compare() remplace requests.get(compare_url)
        diff_data = project.repository_compare(from_branch.strip(), to_branch.strip())
    except Exception as e:
        raise Exception(f"Erreur comparaison GitLab : {str(e)}")

    # Aucun changement détecté → même format qu'avant
    if not diff_data.get("diffs") and not diff_data.get("commits"):
        return {
            "project": clean_name,
            "from_branch": from_branch,
            "to_branch": to_branch,
            "commits_count": 0,
            "files": []
        }

    # Récupération du contenu des fichiers modifiés
    files_with_content = []
    for diff in diff_data.get("diffs", []):
        file_path = diff.get("new_path") or diff.get("old_path")
        if not file_path:
            continue
        try:
            # CHANGEMENT : project.files.get() remplace requests.get(file_url)
            # plus besoin de base64.b64decode() manuellement, python-gitlab
            # expose directement f.decode()
            f = project.files.get(file_path, ref=from_branch.strip())
            content = f.decode().decode("utf-8", errors="ignore")
        except Exception:
            content = ""  # fichier inaccessible → on continue sans bloquer

        files_with_content.append({
            "path": file_path,
            "content": content,
            "diff": diff.get("diff", "")
        })

    # Retourne le même format JSON qu'avant → frontend inchangé
    return {
        "project": clean_name,
        "from_branch": from_branch.strip(),
        "to_branch": to_branch.strip(),
        "commits_count": len(diff_data.get("commits", [])),
        "files": files_with_content
    }


def get_project_files(token: str, project_name: str, branch: str, extensions: list = None) -> list:
    """
    NOUVEAU : Récupère le contenu de tous les fichiers d'une branche.
    Utilisé pour l'étape suivante : analyse LLM du code.
    
    Args:
        token        : depot.token_gitlab
        project_name : depot.nom
        branch       : branche à analyser (ex: "main")
        extensions   : filtrer par extension, ex [".py", ".js"]
                       None = retourne tous les fichiers
    
    Returns:
        liste de dicts { path, content, size }
    """
    project = get_gitlab_project(token, project_name)

    try:
        # Récupère l'arborescence complète de la branche
        tree = project.repository_tree(ref=branch.strip(), recursive=True, get_all=True)
    except Exception as e:
        raise Exception(f"Erreur récupération arborescence : {str(e)}")

    fichiers = []
    for item in tree:
        # "blob" = fichier, "tree" = dossier → on ignore les dossiers
        if item.get("type") != "blob":
            continue

        path = item["path"]

        # Filtre par extension si demandé
        if extensions and not any(path.endswith(ext) for ext in extensions):
            continue

        try:
            f = project.files.get(path, ref=branch.strip())
            content = f.decode().decode("utf-8", errors="ignore")
            fichiers.append({
                "path": path,
                "content": content,
                "size": len(content)
            })
        except Exception:
            continue  # fichier binaire ou inaccessible → on skip

    return fichiers