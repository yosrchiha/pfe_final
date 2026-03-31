# backend/app/routes/explorer.py

from fastapi import APIRouter, Depends, HTTPException  # ← ajouter Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session  # ← ajouter Session
import gitlab  # ← ajouter gitlab

from app.config.database import get_db  # ← ajouter get_db
from app.services.gitlab_client import get_project_files

router = APIRouter(prefix="/explorer", tags=["Explorer"])


class ExploreRequest(BaseModel):
    nom: str        # ex: "user/mon-repo" ou URL SSH/HTTPS
    branche: str    # ex: "main"
    token: str      # glpat-xxx


@router.post("/files")
def explore_branch(body: ExploreRequest):
    """
    Récupère tous les fichiers d'une branche GitLab
    sans passer par la base de données.
    L'utilisateur fournit directement : nom, branche, token.
    """
    try:
        fichiers = get_project_files(
            token=body.token,
            project_name=body.nom,
            branch=body.branche,
            extensions=None  
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "projet": body.nom,
        "branche": body.branche,
        "total": len(fichiers),
        "fichiers": fichiers
    }


# ════════════════════════════════════════════════════════
# NOUVEL ENDPOINT — Lister les projets GitLab
# ════════════════════════════════════════════════════════
# backend/app/routes/explorer.py

from pydantic import BaseModel

class GitLabTokenRequest(BaseModel):
    token: str


@router.post("/gitlab/projets")
def lister_projets_gitlab(
    request: GitLabTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Récupère la liste des projets GitLab accessibles avec le token.
    """
    gl = gitlab.Gitlab("https://gitlab.com", private_token=request.token)
    
    try:
        gl.auth()
    except Exception:
        raise HTTPException(status_code=401, detail="Token GitLab invalide")
    
    projets = gl.projects.list(owned=True, membership=True, all=True)
    
    return [
        {
            "id": p.id,
            "nom": p.name,
            "chemin": p.path_with_namespace,
            "url": p.web_url
        }
        for p in projets
    ]