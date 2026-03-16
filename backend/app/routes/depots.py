from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.models.depot import Depot
from app.schemas.depot import DepotCreate, DepotResponse, DepotUpdate
from app.config.database import SessionLocal
from app.routes.auth import get_current_user
from app.models.user import User

# ─────────────────────────────────────────────────────────────────
# CHANGEMENT : Import du service gitlab_client qui remplace tous les
# appels requests.get() manuels vers l'API GitLab
# ─────────────────────────────────────────────────────────────────
from app.services.gitlab_client import compare_branches, get_project_files

router = APIRouter(prefix="/depots", tags=["Depots"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── POST / ────────────────────────────────────────────────────────
# INCHANGÉ : création du dépôt, proprietaire_id depuis JWT
@router.post("/", response_model=DepotResponse)
def create_depot(
    depot: DepotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_depot = Depot(
        nom=depot.nom,
        url_branche_principale=depot.url_branche_principale,
        url_branche_developpement=depot.url_branche_developpement,
        token_gitlab=depot.token_gitlab,
        proprietaire_id=current_user.id  # ✅ toujours depuis le token JWT
    )
    db.add(db_depot)
    db.commit()
    db.refresh(db_depot)
    return db_depot


# ── GET / ─────────────────────────────────────────────────────────
# INCHANGÉ : retourne tous les dépôts (tous utilisateurs)
@router.get("/", response_model=List[DepotResponse])
def list_depots(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Depot).offset(skip).limit(limit).all()


# ── GET /user/{user_id} ───────────────────────────────────────────
# IMPORTANT : cette route doit rester AVANT /{depot_id} sinon
# FastAPI interprète "user" comme un depot_id et retourne 404
@router.get("/user/{user_id}", response_model=List[DepotResponse])
def get_user_depots(user_id: int, db: Session = Depends(get_db)):
    """Retourne les dépôts d'un utilisateur spécifique."""
    depots = db.query(Depot).filter(Depot.proprietaire_id == user_id).all()
    if not depots:
        raise HTTPException(status_code=404, detail="Aucun dépôt trouvé pour cet utilisateur")
    return depots


# ── GET /{depot_id} ───────────────────────────────────────────────
# INCHANGÉ
@router.get("/{depot_id}", response_model=DepotResponse)
def get_depot(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    return depot


# ── PUT /{depot_id} ───────────────────────────────────────────────
# CHANGEMENT : .dict() → .model_dump() pour Pydantic V2
@router.put("/{depot_id}", response_model=DepotResponse)
def update_depot(depot_id: int, depot_update: DepotUpdate, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    # CHANGEMENT : .dict() est déprécié en Pydantic V2 → .model_dump()
    for field, value in depot_update.model_dump(exclude_unset=True).items():
        setattr(depot, field, value)

    db.commit()
    db.refresh(depot)
    return depot


# ── DELETE /{depot_id} ────────────────────────────────────────────
# INCHANGÉ
@router.delete("/{depot_id}")
def delete_depot(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    db.delete(depot)
    db.commit()
    return {"detail": "Dépôt supprimé avec succès"}


# ── GET /{depot_id}/compare ───────────────────────────────────────
# CHANGEMENT MAJEUR : tout le bloc requests.get() manuel a été
# supprimé et remplacé par un seul appel à compare_branches()
# du service gitlab_client.py
# Le format de réponse JSON est identique → frontend inchangé
@router.get("/{depot_id}/compare")
def compare_depot(
    depot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # CHANGEMENT : auth requise
):
    """
    Compare les deux branches du dépôt.
    Utilise python-gitlab via gitlab_client.compare_branches()
    au lieu de requests.get() manuel.
    """
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    try:
        # CHANGEMENT : appel au service au lieu du code inline avec requests
        result = compare_branches(
            token=depot.token_gitlab,           # token stocké en base
            project_name=depot.nom,             # nom saisi dans le formulaire
            from_branch=depot.url_branche_principale,
            to_branch=depot.url_branche_developpement
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


# ── GET /{depot_id}/files ─────────────────────────────────────────
# NOUVEAU : endpoint pour récupérer tous les fichiers d'une branche
# Sera utilisé par l'analyse LLM (prochaine étape)
@router.get("/{depot_id}/files")
def get_depot_files(
    depot_id: int,
    branch: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    NOUVEAU : Récupère le contenu de tous les fichiers du dépôt
    sur la branche principale (ou une branche spécifiée).
    Prépare les données pour l'analyse LLM.
    """
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")

    # Utilise la branche principale par défaut
    target_branch = branch or depot.url_branche_principale

    try:
        # Récupère les fichiers source via python-gitlab
        fichiers = get_project_files(
            token=depot.token_gitlab,
            project_name=depot.nom,
            branch=target_branch,
            # Filtre sur les extensions de code source
            extensions=[".py", ".js", ".ts", ".java", ".go", ".rb", ".php", ".cpp", ".cs"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "depot_id": depot_id,
        "branch": target_branch,
        "total_files": len(fichiers),
        "files": fichiers
    }