from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.models.analyse_fichier import AnalyseFichier
from app.services.llm_service import analyser_code

router = APIRouter(prefix="/analyses-fichier", tags=["Analyses Fichier"])


class AnalyseFichierRequest(BaseModel):
    projet_nom: str
    fichier_path: str
    contenu: str
    branche: str


class AnalyseFichierResponse(BaseModel):
    id: int
    fichier: str
    score_qualite: Optional[int]
    score_securite: Optional[int]
    score_performance: Optional[int]
    vulnerabilites: Optional[list]
    recommandations: Optional[list]
    analysee_le: datetime
    statut: str


@router.post("/", response_model=AnalyseFichierResponse)
def analyser_fichier(
    data: AnalyseFichierRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyse un fichier spécifique avec l'IA"""
    
    # Vérifier si une analyse existe déjà pour ce fichier
    existing = db.query(AnalyseFichier).filter(
        AnalyseFichier.user_id == current_user.id,
        AnalyseFichier.projet_nom == data.projet_nom,
        AnalyseFichier.fichier_path == data.fichier_path,
        AnalyseFichier.statut == "termine"
    ).first()
    
    if existing:
        # Retourner l'analyse existante
        return AnalyseFichierResponse(
            id=existing.id,
            fichier=existing.fichier_path,
            score_qualite=existing.score_qualite,
            score_securite=existing.score_securite,
            score_performance=existing.score_performance,
            vulnerabilites=existing.vulnerabilites,
            recommandations=existing.recommandations,
            analysee_le=existing.analysee_le,
            statut=existing.statut
        )
    
    # Créer l'entrée en base avec statut en_cours
    analyse = AnalyseFichier(
        user_id=current_user.id,
        projet_nom=data.projet_nom,
        branche=data.branche,
        fichier_path=data.fichier_path,
        contenu=data.contenu,
        statut="en_cours"
    )
    db.add(analyse)
    db.commit()
    db.refresh(analyse)
    
    try:
        # Analyser le fichier avec l'IA
        fichiers_llm = [{
            "file_path": data.fichier_path,
            "content": data.contenu
        }]
        
        resultat = analyser_code(fichiers_llm, owasp_enabled=True)
        
        # Mettre à jour l'analyse
        analyse.score_qualite = resultat.get("score_qualite", 0)
        analyse.score_securite = resultat.get("score_securite", 0)
        analyse.score_performance = resultat.get("score_performance", 0)
        analyse.vulnerabilites = resultat.get("vulnerabilites", [])
        analyse.recommandations = resultat.get("recommandations", [])
        analyse.statut = "termine"
        db.commit()
        
    except Exception as e:
        analyse.statut = "erreur"
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))
    
    return AnalyseFichierResponse(
        id=analyse.id,
        fichier=analyse.fichier_path,
        score_qualite=analyse.score_qualite,
        score_securite=analyse.score_securite,
        score_performance=analyse.score_performance,
        vulnerabilites=analyse.vulnerabilites,
        recommandations=analyse.recommandations,
        analysee_le=analyse.analysee_le,
        statut=analyse.statut
    )


@router.get("/projet/{projet_nom}", response_model=List[AnalyseFichierResponse])
def get_analyses_par_projet(
    projet_nom: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère toutes les analyses de fichiers pour un projet"""
    
    analyses = db.query(AnalyseFichier).filter(
        AnalyseFichier.user_id == current_user.id,
        AnalyseFichier.projet_nom == projet_nom,
        AnalyseFichier.statut == "termine"
    ).order_by(AnalyseFichier.analysee_le.desc()).all()
    
    return [
        AnalyseFichierResponse(
            id=a.id,
            fichier=a.fichier_path,
            score_qualite=a.score_qualite,
            score_securite=a.score_securite,
            score_performance=a.score_performance,
            vulnerabilites=a.vulnerabilites,
            recommandations=a.recommandations,
            analysee_le=a.analysee_le,
            statut=a.statut
        )
        for a in analyses
    ]


@router.get("/fichier/{fichier_path:path}")
def get_analyse_fichier(
    fichier_path: str,
    projet_nom: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère l'analyse d'un fichier spécifique"""
    
    analyse = db.query(AnalyseFichier).filter(
        AnalyseFichier.user_id == current_user.id,
        AnalyseFichier.projet_nom == projet_nom,
        AnalyseFichier.fichier_path == fichier_path,
        AnalyseFichier.statut == "termine"
    ).order_by(AnalyseFichier.analysee_le.desc()).first()
    
    if not analyse:
        return None
    
    return {
        "id": analyse.id,
        "score_qualite": analyse.score_qualite,
        "score_securite": analyse.score_securite,
        "score_performance": analyse.score_performance,
        "vulnerabilites": analyse.vulnerabilites,
        "recommandations": analyse.recommandations,
        "analysee_le": analyse.analysee_le,
        "statut": analyse.statut
    }