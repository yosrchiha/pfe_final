from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.config.database import get_db
from app.routes.auth import get_current_user
from app.models.user import User
from app.models.feedback import Feedback
from app.models.analyse import Analyse

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackCreate(BaseModel):
    analyse_id: Optional[int] = None
    rating: int
    category: str
    comment: Optional[str] = None
    projet_nom: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    rating: int
    category: str
    comment: Optional[str]
    projet_nom: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


@router.post("/", response_model=FeedbackResponse)
def create_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crée un nouveau feedback pour une analyse.
    """
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="La note doit être entre 1 et 5")
    
    valid_categories = ["qualite", "securite", "performance", "tests", "interface", "global"]
    if data.category not in valid_categories:
        raise HTTPException(status_code=400, detail="Catégorie invalide")
    
    # Vérifier que l'analyse existe si un ID est fourni
    if data.analyse_id:
        analyse = db.query(Analyse).filter(Analyse.id == data.analyse_id).first()
        if not analyse:
            raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    feedback = Feedback(
        analyse_id=data.analyse_id,
        user_id=current_user.id,
        rating=data.rating,
        category=data.category,
        comment=data.comment,
        projet_nom=data.projet_nom
    )
    
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    return FeedbackResponse(
        id=feedback.id,
        rating=feedback.rating,
        category=feedback.category,
        comment=feedback.comment,
        projet_nom=feedback.projet_nom,
        created_at=feedback.created_at.isoformat()
    )


@router.get("/", response_model=list[FeedbackResponse])
def get_user_feedbacks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Récupère tous les feedbacks de l'utilisateur connecté.
    """
    feedbacks = db.query(Feedback).filter(Feedback.user_id == current_user.id).order_by(Feedback.created_at.desc()).all()
    
    return [
        FeedbackResponse(
            id=f.id,
            rating=f.rating,
            category=f.category,
            comment=f.comment,
            projet_nom=f.projet_nom,
            created_at=f.created_at.isoformat()
        )
        for f in feedbacks
    ]


@router.get("/stats")
def get_feedback_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Statistiques des feedbacks pour l'admin.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    from sqlalchemy import func
    
    total = db.query(func.count(Feedback.id)).scalar()
    avg_rating = db.query(func.avg(Feedback.rating)).scalar()
    
    by_category = db.query(
        Feedback.category, func.count(Feedback.id), func.avg(Feedback.rating)
    ).group_by(Feedback.category).all()
    
    by_rating = db.query(
        Feedback.rating, func.count(Feedback.id)
    ).group_by(Feedback.rating).order_by(Feedback.rating).all()
    
    return {
        "total": total,
        "average_rating": round(avg_rating, 2) if avg_rating else 0,
        "by_category": [
            {"category": cat, "count": cnt, "average": round(avg, 2) if avg else 0}
            for cat, cnt, avg in by_category
        ],
        "by_rating": [{"rating": r, "count": cnt} for r, cnt in by_rating]
    }
# Ajouter dans backend/app/routes/feedback.py
# UNE SEULE route à ajouter — les autres restent identiques

# ════════════════════════════════════════════════════════
# GET /feedback/public
# Feedbacks anonymisés accessibles SANS authentification
# (pour la landing page)
# ════════════════════════════════════════════════════════
@router.get("/public")
def get_public_feedbacks(
    limit: int = 12,
    db: Session = Depends(get_db)
):
    """
    Retourne les feedbacks récents pour la landing page.
    - Anonymisés : username remplacé par "Utilisateur X"
    - Limité à `limit` résultats (par défaut 12)
    - Triés par date décroissante
    - Retourne uniquement les feedbacks avec note >= 3
      (pour ne montrer que des avis positifs en vitrine)
    """
    feedbacks = (
        db.query(Feedback)
        .filter(Feedback.rating >= 3)
        .order_by(Feedback.created_at.desc())
        .limit(limit)
        .all()
    )

    # Récupérer les usernames depuis la table User
    # sans exposer l'email complet
    result = []
    for i, f in enumerate(feedbacks):
        # Récupérer le user pour afficher le prénom seulement
        user = db.query(User).filter(User.id == f.user_id).first()

        # Anonymiser : "Sarah M." depuis "sarah.martin@email.com"
        # ou depuis le username
        if user and user.username:
            display_name = user.username.split("@")[0]  # enlève le domaine si email
            # Capitaliser et raccourcir
            parts = display_name.replace(".", " ").replace("_", " ").split()
            if len(parts) >= 2:
                display_name = f"{parts[0].capitalize()} {parts[1][0].upper()}."
            else:
                display_name = parts[0].capitalize() if parts else f"Utilisateur {i+1}"
        else:
            display_name = f"Utilisateur {i+1}"

        result.append({
            "id":          f.id,
            "rating":      f.rating,
            "category":    f.category,
            "comment":     f.comment,
            "projet_nom":  f.projet_nom,
            "created_at":  f.created_at.isoformat(),
            "username":    display_name,  # anonymisé
        })

    # Stats globales (pour le score moyen affiché en landing)
    from sqlalchemy import func
    total     = db.query(func.count(Feedback.id)).scalar() or 0
    avg_query = db.query(func.avg(Feedback.rating)).scalar()
    avg       = round(float(avg_query), 1) if avg_query else 0.0

    return {
        "feedbacks":    result,
        "total":        total,
        "average":      avg,
        "shown":        len(result),
    }