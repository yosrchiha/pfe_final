# backend/app/schemas/issue_gitlab.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class IssueGitLabCreate(BaseModel):
    """Schéma pour la création d'une issue"""
    analyse_id       : int
    depot_analyse_id : int
    issue_id_gitlab  : int
    issue_url        : str
    titre            : str
    description      : Optional[str] = None
    severite         : str
    type_vuln        : str
    fichier          : str
    ligne            : int
    statut           : str = "opened"
    labels           : Optional[str] = None


class IssueGitLabUpdate(BaseModel):
    """Schéma pour la mise à jour d'une issue"""
    statut           : Optional[str] = None
    description      : Optional[str] = None


class IssueGitLabResponse(BaseModel):
    """Schéma pour la réponse"""
    id               : int
    analyse_id       : int
    depot_analyse_id : int
    issue_id_gitlab  : int
    issue_url        : str
    titre            : str
    description      : Optional[str]
    severite         : str
    type_vuln        : str
    fichier          : str
    ligne            : int
    statut           : str
    labels           : Optional[str]
    created_at       : datetime
    updated_at       : Optional[datetime]

    model_config = {"from_attributes": True}