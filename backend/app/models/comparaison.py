from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base

class Comparaison(Base):
    __tablename__ = "comparaisons"
    
    id = Column(Integer, primary_key=True, index=True)
    depot_id = Column(Integer, ForeignKey("depots.id", ondelete="CASCADE"), nullable=False)
    from_branch = Column(String(200), nullable=False)
    to_branch = Column(String(200), nullable=False)
    commits_count = Column(Integer, default=0)
    files_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relations
    depot = relationship("Depot", back_populates="comparaisons")
    analyses_diff = relationship("AnalyseDiff", back_populates="comparaison", cascade="all, delete-orphan") 