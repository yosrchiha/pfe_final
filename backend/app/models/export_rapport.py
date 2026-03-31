# backend/app/models/export_rapport.py
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base


class ExportRapport(Base):
    __tablename__ = "exports_rapport"

    id             = Column(Integer, primary_key=True, index=True)
    analyse_id     = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    format         = Column(String(20), nullable=False)  # pdf, docx
    chemin_fichier = Column(String(500), nullable=True)
    taille         = Column(Integer, nullable=True)  # taille en octets
    ip_address     = Column(String(45), nullable=True)  # nullable
    user_agent     = Column(Text, nullable=True)  # nullable
    created_at     = Column(DateTime, server_default=func.now())

    # Relations
    analyse = relationship("Analyse", backref="exports")
    user = relationship("User", backref="exports")