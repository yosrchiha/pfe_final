# backend/app/schemas/analyse.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LancerAnalyseRequest(BaseModel):
    nom_projet    : str
    gitlab_token  : str
    project_url   : str
    branche       : str  = "main"
    owasp_enabled : bool = True
    auto_tests    : bool = True
    auto_mr       : bool = True
    seuil_qualite : int  = 60

class AnalyseResponse(BaseModel):
    id                : int
    depot_analyse_id  : Optional[int]
    branche           : Optional[str]
    score_qualite     : Optional[int]
    score_securite    : Optional[int]
    score_performance : Optional[int]
    vulnerabilites    : Optional[list]
    recommandations   : Optional[list]
    statut            : str
    modele_llm        : Optional[str]
    owasp_enabled     : bool
    auto_tests        : bool
    auto_mr           : bool
    seuil_qualite     : int
    created_at        : Optional[datetime]

    model_config = {"from_attributes": True}
