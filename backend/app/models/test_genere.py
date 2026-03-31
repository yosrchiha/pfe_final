# backend/app/models/test_genere.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base
from app.schemas.test_genere import TestGenereResponse

class TestGenere(Base):
    __tablename__ = "tests_generes"

    id               = Column(Integer, primary_key=True, index=True)
    analyse_id       = Column(Integer, ForeignKey("analyses.id"),        nullable=True)
    depot_analyse_id = Column(Integer, ForeignKey("depots_analyse.id"),  nullable=True)
    langage          = Column(String(50))
    framework        = Column(String(50))
    nom_fichier      = Column(String(255))
    contenu          = Column(Text)
    nb_tests         = Column(Integer, default=0)
    nb_lots          = Column(Integer, default=1)
    statut           = Column(String(50), default="genere")
    # statut : genere | pousse | echoue
    branche_cible    = Column(String(255), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    # Relations
    analyse       = relationship("Analyse",       backref="tests",  foreign_keys=[analyse_id])
    depot_analyse = relationship("DepotAnalyse",  backref="tests",  foreign_keys=[depot_analyse_id])