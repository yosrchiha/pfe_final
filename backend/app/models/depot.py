from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base
from app.core.crypto import encrypt_token, decrypt_token


class Depot(Base):
    __tablename__ = "depots"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    url_branche_principale = Column(String, nullable=False)
    url_branche_developpement = Column(String, nullable=False)

    # Stocké chiffré en base — ne jamais exposer directement
    _token_gitlab_encrypted = Column("token_gitlab", String, nullable=False)

    proprietaire_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    comparaisons = relationship("Comparaison", back_populates="depot", cascade="all, delete-orphan")
    merge_requests_diff = relationship("MergeRequestDiff", back_populates="depot", cascade="all, delete-orphan")

    @property
    def token_gitlab(self) -> str:
        """Retourne le token déchiffré (usage interne uniquement)."""
        return decrypt_token(self._token_gitlab_encrypted)

    @token_gitlab.setter
    def token_gitlab(self, plain_token: str):
        """Chiffre automatiquement le token avant de le stocker."""
        self._token_gitlab_encrypted = encrypt_token(plain_token)