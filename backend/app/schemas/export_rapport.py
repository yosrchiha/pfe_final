# backend/app/schemas/export_rapport.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExportRapportCreate(BaseModel):
    """Schéma pour la création d'un export"""
    analyse_id: int
    format: str
    chemin_fichier: Optional[str] = None
    taille: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ExportRapportResponse(BaseModel):
    """Schéma pour la réponse"""
    id: int
    analyse_id: int
    user_id: int
    format: str
    chemin_fichier: Optional[str]
    taille: Optional[int]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}