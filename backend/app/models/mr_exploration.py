# backend/app/models/mr_exploration.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base

class MrExploration(Base):
    __tablename__ = "mr_explorations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Informations du projet
    projet_nom = Column(String(255), nullable=False)
    projet_chemin = Column(String(500), nullable=False)
    
    # Informations de la MR
    branche_source = Column(String(255), nullable=False)
    branche_cible = Column(String(255), nullable=False)
    titre = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Informations GitLab
    mr_id_gitlab = Column(Integer, nullable=False)
    mr_iid_gitlab = Column(Integer, nullable=False)
    mr_url = Column(String(500), nullable=False)
    
    # Fichiers modifiés (stockés en JSON)
    fichiers_modifies = Column(Text, nullable=True)  # JSON string
    
    # Statut de la MR
    statut = Column(String(50), default="opened")  # opened, merged, closed
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    merged_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    
    # Relation
    user = relationship("User", backref="mr_explorations")