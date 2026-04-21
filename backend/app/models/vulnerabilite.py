from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from app.config.database import Base
from sqlalchemy.orm import relationship
import enum


class SeveriteEnum(str, enum.Enum):
    CRITIQUE = "CRITIQUE"
    HAUTE = "HAUTE"
    MOYENNE = "MOYENNE"
    FAIBLE = "FAIBLE"


class Vulnerabilite(Base):
    __tablename__ = "vulnerabilites"

    id              = Column(Integer, primary_key=True, index=True)
    analyse_id      = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    
    # Informations de base
    type            = Column(String(255), nullable=False)  # ex: "SQL Injection", "XSS", "CSRF"
    severite        = Column(String(20), nullable=False)   # CRITIQUE, HAUTE, MOYENNE, FAIBLE
    description     = Column(Text, nullable=False)
    suggestion      = Column(Text, nullable=False)         # Correction suggérée
    
    # Localisation
    fichier         = Column(String(500), nullable=False)
    ligne           = Column(Integer, nullable=False)
    colonne         = Column(Integer, nullable=True)
    
    # Classification
    categorie_owasp = Column(String(100), nullable=True)   # ex: "A01:2021 – Broken Access Control"
    cwe_id          = Column(String(50), nullable=True)    # ex: "CWE-89"
    
    # Statut
    statut          = Column(String(50), default="detectee")  # detectee, confirmee, corrigee, faux_positif
    
    # Métadonnées
    code_snippet    = Column(Text, nullable=True)          # Extrait du code problématique
    impact          = Column(Text, nullable=True)          # Impact potentiel
    
    # Timestamps
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, onupdate=func.now())

    # Relation
    analyse = relationship("Analyse", backref="vulnerabilites_list")