# backend/app/models/issue_gitlab.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.config.database import Base


class IssueGitLab(Base):
    __tablename__ = "issues_gitlab"

    id               = Column(Integer, primary_key=True, index=True)
    analyse_id       = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"))
    depot_analyse_id = Column(Integer, ForeignKey("depots_analyse.id", ondelete="CASCADE"))
    issue_id_gitlab  = Column(Integer)
    issue_url        = Column(String(500))
    titre            = Column(String(255))
    description      = Column(Text, nullable=True)
    severite         = Column(String(50))
    type_vuln        = Column(String(255))
    fichier          = Column(String(255))
    ligne            = Column(Integer)
    statut           = Column(String(50), default="opened")  # opened | closed
    labels           = Column(String(255), nullable=True)
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, onupdate=func.now())