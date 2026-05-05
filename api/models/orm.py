"""
SQLAlchemy ORM models mapping to the database schema.
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    ForeignKey, DateTime, LargeBinary, JSON, CheckConstraint,
    Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET, BYTEA
from sqlalchemy.orm import relationship

from api.database import Base


# ─── Default tenant UUID (deterministic, for backwards compat) ───
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"


# ─── Multi-tenant models ───

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(Text, nullable=False)
    slug = Column(Text, unique=True, nullable=False)
    plan = Column(Text, default="free")
    settings = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TenantMember(Base):
    __tablename__ = "tenant_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Text, nullable=False, default="participant")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_tenant_member"),
    )


# ─── Core models (existing + tenant_id) ───

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(UUID(as_uuid=True), default=uuid4, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True)
    age_group = Column(Text)
    company = Column(Text, nullable=False, server_default="")
    department = Column(Text, nullable=True)
    position = Column(Text, nullable=True)
    consent_status = Column(Boolean, default=False)
    consent_date = Column(DateTime(timezone=True))
    privacy_version = Column(Text, default="1.0")
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # ─── Auth Enhancement (002 migration) ───────────────────────────────
    password_hash  = Column(Text, nullable=True)         # bcrypt; null for legacy/google-only users
    email_verified = Column(Boolean, nullable=False, server_default="false", default=False)
    totp_secret    = Column(Text, nullable=True)         # base32 secret (pyotp)
    mfa_enabled    = Column(Boolean, nullable=False, server_default="false", default=False)
    google_id      = Column(Text, unique=True, nullable=True)
    auth_provider  = Column(Text, nullable=False, server_default="password", default="password")
    last_login_at  = Column(DateTime(timezone=True), nullable=True)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    surveys = relationship("Survey", back_populates="user", cascade="all, delete-orphan")
    metrics = relationship("MetricsLogEntry", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_tenant_id", "tenant_id"),
    )


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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)

    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_sessions_tenant_id", "tenant_id"),
    )


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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="surveys")

    __table_args__ = (
        Index("ix_surveys_tenant_id", "tenant_id"),
    )


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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="metrics")

    __table_args__ = (
        Index("ix_metrics_log_tenant_id", "tenant_id"),
    )


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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_heroic_data_tenant_id", "tenant_id"),
    )


class ConsentLogEntry(Base):
    __tablename__ = "consent_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    action = Column(Text, nullable=False)
    scope = Column(Text, nullable=False)
    privacy_version = Column(Text, nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_consent_log_tenant_id", "tenant_id"),
    )


class PublicSite(Base):
    __tablename__ = "public_sites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    description = Column(Text)
    prefecture = Column(Text)
    category = Column(Text)
    worry_target = Column(String(100))
    guidance_reason = Column(Text)
    skip_info = Column(Text)
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


# ─── New v2 models ───

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    channel = Column(Text, nullable=False, default="chat")
    topic = Column(Text)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True))
    metadata_ = Column("metadata", JSONB, default=dict)

    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_conversations_tenant_started", "tenant_id", started_at.desc()),
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    sender_type = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    content_raw = Column(JSONB)
    nlp_annotations = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("ix_conv_messages_conv_created", "conversation_id", created_at),
    )


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    survey_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    question_id = Column(Text, nullable=False)
    question_text = Column(Text)
    answer_value = Column(Text)
    answer_numeric = Column(Float)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_survey_responses_tenant_created", "tenant_id", created_at.desc()),
    )


# ─── v3.0 HCM models ───

class LifeAbilityScore(Base):
    """Life Ability 5要素スコア履歴。user_ext_id(UUID)のみ使用し内部IDを露出しない。"""
    __tablename__ = "life_ability_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_ext_id = Column(UUID(as_uuid=True), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    s1_info_org = Column(Float)      # ①情報整理力
    s2_decision = Column(Float)      # ②意思決定納得度
    s3_action = Column(Float)        # ③行動移行力
    s4_stability = Column(Float)     # ④生活運用安定性
    s5_resource = Column(Float)      # ⑤可処分リソース創出力
    composite_score = Column(Float)
    ema_score = Column(Float)        # 指数移動平均
    source = Column(Text, default="survey")
    survey_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_la_scores_user", "user_ext_id", "created_at"),
        Index("ix_la_scores_tenant", "tenant_id", "created_at"),
    )


class RoiRecord(Base):
    """ROI・損失コスト算出記録。"""
    __tablename__ = "roi_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    presenteeism_loss_jpy = Column(Float)
    absenteeism_loss_jpy = Column(Float)
    estimated_roi_jpy = Column(Float)
    roi_ratio = Column(Float)
    affected_headcount = Column(Integer)
    avg_daily_wage_jpy = Column(Float)
    avg_la_score_before = Column(Float)
    avg_la_score_after = Column(Float)
    intervention_cost_jpy = Column(Float)
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("ix_roi_records_tenant", "tenant_id", "period_start"),
        UniqueConstraint("tenant_id", "period_start", "period_end", name="uq_roi_period"),
    )


# ════════════════════════════════════════════════════════════════════════
# Auth Enhancement (002 migration) — JWT refresh / email verify / pwd reset
# ════════════════════════════════════════════════════════════════════════

class RefreshToken(Base):
    """Server-side store for JWT refresh tokens. token_hash is SHA-256."""
    __tablename__ = "refresh_tokens"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash  = Column(Text, nullable=False, unique=True)
    issued_at   = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at  = Column(DateTime(timezone=True), nullable=False)
    revoked_at  = Column(DateTime(timezone=True), nullable=True)
    rotated_to  = Column(Integer, ForeignKey("refresh_tokens.id", ondelete="SET NULL"), nullable=True)
    user_agent  = Column(Text, nullable=True)
    ip_address  = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_refresh_tokens_user", "user_id", "expires_at"),
    )


class EmailVerificationToken(Base):
    """Single-use email verification tokens (registration)."""
    __tablename__ = "email_verification_tokens"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash   = Column(Text, nullable=False, unique=True)
    issued_at    = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at   = Column(DateTime(timezone=True), nullable=False)
    consumed_at  = Column(DateTime(timezone=True), nullable=True)


class PasswordResetToken(Base):
    """Single-use password reset tokens."""
    __tablename__ = "password_reset_tokens"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash   = Column(Text, nullable=False, unique=True)
    issued_at    = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at   = Column(DateTime(timezone=True), nullable=False)
    consumed_at  = Column(DateTime(timezone=True), nullable=True)
