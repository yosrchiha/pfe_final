from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
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
            extensions=None  # tous les fichiers
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "projet": body.nom,
        "branche": body.branche,
        "total": len(fichiers),
        "fichiers": fichiers
    }