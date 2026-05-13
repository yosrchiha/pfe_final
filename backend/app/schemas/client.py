# backend/app/schemas/client.py
"""
Schémas Pydantic pour le modèle Client.
Utilisés pour la sérialisation / validation côté API.
L'application ne change pas — ces schémas s'ajoutent sans remplacer UserResponse.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ── Lecture (réponse API) ─────────────────────────────────────────

class ClientBase(BaseModel):
    """Champs communs à tous les schémas Client."""
    id:         int
    email:      EmailStr
    username:   str
    is_active:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientOut(ClientBase):
    """Vue complète d'un client (utilisée dans les endpoints admin)."""
    role: str = "user"


class ClientSummary(BaseModel):
    """Vue allégée — utile pour les listes."""
    id:       int
    username: str
    email:    EmailStr

    model_config = {"from_attributes": True}


# ── Statistiques d'activité ───────────────────────────────────────

class ClientActivityOut(BaseModel):
    total_depots_analyse: int = 0
    total_analyses:       int = 0
    total_videos:         int = 0
    total_rapports:       int = 0
    total_feedbacks:      int = 0
    derniere_connexion:   Optional[datetime] = None

    model_config = {"from_attributes": True}