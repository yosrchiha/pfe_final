from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base

class AnalyseDiff(Base):
    __tablename__ = "analyses_diff"
    
    id = Column(Integer, primary_key=True, index=True)
    comparaison_id = Column(Integer, ForeignKey("comparaisons.id", ondelete="CASCADE"), nullable=False)
    
    # Statut de l'analyse
    statut = Column(String(50), default="en_cours")  # en_cours, termine, erreur
    resultat_statut = Column(String(50), nullable=True)  # merge_autorise, merge_bloque, aucun_changement
    
    # Scores (0-100)
    score_qualite = Column(Integer, nullable=True)
    score_securite = Column(Integer, nullable=True)
    score_performance = Column(Integer, nullable=True)
    
    # Résultats IA (stockés en JSON)
    vulnerabilites = Column(JSON, nullable=True)           # Liste de toutes les vulnérabilités
    vulnerabilites_bloquantes = Column(JSON, nullable=True) # Liste des vulnérabilités CRITIQUE/HAUTE
    recommandations = Column(JSON, nullable=True)          # Liste des recommandations
    
    # MR créée
    mr_created = Column(Integer, default=0)  # 0 = non, 1 = oui
    mr_id = Column(Integer, nullable=True)
    mr_url = Column(String(500), nullable=True)
    mr_title = Column(String(500), nullable=True)
    
    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relation avec Comparaison
    comparaison = relationship("Comparaison", back_populates="analyses_diff")
    merge_requests_diff = relationship("MergeRequestDiff", back_populates="analyse_diff", cascade="all, delete-orphan")