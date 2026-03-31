# backend/app/schemas/recommandation.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RecommandationCreate(BaseModel):
    """Schéma pour la création d'une recommandation"""
    analyse_id: int
    titre: str
    description: str
    priorite: str
    categorie: str
    fichier: Optional[str] = None
    ligne: Optional[int] = None


class RecommandationUpdate(BaseModel):
    """Schéma pour la mise à jour d'une recommandation"""
    appliquee: Optional[bool] = None
    appliquee_le: Optional[datetime] = None


class RecommandationResponse(BaseModel):
    """Schéma pour la réponse"""
    id: int
    analyse_id: int
    titre: str
    description: str
    priorite: str
    categorie: str
    appliquee: bool
    appliquee_le: Optional[datetime]
    fichier: Optional[str]
    ligne: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}