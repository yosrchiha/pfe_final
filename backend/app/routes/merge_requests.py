# backend/app/routes/merge_requests.py
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from app.config.database import get_db
from app.models.merge_request import MergeRequest
from app.models.depot_analyse import DepotAnalyse
from app.schemas.merge_request import MergeRequestResponse
router = APIRouter(prefix="/merge-requests", tags=["Merge Requests"])


def get_user_id_from_token(authorization: str, db: Session):
    """Récupère l'ID utilisateur depuis le token JWT"""
    # Même fonction que dans analyses.py
    import os
    from jose import jwt
    if not authorization:
        return 1
    try:
        token = authorization.replace("Bearer ", "").strip()
        payload = jwt.decode(token, os.getenv("SECRET_KEY", "secret"), algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id:
            return int(user_id)
        sub = payload.get("sub")
        if sub:
            from app.models.user import User
            user = db.query(User).filter(User.email == sub).first()
            if user:
                return user.id
        return 1
    except Exception:
        return 1


def _format_mr(mr: MergeRequest) -> dict:
    return {
        "id"               : mr.id,
        "analyse_id"       : mr.analyse_id,
        "test_id"          : mr.test_id,
        "depot_analyse_id" : mr.depot_analyse_id,
        "mr_id_gitlab"     : mr.mr_id_gitlab,
        "mr_url"           : mr.mr_url,
        "titre"            : mr.titre,
        "description"      : mr.description,
        "branche_source"   : mr.branche_source,
        "branche_cible"    : mr.branche_cible,
        "statut"           : mr.statut,
        "type_mr"          : mr.type_mr,
        "labels"           : mr.labels,
        "created_at"       : str(mr.created_at),
        "updated_at"       : str(mr.updated_at) if mr.updated_at else None,
    }


@router.get("/")
def get_merge_requests(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    mrs = db.query(MergeRequest).join(
        DepotAnalyse, MergeRequest.depot_analyse_id == DepotAnalyse.id
    ).filter(
        DepotAnalyse.user_id == user_id
    ).order_by(
        MergeRequest.created_at.desc()
    ).all()
    
    return [_format_mr(mr) for mr in mrs]


@router.get("/depot/{depot_analyse_id}")
def get_merge_requests_by_depot(
    depot_analyse_id: int,
    db: Session = Depends(get_db)
):
    mrs = db.query(MergeRequest).filter(
        MergeRequest.depot_analyse_id == depot_analyse_id
    ).order_by(MergeRequest.created_at.desc()).all()
    return [_format_mr(mr) for mr in mrs]


@router.get("/{mr_id}")
def get_merge_request(
    mr_id: int,
    db: Session = Depends(get_db)
):
    mr = db.query(MergeRequest).filter(MergeRequest.id == mr_id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request introuvable")
    return _format_mr(mr)


@router.put("/{mr_id}/sync")
def sync_mr_status(
    mr_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    """
    Synchronise le statut d'une MR avec GitLab
    """
    from app.services.gitlab_client import get_gitlab_project
    
    mr = db.query(MergeRequest).filter(MergeRequest.id == mr_id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Merge Request introuvable")
    
    # Récupérer le dépôt
    depot = db.query(DepotAnalyse).filter(DepotAnalyse.id == mr.depot_analyse_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail="Dépôt introuvable")
    
    try:
        # Appeler l'API GitLab pour récupérer le vrai statut
        project = get_gitlab_project(depot.gitlab_token, depot.project_url)
        gitlab_mr = project.mergerequests.get(mr.mr_id_gitlab)
        
        # Mettre à jour le statut en base
        mr.statut = gitlab_mr.state  # "opened", "merged", "closed"
        db.commit()
        
        return {
            "mr_id": mr.id,
            "statut": mr.statut,
            "gitlab_state": gitlab_mr.state
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur synchronisation: {str(e)}")


@router.post("/webhook")
def gitlab_webhook(
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Webhook GitLab — reçoit les événements de MR
    """
    # Vérifier que c'est un événement MR
    if payload.get("object_kind") != "merge_request":
        return {"message": "Ignored"}
    
    mr_data = payload.get("object_attributes", {})
    mr_id_gitlab = mr_data.get("id")
    mr_statut = mr_data.get("state")  # opened, merged, closed
    
    # Chercher la MR en base
    mr_db = db.query(MergeRequest).filter(
        MergeRequest.mr_id_gitlab == mr_id_gitlab
    ).first()
    
    if mr_db:
        # Mettre à jour le statut
        mr_db.statut = mr_statut
        db.commit()
        return {"message": f"MR {mr_id_gitlab} updated to {mr_statut}"}
    
    return {"message": "MR not found in local DB"}