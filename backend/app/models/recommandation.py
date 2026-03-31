# backend/app/models/recommandation.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.config.database import Base
from sqlalchemy.orm import relationship  # ← ajouter cette ligne


class Recommandation(Base):
    __tablename__ = "recommandations"

    id           = Column(Integer, primary_key=True, index=True)
    analyse_id   = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    titre        = Column(String(255), nullable=False)
    description  = Column(Text, nullable=False)
    priorite     = Column(String(20), nullable=False)  # CRITIQUE, HAUTE, MOYENNE, FAIBLE
    categorie    = Column(String(50), nullable=False)  # qualite, securite, performance, documentation, bonnes_pratiques
    appliquee    = Column(Boolean, default=False)
    appliquee_le = Column(DateTime, nullable=True)
    fichier      = Column(String(255), nullable=True)
    ligne        = Column(Integer, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, onupdate=func.now())

    # Relation
    analyse = relationship("Analyse", backref="recommandations_list")