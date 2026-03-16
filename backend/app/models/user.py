from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.config.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    otp = Column(String(6), nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    role = Column(String(20), nullable=False, default="user")  # ✅ ajouter cette ligne