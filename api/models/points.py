"""
SQLAlchemy ORM models for the points and companion system.
"""
from datetime import datetime

from sqlalchemy import (
    Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint, CheckConstraint,
)

from api.database import Base


class UserPoints(Base):
    __tablename__ = "user_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_points = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class PointHistory(Base):
    __tablename__ = "point_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(Text, nullable=False)
    points_earned = Column(Integer, nullable=False)
    reference_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "action_type", "reference_id", name="uq_point_history_idempotent"),
        CheckConstraint(
            "action_type IN ('consultation_message', 'consultation_complete', 'survey_complete', 'daily_login')",
            name="ck_point_history_action_type",
        ),
    )


class UserCompanion(Base):
    __tablename__ = "user_companion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    companion_name = Column(Text, default="未名")
    level = Column(Integer, default=1)
    experience = Column(Integer, default=0)
    mood = Column(Text, default="normal")
    total_points_spent = Column(Integer, default=0)
    last_fed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "mood IN ('sleeping', 'normal', 'happy', 'excited', 'loving')",
            name="ck_user_companion_mood",
        ),
    )
