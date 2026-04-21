# backend/app/models/correction.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base

class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Informations sur le fichier corrigé
    projet_nom = Column(String(255), nullable=False)
    fichier_path = Column(String(500), nullable=False)
    branche = Column(String(255), nullable=False)
    
    # Informations sur la vulnérabilité corrigée
    vuln_type = Column(String(255), nullable=False)
    vuln_severite = Column(String(50), nullable=False)
    vuln_ligne = Column(Integer, nullable=False)
    vuln_suggestion = Column(Text, nullable=True)
    
    # Contenu avant/après
    contenu_original = Column(Text, nullable=False)
    contenu_corrige = Column(Text, nullable=False)
    
    # Statut de la correction
    statut = Column(String(50), default="appliquee")  # appliquee, poussee, annulee
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    pushed_at = Column(DateTime, nullable=True)
    
    # Relation avec User
    user = relationship("User", backref="corrections")