# backend/app/models/analyse.py

from sqlalchemy import (
    Column, Integer, String, Boolean,
    JSON, DateTime, ForeignKey
)
from sqlalchemy.sql import func
from app.config.database import Base

class Analyse(Base):
    __tablename__ = "analyses"

    id                = Column(Integer, primary_key=True, index=True)

    # Nouveau — lié à depots_analyse
    depot_analyse_id  = Column(
        Integer,
        ForeignKey("depots_analyse.id", ondelete="CASCADE"),
        nullable=True    # ← nullable
    )

    # Ancien — lié à depots (garde compatibilité)
    depot_id          = Column(
        Integer,
        ForeignKey("depots.id", ondelete="CASCADE"),
        nullable=True    # ← nullable obligatoire
    )

    branche           = Column(String)
    score_qualite     = Column(Integer, nullable=True)
    score_securite    = Column(Integer, nullable=True)
    score_performance = Column(Integer, nullable=True)
    vulnerabilites    = Column(JSON, nullable=True)
    recommandations   = Column(JSON, nullable=True)
    statut            = Column(String, default="en_cours")
    modele_llm        = Column(String, nullable=True)
    owasp_enabled     = Column(Boolean, default=True)
    auto_tests        = Column(Boolean, default=True)
    auto_mr           = Column(Boolean, default=True)
    seuil_qualite     = Column(Integer, default=60)
    created_at        = Column(DateTime, server_default=func.now())

