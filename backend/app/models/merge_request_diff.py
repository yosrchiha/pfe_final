from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base

class MergeRequestDiff(Base):
    __tablename__ = "merge_requests_diff"
    
    id = Column(Integer, primary_key=True, index=True)
    analyse_diff_id = Column(Integer, ForeignKey("analyses_diff.id", ondelete="CASCADE"), nullable=False)
    depot_id = Column(Integer, ForeignKey("depots.id", ondelete="CASCADE"), nullable=False)
    
    # Infos GitLab
    mr_id_gitlab = Column(Integer, nullable=False)
    mr_iid_gitlab = Column(Integer, nullable=False)
    mr_url = Column(String(500), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source_branch = Column(String(200), nullable=False)
    target_branch = Column(String(200), nullable=False)
    state = Column(String(50), default="opened")
    
    # Type de MR
    type_mr = Column(String(50), default="auto")  # auto, force
    
    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relations
    analyse_diff = relationship("AnalyseDiff", back_populates="merge_requests_diff")
    depot = relationship("Depot", back_populates="merge_requests_diff")