from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base

class Feedback(Base):
    __tablename__ = "feedbacks"
    
    id = Column(Integer, primary_key=True, index=True)
    analyse_id = Column(Integer, ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1 à 5
    category = Column(String(50), nullable=False)  # qualite, securite, performance, tests, interface, global
    comment = Column(Text, nullable=True)
    projet_nom = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relations
    analyse = relationship("Analyse", backref="feedbacks")
    user = relationship("User", backref="feedbacks")
