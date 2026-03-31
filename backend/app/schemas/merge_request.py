# backend/app/schemas/merge_request.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MergeRequestCreate(BaseModel):
    """Schéma pour la création d'une Merge Request"""
    analyse_id       : int
    test_id          : Optional[int] = None
    depot_analyse_id : int
    mr_id_gitlab     : int
    mr_url           : str
    titre            : str
    description      : Optional[str] = None
    branche_source   : str
    branche_cible    : str
    statut           : str = "opened"  # opened | merged | closed
    type_mr          : str = "tests"   # tests | auto_merge | diff
    labels           : Optional[str] = None


class MergeRequestUpdate(BaseModel):
    """Schéma pour la mise à jour d'une Merge Request"""
    mr_id_gitlab     : Optional[int] = None
    mr_url           : Optional[str] = None
    titre            : Optional[str] = None
    description      : Optional[str] = None
    branche_source   : Optional[str] = None
    branche_cible    : Optional[str] = None
    statut           : Optional[str] = None
    type_mr          : Optional[str] = None
    labels           : Optional[str] = None


class MergeRequestResponse(BaseModel):
    """Schéma pour la réponse (lecture d'une Merge Request)"""
    id               : int
    analyse_id       : int
    test_id          : Optional[int]
    depot_analyse_id : int
    mr_id_gitlab     : int
    mr_url           : str
    titre            : str
    description      : Optional[str]
    branche_source   : str
    branche_cible    : str
    statut           : str
    type_mr          : str
    labels           : Optional[str]
    created_at       : datetime
    updated_at       : Optional[datetime]

    model_config = {"from_attributes": True}