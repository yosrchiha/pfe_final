from fastapi import APIRouter
from app.services.gitlab_service import get_projects

router = APIRouter()

@router.get("/gitlab/projects")
def list_projects():
    return get_projects()
@router.get("/gitlab/branches")
def get_gitlab_branches(
    project: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les branches d'un projet GitLab.
    """
    # Récupérer le token depuis la base ou utiliser celui de l'utilisateur
    # Pour simplifier, on utilise un token passé en paramètre ou stocké
    # Dans ton cas, tu peux récupérer le token depuis le formulaire
    
    # Ici, on suppose que le token est passé dans la requête
    token = current_user.gitlab_token or os.getenv("GITLAB_TOKEN")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token GitLab manquant")
    
    try:
        gl = gitlab.Gitlab("https://gitlab.com", private_token=token)
        project_obj = gl.projects.get(project)
        branches = project_obj.branches.list()
        
        return {
            "project": project,
            "branches": [b.name for b in branches]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))