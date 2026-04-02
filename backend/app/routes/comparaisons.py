from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pydantic import BaseModel
from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.models.depot import Depot
from app.models.comparaison import Comparaison
from app.models.analyse_diff import AnalyseDiff
from app.schemas.comparaison import ComparaisonResponse

router = APIRouter(prefix="/comparaisons", tags=["Comparaisons"])


class AnalyseSimpleResponse(BaseModel):
    id: int
    statut: str
    resultat_statut: str | None
    score_qualite: int | None
    score_securite: int | None
    score_performance: int | None
    vulnerabilites_count: int
    mr_created: int
    mr_url: str | None
    mr_title: str | None
    created_at: datetime
    completed_at: datetime | None


@router.get("/depot/{depot_id}", response_model=List[ComparaisonResponse])
def get_comparaisons_by_depot(
    depot_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère toutes les comparaisons d'un dépôt."""
    # Vérifier que le dépôt existe
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    
    # Vérifier l'accès
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Récupérer les comparaisons
    comparaisons = db.query(Comparaison).filter(
        Comparaison.depot_id == depot_id
    ).order_by(Comparaison.created_at.desc()).offset(skip).limit(limit).all()
    
    return comparaisons


@router.get("/{id}/analyses", response_model=List[AnalyseSimpleResponse])
def get_comparaison_analyses(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère toutes les analyses associées à une comparaison."""
    # Vérifier que la comparaison existe
    comparaison = db.query(Comparaison).filter(Comparaison.id == id).first()
    if not comparaison:
        raise HTTPException(status_code=404, detail="Comparaison non trouvée")
    
    # Vérifier l'accès via le dépôt
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Récupérer les analyses
    analyses = db.query(AnalyseDiff).filter(
        AnalyseDiff.comparaison_id == id
    ).order_by(AnalyseDiff.created_at.desc()).all()
    
    return [
        {
            "id": a.id,
            "statut": a.statut,
            "resultat_statut": a.resultat_statut,
            "score_qualite": a.score_qualite,
            "score_securite": a.score_securite,
            "score_performance": a.score_performance,
            "vulnerabilites_count": len(a.vulnerabilites) if a.vulnerabilites else 0,
            "mr_created": a.mr_created,
            "mr_url": a.mr_url,
            "mr_title": a.mr_title,
            "created_at": a.created_at,
            "completed_at": a.completed_at
        }
        for a in analyses
    ]