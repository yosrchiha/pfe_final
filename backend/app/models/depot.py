from sqlalchemy import Column, Integer, String, ForeignKey
from app.config.database import Base
from sqlalchemy.orm import relationship
class Depot(Base):
    __tablename__ = "depots"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    url_branche_principale = Column(String, nullable=False)
    url_branche_developpement = Column(String, nullable=False)
    token_gitlab = Column(String, nullable=False)
    proprietaire_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comparaisons = relationship("Comparaison", back_populates="depot", cascade="all, delete-orphan")
    merge_requests_diff = relationship("MergeRequestDiff", back_populates="depot", cascade="all, delete-orphan")