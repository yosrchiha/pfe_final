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