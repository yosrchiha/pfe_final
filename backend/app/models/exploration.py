# backend/app/models/exploration.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base

class Exploration(Base):
    __tablename__ = "explorations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Informations du dépôt exploré
    projet_nom = Column(String(255), nullable=False)
    projet_chemin = Column(String(500), nullable=False)
    branche = Column(String(255), nullable=False)
    
    # Token GitLab
    gitlab_token = Column(String(500), nullable=False)
    
    # Statistiques
    total_fichiers = Column(Integer, default=0)
    
    # État de l'exploration
    statut = Column(String(50), default="active")  # active, archived
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Métadonnées additionnelles (RENOMMÉ car 'metadata' est réservé)
    extra_data = Column(JSON, nullable=True)  # ← RENOMMÉ de 'metadata' à 'extra_data'
    
    # Relation avec User
    user = relationship("User", backref="explorations")