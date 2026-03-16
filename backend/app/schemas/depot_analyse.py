# backend/app/schemas/depot_analyse.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DepotAnalyseCreate(BaseModel):
    nom          : str
    gitlab_token : str
    project_url  : str
    branche      : str = "main"

class DepotAnalyseResponse(BaseModel):
    id          : int
    user_id     : int
    nom         : str
    project_url : str
    branche     : str
    created_at  : Optional[datetime]

    model_config = {"from_attributes": True}