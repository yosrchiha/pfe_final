# backend/app/schemas/mr_exploration.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class MrExplorationCreate(BaseModel):
    projet_nom: str
    projet_chemin: str
    branche_source: str
    branche_cible: str
    titre: str
    description: Optional[str] = None
    mr_id_gitlab: int
    mr_iid_gitlab: int
    mr_url: str
    fichiers_modifies: Optional[List[str]] = None

class MrExplorationResponse(BaseModel):
    id: int
    user_id: int
    projet_nom: str
    projet_chemin: str
    branche_source: str
    branche_cible: str
    titre: str
    description: Optional[str]
    mr_id_gitlab: int
    mr_iid_gitlab: int
    mr_url: str
    statut: str
    created_at: datetime
    merged_at: Optional[datetime]
    closed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class MrExplorationListResponse(BaseModel):
    id: int
    projet_nom: str
    projet_chemin: str
    branche_source: str
    branche_cible: str
    titre: str
    mr_iid_gitlab: int
    mr_url: str
    statut: str
    created_at: datetime
    
    class Config:
        from_attributes = True