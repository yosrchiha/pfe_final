# backend/app/models/corre_diff.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.config.database import Base


class CorreDiff(Base):
    __tablename__ = "corre_diff"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    depot_id = Column(
        Integer,
        ForeignKey("depots.id", ondelete="CASCADE"),
        nullable=False,
    )

    analyse_diff_id = Column(
        Integer,
        ForeignKey("analyses_diff.id", ondelete="SET NULL"),
        nullable=True,
    )

    comparaison_id = Column(
        Integer,
        ForeignKey("comparaisons.id", ondelete="SET NULL"),
        nullable=True,
    )

    fichier_path = Column(String(500), nullable=False)
    branche_source = Column(String(255), nullable=False)
    branche_correction = Column(String(255), nullable=False)

    vuln_type = Column(String(255), nullable=False)
    vuln_severite = Column(String(50), nullable=False)
    vuln_ligne = Column(Integer, nullable=False)
    vuln_suggestion = Column(Text, nullable=True)

    contenu_original = Column(Text, nullable=False)
    contenu_corrige = Column(Text, nullable=False)

    modele_utilise = Column(String(100), nullable=True)

    mr_url = Column(String(500), nullable=True)
    mr_id_gitlab = Column(Integer, nullable=True)
    mr_titre = Column(String(500), nullable=True)

    statut = Column(String(50), default="appliquee")

    created_at = Column(DateTime, server_default=func.now())
    pushed_at = Column(DateTime, nullable=True)
    merged_at = Column(DateTime, nullable=True)