# backend/app/schemas/exploration.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class ExplorationCreate(BaseModel):
    projet_nom: str
    projet_chemin: str
    branche: str
    gitlab_token: str
    total_fichiers: int
    extra_data: Optional[Dict[str, Any]] = None  # ← RENOMMÉ

class ExplorationResponse(BaseModel):
    id: int
    user_id: int
    projet_nom: str
    projet_chemin: str
    branche: str
    total_fichiers: int
    statut: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    extra_data: Optional[Dict[str, Any]] = None  # ← RENOMMÉ
    
    class Config:
        from_attributes = True

class ExplorationListResponse(BaseModel):
    id: int
    projet_nom: str
    projet_chemin: str
    branche: str
    total_fichiers: int
    created_at: datetime
    
    class Config:
        from_attributes = True