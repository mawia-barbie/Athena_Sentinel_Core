from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    bio = Column(String(512), nullable=True)
    profile_image = Column(String(256), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
