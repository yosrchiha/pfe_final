# backend/app/routes/recommandations.py
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.config.database import get_db
from app.models.recommandation import Recommandation
from app.models.analyse import Analyse
from app.models.depot_analyse import DepotAnalyse
from app.schemas.recommandation import (
    RecommandationCreate,
    RecommandationUpdate,
    RecommandationResponse
)
from app.routes.analyses import get_user_id_from_token

router = APIRouter(prefix="/recommandations", tags=["Recommandations"])


def _format_reco(reco: Recommandation) -> dict:
    return {
        "id": reco.id,
        "analyse_id": reco.analyse_id,
        "titre": reco.titre,
        "description": reco.description,
        "priorite": reco.priorite,
        "categorie": reco.categorie,
        "appliquee": reco.appliquee,
        "appliquee_le": str(reco.appliquee_le) if reco.appliquee_le else None,
        "fichier": reco.fichier,
        "ligne": reco.ligne,
        "created_at": str(reco.created_at),
        "updated_at": str(reco.updated_at) if reco.updated_at else None,
    }


# ════════════════════════════════════════════════════════
# GET /recommandations/
# Toutes les recommandations de l'utilisateur connecté
# ════════════════════════════════════════════════════════
@router.get("/", response_model=List[RecommandationResponse])
def get_recommandations(
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    # Récupérer les analyses de l'utilisateur
    analyses_ids = [
        a.id for a in db.query(Analyse).join(
            DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
        ).filter(DepotAnalyse.user_id == user_id).all()
    ]
    
    recos = db.query(Recommandation).filter(
        Recommandation.analyse_id.in_(analyses_ids)
    ).order_by(
        Recommandation.created_at.desc()
    ).all()
    
    return recos


# ════════════════════════════════════════════════════════
# GET /recommandations/analyse/{analyse_id}
# Recommandations d'une analyse spécifique
# ════════════════════════════════════════════════════════
@router.get("/analyse/{analyse_id}", response_model=List[RecommandationResponse])
def get_recommandations_by_analyse(
    analyse_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    # Vérifier que l'utilisateur a accès à l'analyse
    analyse = db.query(Analyse).join(
        DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
    ).filter(
        Analyse.id == analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    recos = db.query(Recommandation).filter(
        Recommandation.analyse_id == analyse_id
    ).order_by(
        Recommandation.priorite.desc(),
        Recommandation.created_at.desc()
    ).all()
    
    return recos


# ════════════════════════════════════════════════════════
# GET /recommandations/{reco_id}
# Détail d'une recommandation
# ════════════════════════════════════════════════════════
@router.get("/{reco_id}", response_model=RecommandationResponse)
def get_recommandation(
    reco_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    reco = db.query(Recommandation).join(
        Analyse, Recommandation.analyse_id == Analyse.id
    ).join(
        DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
    ).filter(
        Recommandation.id == reco_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not reco:
        raise HTTPException(status_code=404, detail="Recommandation introuvable")
    
    return reco


# ════════════════════════════════════════════════════════
# PATCH /recommandations/{reco_id}/apply
# Marquer une recommandation comme appliquée
# ════════════════════════════════════════════════════════
@router.patch("/{reco_id}/apply")
def apply_recommandation(
    reco_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    reco = db.query(Recommandation).join(
        Analyse, Recommandation.analyse_id == Analyse.id
    ).join(
        DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
    ).filter(
        Recommandation.id == reco_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not reco:
        raise HTTPException(status_code=404, detail="Recommandation introuvable")
    
    reco.appliquee = True
    reco.appliquee_le = datetime.now()
    db.commit()
    
    return {
        "id": reco.id,
        "appliquee": reco.appliquee,
        "appliquee_le": str(reco.appliquee_le),
        "message": "Recommandation marquée comme appliquée"
    }


# ════════════════════════════════════════════════════════
# POST /recommandations/ (admin/backup)
# Créer une recommandation manuellement
# ════════════════════════════════════════════════════════
@router.post("/", response_model=RecommandationResponse)
def create_recommandation(
    data: RecommandationCreate,
    db: Session = Depends(get_db),
    authorization: str = Header(None)
):
    user_id = get_user_id_from_token(authorization, db)
    
    # Vérifier que l'utilisateur a accès à l'analyse
    analyse = db.query(Analyse).join(
        DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
    ).filter(
        Analyse.id == data.analyse_id,
        DepotAnalyse.user_id == user_id
    ).first()
    
    if not analyse:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    
    reco = Recommandation(
        analyse_id=data.analyse_id,
        titre=data.titre,
        description=data.description,
        priorite=data.priorite,
        categorie=data.categorie,
        fichier=data.fichier,
        ligne=data.ligne
    )
    db.add(reco)
    db.commit()
    db.refresh(reco)
    
    return reco