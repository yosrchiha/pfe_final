from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base
from app.core.crypto import encrypt_token, decrypt_token


class Exploration(Base):
    __tablename__ = "explorations"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    projet_nom    = Column(String(255), nullable=False)
    projet_chemin = Column(String(500), nullable=False)
    branche       = Column(String(255), nullable=False)

    # Stocké chiffré en base — ne jamais exposer directement
    _gitlab_token_encrypted = Column("gitlab_token", String(500), nullable=False)

    total_fichiers = Column(Integer, default=0)
    statut         = Column(String(50), default="active")  # active, archived

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    extra_data = Column(JSON, nullable=True)

    user = relationship("User", backref="explorations")

    @property
    def gitlab_token(self) -> str:
        """Retourne le token déchiffré (usage interne uniquement)."""
        return decrypt_token(self._gitlab_token_encrypted)

    @gitlab_token.setter
    def gitlab_token(self, plain_token: str):
        """Chiffre automatiquement le token avant de le stocker."""
        self._gitlab_token_encrypted = encrypt_token(plain_token)