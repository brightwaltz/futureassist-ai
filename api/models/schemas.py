"""
Pydantic schemas for API request/response validation.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Users ───

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = None
    age_group: Optional[str] = Field(
        None,
        pattern=r"^(10代|20代|30代|40代|50代|60代|70代以上)$"
    )
    company: str = Field(..., min_length=1, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    position: Optional[str] = Field(None, max_length=200)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = None
    age_group: Optional[str] = Field(
        None,
        pattern=r"^(10代|20代|30代|40代|50代|60代|70代以上)$"
    )
    company: Optional[str] = Field(None, min_length=1, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    position: Optional[str] = Field(None, max_length=200)


class UserLogin(BaseModel):
    """Legacy passwordless login (kept for backward compat during migration)."""
    email: str


class UserResponse(BaseModel):
    id: int
    external_id: UUID
    name: str
    email: Optional[str] = None
    age_group: Optional[str]
    company: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    consent_status: bool
    email_verified: Optional[bool] = False
    mfa_enabled: Optional[bool] = False
    auth_provider: Optional[str] = "password"
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Auth Enhancement schemas (002 migration) ──────────────────────────

class AuthRegister(BaseModel):
    """POST /auth/register — full account creation with password."""
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    age_group: Optional[str] = Field(
        None,
        pattern=r"^(10代|20代|30代|40代|50代|60代|70代以上)$"
    )
    company: str = Field(..., min_length=1, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    position: Optional[str] = Field(None, max_length=200)


class AuthLogin(BaseModel):
    email: str
    password: str


class AuthRefresh(BaseModel):
    refresh_token: str


class AuthTokenResponse(BaseModel):
    """Successful login/refresh response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access_token expires
    user: UserResponse


class AuthMfaRequiredResponse(BaseModel):
    """Returned when password is correct but MFA is required."""
    mfa_required: bool = True
    mfa_challenge_token: str  # short-lived signed token to present at /auth/mfa/challenge


class AuthMfaChallenge(BaseModel):
    mfa_challenge_token: str
    code: str = Field(..., min_length=6, max_length=8)


class AuthMfaSetupResponse(BaseModel):
    secret: str           # base32, for fallback manual entry
    otpauth_uri: str      # otpauth://... — feed into authenticator
    qr_code_data_url: str # data:image/png;base64,...


class AuthMfaVerify(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


class AuthEmailVerify(BaseModel):
    token: str


class AuthPasswordResetRequest(BaseModel):
    email: str


class AuthPasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class AuthGoogleCallback(BaseModel):
    code: str
    state: Optional[str] = None


class AuthSimpleMessage(BaseModel):
    """Generic ack response."""
    ok: bool = True
    message: str = "ok"


# ─── Sessions ───

class SessionCreate(BaseModel):
    user_id: int
    topic: str = Field(
        ...,
        pattern=r"^(相続終活|介護と健康|家庭問題|仕事と生活|お金と資産|健康管理|その他)$"
    )


class SessionResponse(BaseModel):
    session_id: UUID
    user_id: int
    topic: str
    status: str
    started_at: datetime
    message_count: int

    class Config:
        from_attributes = True


# ─── Chat ───

class ChatRequest(BaseModel):
    session_id: UUID
    user_input: str = Field(..., min_length=1, max_length=5000)


class SuggestedLink(BaseModel):
    title: str
    url: str
    description: Optional[str] = None


class ChatResponse(BaseModel):
    assistant_reply: str
    suggested_links: list[SuggestedLink] = []
    next_question: Optional[str] = None
    emotion_label: Optional[str] = None
    emotion_score: Optional[float] = None
    # Phase 2 追加フィールド（フロントエンドは無視しても OK、後方互換あり）
    agent_type: Optional[str] = None
    confidence: Optional[float] = None
    held: Optional[bool] = None


# ─── Surveys ───

class SurveyAnswer(BaseModel):
    question_id: int
    value: str | int | float | bool
    comment: Optional[str] = None


class SurveySubmit(BaseModel):
    user_id: int
    survey_type: str = Field(default="life_ability")
    answers: list[SurveyAnswer]
    roleplay_data: Optional[dict] = None


class SurveyResponse(BaseModel):
    survey_id: UUID
    user_id: int
    survey_type: str
    life_ability_score: Optional[float]
    satisfaction_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Metrics ───

class MetricsLog(BaseModel):
    user_id: int
    chat_frequency: Optional[int] = None
    consultation_trend: Optional[str] = None
    stress_level: Optional[float] = Field(None, ge=0, le=10)
    disposable_income: Optional[float] = None
    disposable_time: Optional[float] = None
    energy_level: Optional[float] = Field(None, ge=0, le=10)
    health_improvement: Optional[list[str]] = None


class MetricsResponse(BaseModel):
    id: int
    user_id: int
    chat_frequency: Optional[int]
    stress_level: Optional[float]
    disposable_income: Optional[float]
    disposable_time: Optional[float]
    energy_level: Optional[float]
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Consent ───

class ConsentRequest(BaseModel):
    user_id: int
    action: str = Field(..., pattern=r"^(granted|revoked|updated)$")
    scope: str = Field(default="all")  # 'heroic_sharing', 'data_collection', 'all'
    privacy_version: str = Field(default="1.0")


class ConsentResponse(BaseModel):
    success: bool
    user_id: int
    consent_status: bool
    action: str
    recorded_at: datetime


# ─── HEROIC ───

class HeroicUploadResponse(BaseModel):
    success: bool
    records_transmitted: int
    errors: list[str] = []


# ─── Public Sites ───

class PublicSiteResponse(BaseModel):
    id: int
    topic: str
    title: str
    url: str
    description: Optional[str]
    prefecture: Optional[str]
    category: Optional[str]

    class Config:
        from_attributes = True


# ─── Question Bank ───

class QuestionBankResponse(BaseModel):
    id: int
    category: str
    question_text: str
    question_type: str
    options: Optional[list] = None
    is_required: bool

    class Config:
        from_attributes = True
