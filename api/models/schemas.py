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


class UserResponse(BaseModel):
    id: int
    external_id: UUID
    name: str
    age_group: Optional[str]
    consent_status: bool
    created_at: datetime

    class Config:
        from_attributes = True


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
