"""
SQLAlchemy ORM models mapping to the database schema.
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    ForeignKey, DateTime, LargeBinary, JSON, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET, BYTEA
from sqlalchemy.orm import relationship

from api.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(UUID(as_uuid=True), default=uuid4, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True)
    age_group = Column(Text)
    consent_status = Column(Boolean, default=False)
    consent_date = Column(DateTime(timezone=True))
    privacy_version = Column(Text, default="1.0")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    surveys = relationship("Survey", back_populates="user", cascade="all, delete-orphan")
    metrics = relationship("MetricsLogEntry", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    topic = Column(Text, nullable=False)
    status = Column(Text, default="active")
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True))
    latest_state = Column(JSONB, default=dict)
    message_count = Column(Integer, default=0)
    metadata_ = Column("metadata", JSONB, default=dict)

    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.session_id", ondelete="CASCADE"))
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    suggested_links = Column(JSONB, default=list)
    emotion_label = Column(Text)
    emotion_score = Column(Float)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    session = relationship("Session", back_populates="messages")


class Survey(Base):
    __tablename__ = "surveys"

    survey_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    survey_type = Column(Text, default="life_ability")
    responses = Column(JSONB, default=list)
    roleplay_data = Column(JSONB, default=dict)
    life_ability_score = Column(Float)
    satisfaction_score = Column(Float)
    feedback_source = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="surveys")


class MetricsLogEntry(Base):
    __tablename__ = "metrics_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    chat_frequency = Column(Integer, default=0)
    consultation_trend = Column(Text)
    stress_level = Column(Float)
    disposable_income = Column(Float)
    disposable_time = Column(Float)
    energy_level = Column(Float)
    health_improvement = Column(JSONB, default=list)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="metrics")


class HeroicData(Base):
    __tablename__ = "heroic_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    payload_encrypted = Column(BYTEA, nullable=False)
    encryption_version = Column(Text, default="AES256-v1")
    salt = Column(BYTEA)
    transmitted = Column(Boolean, default=False)
    transmitted_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class ConsentLogEntry(Base):
    __tablename__ = "consent_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    action = Column(Text, nullable=False)
    scope = Column(Text, nullable=False)
    privacy_version = Column(Text, nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class PublicSite(Base):
    __tablename__ = "public_sites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    description = Column(Text)
    prefecture = Column(Text)
    category = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class QuestionBankEntry(Base):
    __tablename__ = "question_bank"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(Text, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(Text, default="likert")
    options = Column(JSONB)
    display_order = Column(Integer, default=0)
    is_required = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
