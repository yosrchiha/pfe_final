from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.models.depot import Depot
from app.models.comparaison import Comparaison
from app.models.analyse_diff import AnalyseDiff
from app.models.merge_request_diff import MergeRequestDiff

router = APIRouter(prefix="/analyses-diff", tags=["Analyses Diff"])


# ============================================
# SCHÉMAS PYDANTIC
# ============================================
class AnalyseDiffBase(BaseModel):
    comparaison_id: int
    statut: str = "en_cours"
    resultat_statut: Optional[str] = None
    score_qualite: Optional[int] = None
    score_securite: Optional[int] = None
    score_performance: Optional[int] = None
    vulnerabilites: Optional[dict] = None
    vulnerabilites_bloquantes: Optional[dict] = None
    recommandations: Optional[dict] = None
    mr_created: int = 0
    mr_id: Optional[int] = None
    mr_url: Optional[str] = None
    mr_title: Optional[str] = None

class AnalyseDiffCreate(AnalyseDiffBase):
    pass

class AnalyseDiffResponse(AnalyseDiffBase):
    id: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AnalyseDiffDetailResponse(AnalyseDiffResponse):
    comparaison_details: Optional[dict] = None
    depot_nom: Optional[str] = None
    merge_requests: Optional[List[dict]] = None


# ============================================
# ENDPOINTS
# ============================================

# ── GET /analyses-diff ──────────────────────────────────────────────
@router.get("/", response_model=List[AnalyseDiffResponse])
def get_all_analyses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les analyses de l'utilisateur connecté.
    """
    # Récupérer les dépôts de l'utilisateur
    depots = db.query(Depot).filter(Depot.proprietaire_id == current_user.id).all()
    depot_ids = [d.id for d in depots]
    
    if not depot_ids:
        return []
    
    # Récupérer les comparaisons des dépôts
    comparaisons = db.query(Comparaison).filter(Comparaison.depot_id.in_(depot_ids)).all()
    comparaison_ids = [c.id for c in comparaisons]
    
    if not comparaison_ids:
        return []
    
    analyses = db.query(AnalyseDiff).filter(
        AnalyseDiff.comparaison_id.in_(comparaison_ids)
    ).order_by(desc(AnalyseDiff.created_at)).offset(skip).limit(limit).all()
    
    return analyses


# ── GET /analyses-diff/{id} ─────────────────────────────────────────
@router.get("/{id}", response_model=AnalyseDiffDetailResponse)
def get_analyse(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère une analyse par son ID.
    """
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    # Vérifier l'accès
    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Récupérer les MR associées
    merge_requests = db.query(MergeRequestDiff).filter(
        MergeRequestDiff.analyse_diff_id == analyse.id
    ).all()
    
    return AnalyseDiffDetailResponse(
        id=analyse.id,
        comparaison_id=analyse.comparaison_id,
        statut=analyse.statut,
        resultat_statut=analyse.resultat_statut,
        score_qualite=analyse.score_qualite,
        score_securite=analyse.score_securite,
        score_performance=analyse.score_performance,
        vulnerabilites=analyse.vulnerabilites,
        vulnerabilites_bloquantes=analyse.vulnerabilites_bloquantes,
        recommandations=analyse.recommandations,
        mr_created=analyse.mr_created,
        mr_id=analyse.mr_id,
        mr_url=analyse.mr_url,
        mr_title=analyse.mr_title,
        created_at=analyse.created_at,
        completed_at=analyse.completed_at,
        comparaison_details={
            "id": comparaison.id,
            "from_branch": comparaison.from_branch,
            "to_branch": comparaison.to_branch,
            "commits_count": comparaison.commits_count,
            "created_at": comparaison.created_at.isoformat()
        },
        depot_nom=depot.nom,
        merge_requests=[
            {
                "id": mr.id,
                "mr_id_gitlab": mr.mr_id_gitlab,
                "mr_iid_gitlab": mr.mr_iid_gitlab,
                "mr_url": mr.mr_url,
                "title": mr.title,
                "state": mr.state,
                "type_mr": mr.type_mr,
                "created_at": mr.created_at.isoformat()
            }
            for mr in merge_requests
        ] if merge_requests else None
    )


