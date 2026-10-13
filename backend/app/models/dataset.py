from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    raw_file_path = Column(String, nullable=True)
    file_type = Column(String, nullable=False) # csv, excel, json, etc.
    is_cleaned = Column(Boolean, default=False, nullable=True)
    quality_score = Column(Integer, default=100, nullable=True)
    audit_info = Column(JSON, nullable=True)
    cleaning_changelog = Column(JSON, nullable=True)
    schema_info = Column(JSON, nullable=True)  # store column info
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
