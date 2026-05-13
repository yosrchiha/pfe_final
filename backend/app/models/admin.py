# backend/app/models/admin.py
"""
Modèle Admin — sous-type de User (rôle "admin").
La table 'admins' est reliée à 'users' via une relation 1-1 (joined-table inheritance).

⚠️  AUCUNE migration automatique : exécuter manuellement en base :
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
    );
    INSERT INTO admins (id)
        SELECT id FROM users WHERE role = 'admin'
        ON CONFLICT DO NOTHING;
"""

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base


class Admin(Base):
    """
    Représente un utilisateur de rôle 'admin'.
    Hérite de User via joined-table inheritance (clé partagée).
    Ne duplique aucun champ — tout se lit via la jointure avec 'users'.
    """
    __tablename__ = "admins"

    # Clé primaire = FK vers users.id
    id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # ── Relations propres à l'admin ───────────────────────────────
    # L'admin peut consulter tous les LoginEvent (via user_id, pas de FK directe)
    # Les dépôts peuvent être créés par un admin aussi
    depots          = relationship("Depot",          foreign_keys="Depot.proprietaire_id",  back_populates="admin", lazy="dynamic")
    login_events    = relationship("LoginEvent",     foreign_keys="LoginEvent.user_id",     back_populates="admin", lazy="dynamic")