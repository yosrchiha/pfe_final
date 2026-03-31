# backend/app/schemas/test_genere.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TestGenereCreate(BaseModel):
    """Schéma pour la création d'un test généré"""
    analyse_id       : int
    depot_analyse_id : int
    langage          : str
    framework        : Optional[str] = ""
    nom_fichier      : str
    contenu          : str
    nb_tests         : int = 0
    nb_lots          : int = 1
    statut           : str = "genere"  # genere | pousse | echoue
    branche_cible    : Optional[str] = None


class TestGenereUpdate(BaseModel):
    """Schéma pour la mise à jour d'un test généré"""
    langage          : Optional[str] = None
    framework        : Optional[str] = None
    nom_fichier      : Optional[str] = None
    contenu          : Optional[str] = None
    nb_tests         : Optional[int] = None
    nb_lots          : Optional[int] = None
    statut           : Optional[str] = None
    branche_cible    : Optional[str] = None


class TestGenereResponse(BaseModel):
    """Schéma pour la réponse (lecture d'un test généré)"""
    id               : int
    analyse_id       : int
    depot_analyse_id : int
    langage          : str
    framework        : Optional[str]
    nom_fichier      : str
    contenu          : Optional[str] = None  # Optionnel pour la liste
    nb_tests         : int
    nb_lots          : int
    statut           : str
    branche_cible    : Optional[str]
    created_at       : datetime

    model_config = {"from_attributes": True}