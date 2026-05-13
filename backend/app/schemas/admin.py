# backend/app/schemas/admin.py
"""
Schémas Pydantic pour le modèle Admin.
"""

from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, EmailStr


# ── Lecture (réponse API) ─────────────────────────────────────────

class AdminBase(BaseModel):
    """Champs communs à tous les schémas Admin."""
    id:         int
    email:      EmailStr
    username:   str
    is_active:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminOut(AdminBase):
    """Vue complète d'un admin."""
    role: str = "admin"


class AdminSummary(BaseModel):
    """Vue allégée."""
    id:       int
    username: str
    email:    EmailStr

    model_config = {"from_attributes": True}