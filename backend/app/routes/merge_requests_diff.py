from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.models.merge_request_diff import MergeRequestDiff
from app.models.depot import Depot
from app.models.analyse_diff import AnalyseDiff
from app.models.comparaison import Comparaison
from app.services.gitlab_client import get_gitlab_project

router = APIRouter(prefix="/merge-requests-diff", tags=["Merge Requests Diff"])


# ── Schémas Pydantic ───────────────────────────────────────────────
class MergeRequestDiffResponse(BaseModel):
    id: int
    analyse_diff_id: int
    depot_id: int
    mr_id_gitlab: int
    mr_iid_gitlab: int
    mr_url: str
    title: str
    description: str | None
    source_branch: str
    target_branch: str
    state: str
    type_mr: str
    created_at: str
    
    class Config:
        from_attributes = True


class MergeRequestDiffDetailResponse(MergeRequestDiffResponse):
    projet_nom: str | None = None
    analyse_score_qualite: int | None = None
    analyse_score_securite: int | None = None
    analyse_score_performance: int | None = None
    analyse_resultat_statut: str | None = None


# ── GET /depot/{depot_id} ──────────────────────────────────────────
@router.get("/depot/{depot_id}", response_model=List[MergeRequestDiffDetailResponse])
def get_merge_requests_by_depot(
    depot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les Merge Requests de diff pour un dépôt donné.
    """
    # Vérifier que le dépôt existe et que l'utilisateur y a accès
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Récupérer les MR de diff
    mrs = db.query(MergeRequestDiff).filter(MergeRequestDiff.depot_id == depot_id).order_by(MergeRequestDiff.created_at.desc()).all()
    
    # Enrichir avec les informations du projet et de l'analyse
    result = []
    for mr in mrs:
        analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == mr.analyse_diff_id).first()
        
        result.append(MergeRequestDiffDetailResponse(
            id=mr.id,
            analyse_diff_id=mr.analyse_diff_id,
            depot_id=mr.depot_id,
            mr_id_gitlab=mr.mr_id_gitlab,
            mr_iid_gitlab=mr.mr_iid_gitlab,
            mr_url=mr.mr_url,
            title=mr.title,
            description=mr.description,
            source_branch=mr.source_branch,
            target_branch=mr.target_branch,
            state=mr.state,
            type_mr=mr.type_mr,
            created_at=mr.created_at.isoformat(),
            projet_nom=depot.nom,
            analyse_score_qualite=analyse.score_qualite if analyse else None,
            analyse_score_securite=analyse.score_securite if analyse else None,
            analyse_score_performance=analyse.score_performance if analyse else None,
            analyse_resultat_statut=analyse.resultat_statut if analyse else None
        ))
    
    return result


# ── GET /analyse/{analyse_diff_id} ──────────────────────────────────
@router.get("/analyse/{analyse_diff_id}", response_model=List[MergeRequestDiffResponse])
def get_merge_requests_by_analyse(
    analyse_diff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les Merge Requests de diff pour une analyse donnée.
    """
    # Vérifier que l'analyse existe
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == analyse_diff_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    # Vérifier l'accès via le dépôt
    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    mrs = db.query(MergeRequestDiff).filter(MergeRequestDiff.analyse_diff_id == analyse_diff_id).order_by(MergeRequestDiff.created_at.desc()).all()
    
    return [
        MergeRequestDiffResponse(
            id=mr.id,
            analyse_diff_id=mr.analyse_diff_id,
            depot_id=mr.depot_id,
            mr_id_gitlab=mr.mr_id_gitlab,
            mr_iid_gitlab=mr.mr_iid_gitlab,
            mr_url=mr.mr_url,
            title=mr.title,
            description=mr.description,
            source_branch=mr.source_branch,
            target_branch=mr.target_branch,
            state=mr.state,
            type_mr=mr.type_mr,
            created_at=mr.created_at.isoformat()
        )
        for mr in mrs
    ]


# ── GET /{id} ──────────────────────────────────────────────────────
@router.get("/{id}", response_model=MergeRequestDiffDetailResponse)
def get_merge_request(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère les détails d'une Merge Request de diff spécifique.
    """
    mr = db.query(MergeRequestDiff).filter(MergeRequestDiff.id == id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request non trouvée")
    
    # Vérifier l'accès
    depot = db.query(Depot).filter(Depot.id == mr.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == mr.analyse_diff_id).first()
    
    return MergeRequestDiffDetailResponse(
        id=mr.id,
        analyse_diff_id=mr.analyse_diff_id,
        depot_id=mr.depot_id,
        mr_id_gitlab=mr.mr_id_gitlab,
        mr_iid_gitlab=mr.mr_iid_gitlab,
        mr_url=mr.mr_url,
        title=mr.title,
        description=mr.description,
        source_branch=mr.source_branch,
        target_branch=mr.target_branch,
        state=mr.state,
        type_mr=mr.type_mr,
        created_at=mr.created_at.isoformat(),
        projet_nom=depot.nom,
        analyse_score_qualite=analyse.score_qualite if analyse else None,
        analyse_score_securite=analyse.score_securite if analyse else None,
        analyse_score_performance=analyse.score_performance if analyse else None,
        analyse_resultat_statut=analyse.resultat_statut if analyse else None
    )


# ── PUT /{id}/sync ─────────────────────────────────────────────────
@router.put("/{id}/sync")
def sync_merge_request_status(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Synchronise le statut d'une MR avec GitLab.
    """
    mr = db.query(MergeRequestDiff).filter(MergeRequestDiff.id == id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request non trouvée")
    
    # Vérifier l'accès
    depot = db.query(Depot).filter(Depot.id == mr.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    try:
        # Récupérer la MR depuis GitLab
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
        gitlab_mr = project.mergerequests.get(mr.mr_iid_gitlab)
        
        # Mettre à jour le statut
        mr.state = gitlab_mr.state
        db.commit()
        
        return {"statut": gitlab_mr.state}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur synchronisation: {str(e)}")