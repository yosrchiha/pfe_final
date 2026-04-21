# backend/app/schemas/correction.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CorrectionCreate(BaseModel):
    projet_nom: str
    fichier_path: str
    branche: str
    vuln_type: str
    vuln_severite: str
    vuln_ligne: int
    vuln_suggestion: Optional[str] = None
    contenu_original: str
    contenu_corrige: str

class CorrectionResponse(BaseModel):
    id: int
    user_id: int
    projet_nom: str
    fichier_path: str
    branche: str
    vuln_type: str
    vuln_severite: str
    vuln_ligne: int
    vuln_suggestion: Optional[str]
    statut: str
    created_at: datetime
    pushed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class CorrectionHistoryResponse(BaseModel):
    id: int
    fichier_path: str
    vuln_type: str
    vuln_severite: str
    vuln_ligne: int
    created_at: datetime
    statut: str