# ── GET /analyses-diff/comparaison/{comparaison_id} ─────────────────
@router.get("/comparaison/{comparaison_id}", response_model=List[AnalyseDiffResponse])
def get_analyses_by_comparaison(
    comparaison_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère toutes les analyses d'une comparaison spécifique.
    """
    comparaison = db.query(Comparaison).filter(Comparaison.id == comparaison_id).first()
    if not comparaison:
        raise HTTPException(status_code=404, detail="Comparaison non trouvée")
    
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    analyses = db.query(AnalyseDiff).filter(
        AnalyseDiff.comparaison_id == comparaison_id
    ).order_by(desc(AnalyseDiff.created_at)).all()
    
    return analyses


# ── GET /analyses-diff/{id}/vulnerabilites ──────────────────────────
@router.get("/{id}/vulnerabilites")
def get_analyse_vulnerabilites(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère uniquement les vulnérabilités d'une analyse.
    """
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    return {
        "analyse_id": id,
        "vulnerabilites": analyse.vulnerabilites,
        "vulnerabilites_bloquantes": analyse.vulnerabilites_bloquantes,
        "recommandations": analyse.recommandations,
        "total_vulnerabilites": len(analyse.vulnerabilites) if analyse.vulnerabilites else 0,
        "total_bloquantes": len(analyse.vulnerabilites_bloquantes) if analyse.vulnerabilites_bloquantes else 0
    }


# ── GET /analyses-diff/stats ────────────────────────────────────────
@router.get("/stats/summary")
def get_analyses_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Statistiques globales des analyses de l'utilisateur.
    """
    # Récupérer les dépôts de l'utilisateur
    depots = db.query(Depot).filter(Depot.proprietaire_id == current_user.id).all()
    depot_ids = [d.id for d in depots]
    
    if not depot_ids:
        return {
            "total_analyses": 0,
            "average_qualite": 0,
            "average_securite": 0,
            "average_performance": 0,
            "mr_created_count": 0,
            "merge_autorise_count": 0,
            "merge_bloque_count": 0,
            "aucun_changement_count": 0
        }
    
    # Récupérer les comparaisons
    comparaisons = db.query(Comparaison).filter(Comparaison.depot_id.in_(depot_ids)).all()
    comparaison_ids = [c.id for c in comparaisons]
    
    if not comparaison_ids:
        return {
            "total_analyses": 0,
            "average_qualite": 0,
            "average_securite": 0,
            "average_performance": 0,
            "mr_created_count": 0,
            "merge_autorise_count": 0,
            "merge_bloque_count": 0,
            "aucun_changement_count": 0
        }
    
    analyses = db.query(AnalyseDiff).filter(AnalyseDiff.comparaison_id.in_(comparaison_ids)).all()
    
    if not analyses:
        return {
            "total_analyses": 0,
            "average_qualite": 0,
            "average_securite": 0,
            "average_performance": 0,
            "mr_created_count": 0,
            "merge_autorise_count": 0,
            "merge_bloque_count": 0,
            "aucun_changement_count": 0
        }
    
    total = len(analyses)
    
    # Moyennes des scores
    avg_qualite = sum(a.score_qualite for a in analyses if a.score_qualite) / total if total > 0 else 0
    avg_securite = sum(a.score_securite for a in analyses if a.score_securite) / total if total > 0 else 0
    avg_performance = sum(a.score_performance for a in analyses if a.score_performance) / total if total > 0 else 0
    
    # Comptage par résultat
    merge_autorise = sum(1 for a in analyses if a.resultat_statut == "merge_autorise")
    merge_bloque = sum(1 for a in analyses if a.resultat_statut == "merge_bloque")
    aucun_changement = sum(1 for a in analyses if a.resultat_statut == "aucun_changement")
    
    # MR créées
    mr_created = sum(1 for a in analyses if a.mr_created == 1)
    
    return {
        "total_analyses": total,
        "average_qualite": round(avg_qualite, 2),
        "average_securite": round(avg_securite, 2),
        "average_performance": round(avg_performance, 2),
        "mr_created_count": mr_created,
        "merge_autorise_count": merge_autorise,
        "merge_bloque_count": merge_bloque,
        "aucun_changement_count": aucun_changement
    }


# ── DELETE /analyses-diff/{id} ──────────────────────────────────────
@router.delete("/{id}")
def delete_analyse(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Supprime une analyse (cascade supprime aussi les MR associées).
    """
    analyse = db.query(AnalyseDiff).filter(AnalyseDiff.id == id).first()
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    comparaison = db.query(Comparaison).filter(Comparaison.id == analyse.comparaison_id).first()
    depot = db.query(Depot).filter(Depot.id == comparaison.depot_id).first()
    
    if depot.proprietaire_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    db.delete(analyse)
    db.commit()
    
    return {"message": "Analyse supprimée avec succès"}