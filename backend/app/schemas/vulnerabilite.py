from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VulnerabiliteCreate(BaseModel):
    type: str
    severite: str  # CRITIQUE, HAUTE, MOYENNE, FAIBLE
    description: str
    suggestion: str
    fichier: str
    ligne: int
    colonne: Optional[int] = None
    categorie_owasp: Optional[str] = None
    cwe_id: Optional[str] = None
    code_snippet: Optional[str] = None
    impact: Optional[str] = None


class VulnerabiliteUpdate(BaseModel):
    statut: Optional[str] = None
    suggestion: Optional[str] = None
    description: Optional[str] = None


class VulnerabiliteResponse(BaseModel):
    id: int
    analyse_id: int
    type: str
    severite: str
    description: str
    suggestion: str
    fichier: str
    ligne: int
    colonne: Optional[int] = None
    categorie_owasp: Optional[str] = None
    cwe_id: Optional[str] = None
    statut: str
    code_snippet: Optional[str] = None
    impact: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VulnerabiliteListResponse(BaseModel):
    id: int
    type: str
    severite: str
    fichier: str
    ligne: int
    statut: str
    suggestion: str

    class Config:
        from_attributes = True