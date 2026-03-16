# backend/app/models/depot_analyse.py

from sqlalchemy import (
    Column, Integer, String,
    DateTime, ForeignKey
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base

class DepotAnalyse(Base):
    __tablename__ = "depots_analyse"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    nom          = Column(String)
    gitlab_token = Column(String)
    project_url  = Column(String)
    branche      = Column(String, default="main")
    created_at   = Column(DateTime, server_default=func.now())

    # Relation vers les analyses
    analyses = relationship(
        "Analyse",
        backref      = "depot_analyse",
        cascade      = "all, delete",
        foreign_keys = "Analyse.depot_analyse_id"
    )