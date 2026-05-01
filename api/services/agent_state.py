"""
Agent State Definitions — FutureAssist AI v3.0 Phase 2

Pure Python ステートマシン用のデータ型定義。
LangGraph 等の外部ライブラリは使用しない。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional
from uuid import UUID


class AgentType(Enum):
    COACHING = "coaching"
    CONCIERGE = "concierge"
    CRITIC = "critic"


@dataclass
class AgentContext:
    """
    エージェント間で共有されるコンテキスト。
    chat.py ルーターから AgentGraph.run() に渡される。
    """
    session_id: UUID
    user_input: str
    topic: str
    dialogue_state: dict
    conversation_history: list[dict]
    ai_client: Any                        # OpenAI / Anthropic クライアント
    tenant_id: Optional[UUID] = None


@dataclass
class AgentResult:
    """
    各エージェントが返す統一レスポンス型。
    chat.py ルーターはこの型を受け取り、APIレスポンスに変換する。
    """
    reply: str
    suggested_links: list[dict]
    confidence: float                      # 0.0–1.0 (ConciergeAgent の検索信頼度)
    next_state: dict
    emotion_label: Optional[str]
    emotion_score: Optional[float]
    conversation_tags: dict
    routed_to: AgentType
    held: bool = False                     # CriticAgent が回答保留にした場合 True
    fallback_reason: Optional[str] = None  # held=True 時の理由

    # ─── chat.py 互換レスポンスへの変換ヘルパー ───
    def to_response_dict(self) -> dict:
        return {
            "assistant_reply": self.reply,
            "suggested_links": self.suggested_links,
            "next_question": None,
            "emotion_label": self.emotion_label,
            "emotion_score": self.emotion_score,
            "conversation_tags": self.conversation_tags,
            # Phase 2 で追加されるフィールド（フロントは無視しても OK）
            "agent_type": self.routed_to.value,
            "confidence": round(self.confidence * 100, 1),
            "held": self.held,
        }
