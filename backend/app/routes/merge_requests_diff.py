# backend/app/routes/merge_requests_diff.py

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

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


# ═══════════════════════════════════════════════════════════════════
# ROUTE POUR RÉCUPÉRER TOUTES LES MR DIFF D'UN DÉPÔT
# ═══════════════════════════════════════════════════════════════════
@router.get("/depot/{depot_id}", response_model=List[MergeRequestDiffDetailResponse])
def get_merge_requests_by_depot(
    depot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les Merge Requests de diff (forcées et auto) pour un dépôt donné.
    """
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt non trouvé")
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    mrs = db.query(MergeRequestDiff).filter(
        MergeRequestDiff.depot_id == depot_id
    ).order_by(MergeRequestDiff.created_at.desc()).all()
    
    result = []
    for mr in mrs:
        analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == mr.analyse_diff_id).first()
        
        result.append({
            "id": mr.id,
            "analyse_diff_id": mr.analyse_diff_id,
            "depot_id": mr.depot_id,
            "mr_id_gitlab": mr.mr_id_gitlab,
            "mr_iid_gitlab": mr.mr_iid_gitlab,
            "mr_url": mr.mr_url,
            "title": mr.title,
            "description": mr.description,
            "source_branch": mr.source_branch,
            "target_branch": mr.target_branch,
            "state": mr.state,
            "type_mr": mr.type_mr,
            "created_at": mr.created_at.isoformat(),
            "projet_nom": depot.nom,
            "analyse_score_qualite": analyse.score_qualite if analyse else None,
            "analyse_score_securite": analyse.score_securite if analyse else None,
            "analyse_score_performance": analyse.score_performance if analyse else None,
            "analyse_resultat_statut": analyse.resultat_statut if analyse else None,
        })
    
    return result


# ── GET /analyse/{analyse_diff_id} ──────────────────────────────────
@router.get("/analyse/{analyse_diff_id}", response_model=List[MergeRequestDiffResponse])
def get_merge_requests_by_analyse(
    analyse_diff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère toutes les Merge Requests de diff pour une analyse donnée."""
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == analyse_diff_id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    mrs = db.query(MergeRequestDiff).filter(
        MergeRequestDiff.analyse_diff_id == analyse_diff_id
    ).order_by(MergeRequestDiff.created_at.desc()).all()
    
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
    """Récupère les détails d'une Merge Request de diff spécifique."""
    mr = db.query(MergeRequestDiff).filter(MergeRequestDiff.id == id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request non trouvée")
    
    depot = db.query(Depot).filter(Depot.id == mr.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == mr.analyse_diff_id).first()
    
    return {
        "id": mr.id,
        "analyse_diff_id": mr.analyse_diff_id,
        "depot_id": mr.depot_id,
        "mr_id_gitlab": mr.mr_id_gitlab,
        "mr_iid_gitlab": mr.mr_iid_gitlab,
        "mr_url": mr.mr_url,
        "title": mr.title,
        "description": mr.description,
        "source_branch": mr.source_branch,
        "target_branch": mr.target_branch,
        "state": mr.state,
        "type_mr": mr.type_mr,
        "created_at": mr.created_at.isoformat(),
        "projet_nom": depot.nom,
        "analyse_score_qualite": analyse.score_qualite if analyse else None,
        "analyse_score_securite": analyse.score_securite if analyse else None,
        "analyse_score_performance": analyse.score_performance if analyse else None,
        "analyse_resultat_statut": analyse.resultat_statut if analyse else None,
    }


# ── PUT /{id}/sync ─────────────────────────────────────────────────
@router.put("/{id}/sync")
def sync_merge_request_status(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Synchronise le statut d'une MR avec GitLab."""
    mr = db.query(MergeRequestDiff).filter(MergeRequestDiff.id == id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request non trouvée")
    
    depot = db.query(Depot).filter(Depot.id == mr.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    try:
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
        gitlab_mr = project.mergerequests.get(mr.mr_iid_gitlab)
        
        mr.state = gitlab_mr.state
        db.commit()
        
        return {"statut": gitlab_mr.state}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur synchronisation: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# ROUTES POUR FERMER / RÉOUVRIR UNE MR
# ═══════════════════════════════════════════════════════════════════
@router.put("/{id}/close")
def close_merge_request_diff(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ferme une Merge Request de diff."""
    mr = db.query(MergeRequestDiff).filter(MergeRequestDiff.id == id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request non trouvée")
    
    depot = db.query(Depot).filter(Depot.id == mr.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    try:
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
        gitlab_mr = project.mergerequests.get(mr.mr_iid_gitlab)
        gitlab_mr.state_event = "close"
        gitlab_mr.save()
        
        mr.state = "closed"
        db.commit()
        
        return {"statut": "closed", "message": "Merge Request fermée avec succès"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur fermeture MR: {str(e)}")


@router.put("/{id}/reopen")
def reopen_merge_request_diff(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rouvre une Merge Request de diff."""
    mr = db.query(MergeRequestDiff).filter(MergeRequestDiff.id == id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request non trouvée")
    
    depot = db.query(Depot).filter(Depot.id == mr.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    try:
        project = get_gitlab_project(depot.token_gitlab, depot.nom)
        gitlab_mr = project.mergerequests.get(mr.mr_iid_gitlab)
        gitlab_mr.state_event = "reopen"
        gitlab_mr.save()
        
        mr.state = "opened"
        db.commit()
        
        return {"statut": "opened", "message": "Merge Request réouverte avec succès"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur réouverture MR: {str(e)}")