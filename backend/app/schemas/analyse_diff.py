from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any, List

class AnalyseDiffBase(BaseModel):
    comparaison_id: int
    statut: str = "en_cours"
    resultat_statut: Optional[str] = None
    score_qualite: Optional[int] = None
    score_securite: Optional[int] = None
    score_performance: Optional[int] = None
    vulnerabilites: Optional[Any] = None
    vulnerabilites_bloquantes: Optional[Any] = None
    recommandations: Optional[Any] = None
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