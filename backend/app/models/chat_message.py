# backend/app/models/chat_message.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func

from app.config.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    analyse_diff_id = Column(
        Integer,
        ForeignKey("analyses_diff.id", ondelete="SET NULL"),
        nullable=True,
    )

    analyse_fichier_id = Column(
        Integer,
        nullable=True,
    )

    projet_nom = Column(String(255), nullable=True)

    vuln_type = Column(String(255), nullable=True)
    vuln_severite = Column(String(50), nullable=True)
    vuln_fichier = Column(String(500), nullable=True)
    vuln_ligne = Column(Integer, nullable=True)

    question = Column(Text, nullable=False)
    reponse = Column(Text, nullable=False)

    modele_utilise = Column(String(100), nullable=True)
    scores_contexte = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())