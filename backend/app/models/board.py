from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base

class BoardWidget(Base):
    __tablename__ = "board_widgets"

    id = Column(Integer, primary_key=True, index=True)
    board_name = Column(String, index=True, default="Executive Cockpit", nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    dataset_name = Column(String, nullable=True)
    title = Column(String, nullable=False)
    query = Column(String, nullable=True)
    chart_type = Column(String, default="bar", nullable=False)
    chart_specs = Column(JSON, nullable=True)
    query_result = Column(JSON, nullable=True)
    insights = Column(Text, nullable=True)
    kpis = Column(JSON, nullable=True)
    card_width = Column(String, default="col-span-1", nullable=False) # col-span-1, col-span-2, col-span-3
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
