# backend/app/models/merge_request.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.config.database import Base
from app.schemas.merge_request import MergeRequestResponse

class MergeRequest(Base):
    __tablename__ = "merge_requests"

    id               = Column(Integer, primary_key=True, index=True)
    analyse_id       = Column(Integer, ForeignKey("analyses.id", ondelete="SET NULL"))
    test_id          = Column(Integer, ForeignKey("tests_generes.id", ondelete="SET NULL"))
    depot_analyse_id = Column(Integer, ForeignKey("depots_analyse.id", ondelete="CASCADE"))
    mr_id_gitlab     = Column(Integer)
    mr_url           = Column(String(500))
    titre            = Column(String(255))
    description      = Column(Text, nullable=True)
    branche_source   = Column(String(255))
    branche_cible    = Column(String(255))
    statut           = Column(String(50), default="opened")  # opened | merged | closed
    type_mr          = Column(String(50), default="tests")   # tests | auto_merge | diff
    labels           = Column(String(255), nullable=True)
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, onupdate=func.now())

    # Relations
    analyse       = relationship("Analyse", backref="merge_requests")
    test          = relationship("TestGenere", backref="merge_requests")
    depot_analyse = relationship("DepotAnalyse", backref="merge_requests")