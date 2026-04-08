from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base

class AnalyseFichier(Base):
    __tablename__ = "analyses_fichier"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    projet_nom = Column(String(255), nullable=False)
    branche = Column(String(100), nullable=False)
    fichier_path = Column(String(500), nullable=False)
    contenu = Column(Text, nullable=True)
    
    # Scores
    score_qualite = Column(Integer, nullable=True)
    score_securite = Column(Integer, nullable=True)
    score_performance = Column(Integer, nullable=True)
    
    # Résultats
    vulnerabilites = Column(JSON, nullable=True)
    recommandations = Column(JSON, nullable=True)
    
    # Statut
    statut = Column(String(50), default="en_cours")
    
    # Métadonnées
    analysee_le = Column(DateTime, default=datetime.utcnow)
    
    # Relation
    user = relationship("User", backref="analyses_fichier")