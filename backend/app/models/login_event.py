# backend/app/models/login_event.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.config.database import Base


class LoginEvent(Base):
    """
    Enregistre chaque tentative de connexion (succès ou échec) et chaque déconnexion.
    Permet de calculer la présence réelle, le nombre de sessions, etc.
    """
    __tablename__ = "login_events"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # "login_success" | "login_failure" | "logout"
    event_type = Column(String(20), nullable=False)

    # Métadonnées de session
    ip_address = Column(String(45),  nullable=True)   # IPv4 ou IPv6
    user_agent = Column(String(512), nullable=True)
    success    = Column(Boolean, default=True)         # False = mauvais mot de passe

    # Timestamps
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    # logout_at est rempli quand event_type == "logout"
    logout_at   = Column(DateTime(timezone=True), nullable=True)