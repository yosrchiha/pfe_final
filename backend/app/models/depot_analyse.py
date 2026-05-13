from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base
from app.core.crypto import encrypt_token, decrypt_token


class DepotAnalyse(Base):
    __tablename__ = "depots_analyse"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    nom        = Column(String)
    project_url = Column(String)
    branche    = Column(String, default="main")
    created_at = Column(DateTime, server_default=func.now())

    # Stocké chiffré en base — ne jamais exposer directement
    _gitlab_token_encrypted = Column("gitlab_token", String)

    analyses = relationship(
        "Analyse",
        backref="depot_analyse",
        cascade="all, delete",
        foreign_keys="Analyse.depot_analyse_id"
    )

    @property
    def gitlab_token(self) -> str:
        """Retourne le token déchiffré (usage interne uniquement)."""
        return decrypt_token(self._gitlab_token_encrypted)

    @gitlab_token.setter
    def gitlab_token(self, plain_token: str):
        """Chiffre automatiquement le token avant de le stocker."""
        self._gitlab_token_encrypted = encrypt_token(plain_token)