# backend/app/models/client.py
"""
Modèle Client — sous-type de User (rôle "user").
La table 'clients' est reliée à 'users' via une relation 1-1 (joined-table inheritance).

⚠️  AUCUNE migration automatique : exécuter manuellement en base :
    ALTER TABLE users ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'user';
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
    );
    INSERT INTO clients (id)
        SELECT id FROM users WHERE role = 'user'
        ON CONFLICT DO NOTHING;
"""

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base


class Client(Base):
    """
    Représente un utilisateur de rôle 'user'.
    Hérite de User via joined-table inheritance (clé partagée).
    Ne duplique aucun champ — tout se lit via la jointure avec 'users'.
    """
    __tablename__ = "clients"

    # Clé primaire = FK vers users.id
    id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # ── Relations propres au client ───────────────────────────────
    depots_analyse  = relationship("DepotAnalyse",  foreign_keys="DepotAnalyse.user_id",  back_populates="client", lazy="dynamic")
    videos          = relationship("VideoGeneree",   foreign_keys="VideoGeneree.user_id",   back_populates="client", lazy="dynamic")
    exports_rapport = relationship("ExportRapport",  foreign_keys="ExportRapport.user_id",  back_populates="client", lazy="dynamic")
    feedbacks       = relationship("Feedback",       foreign_keys="Feedback.user_id",       back_populates="client", lazy="dynamic")
    login_events    = relationship("LoginEvent",     foreign_keys="LoginEvent.user_id",     back_populates="client", lazy="dynamic")