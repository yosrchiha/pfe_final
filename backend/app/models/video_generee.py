# backend/app/models/video_generee.py
# Modèle SQLAlchemy pour stocker les vidéos générées par utilisateur

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.config.database import Base


class TypeVideo(str, enum.Enum):
    application   = "application"
    vulnerabilite = "vulnerabilite"
    rapport       = "rapport"


class VideoGeneree(Base):
    __tablename__ = "videos_generees"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Type de vidéo générée
    type_video    = Column(Enum(TypeVideo), nullable=False)

    # Chemin physique du fichier MP4 sur le serveur
    chemin_fichier = Column(String(512), nullable=False)

    # Nom affiché dans l'interface
    titre         = Column(String(255), nullable=False)

    # Métadonnées contextuelles (nom_projet, type_vuln, etc.)
    nom_projet    = Column(String(255), nullable=True)
    langue        = Column(String(5),   default="fr")
    contexte_json = Column(Text,         nullable=True)   # JSON des paramètres de génération

    # Scores au moment de la génération (pour les rapports)
    score_qualite     = Column(Integer, nullable=True)
    score_securite    = Column(Integer, nullable=True)
    score_performance = Column(Integer, nullable=True)

    created_at    = Column(DateTime, default=datetime.utcnow)

    # Relations
    user = relationship("User", backref="videos_generees")