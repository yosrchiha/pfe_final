# backend/app/routes/explorer.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import gitlab

from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.services.gitlab_client import get_project_files

router = APIRouter(prefix="/explorer", tags=["Explorer"])


class ExploreRequest(BaseModel):
    nom: str
    branche: str
    token: str


@router.post("/files")
def explore_branch(body: ExploreRequest):
    """
    Récupère tous les fichiers d'une branche GitLab
    sans passer par la base de données.
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


class BranchesRequest(BaseModel):
    token: str
    project_name: str


@router.post("/gitlab/branches")
def get_gitlab_branches(
    data: BranchesRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les branches d'un projet GitLab.
    """
    try:
        gl = gitlab.Gitlab("https://gitlab.com", private_token=data.token)
        
        # Nettoyer le nom du projet
        project_name = data.project_name.strip()
        if "git@gitlab.com:" in project_name:
            project_name = project_name.split("git@gitlab.com:")[-1].replace(".git", "")
        elif "gitlab.com/" in project_name:
            project_name = project_name.split("gitlab.com/")[-1].replace(".git", "")
        
        project = gl.projects.get(project_name)
        branches = project.branches.list()
        
        return {
            "project": project_name,
            "branches": [
                {
                    "name": b.name,
                    "default": b.name == project.default_branch
                }
                for b in branches
            ]
        }
        
    except gitlab.exceptions.GitlabAuthenticationError:
        raise HTTPException(status_code=401, detail="Token GitLab invalide")
    except gitlab.exceptions.GitlabGetError:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))