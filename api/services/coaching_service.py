"""
Dialogue Concierge & Coaching Service.
Implements 野口流対話構成 coaching methodology.
"""
import json
import logging
from pathlib import Path
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.models.orm import Session, Message, PublicSite

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Dialogue State Machine States ───

DIALOGUE_STATES = {
    "identify_concern": {
        "description": "ユーザーの悩み・関心を特定する",
        "next": "coaching_question",
    },
    "coaching_question": {
        "description": "コーチング質問で深掘りする",
        "next": "guide_generation",
    },
    "guide_generation": {
        "description": "公的サイト情報を案内する",
        "next": "follow_up",
    },
    "follow_up": {
        "description": "追加の相談・別トピックへの移行",
        "next": "identify_concern",
    },
}


class CoachingService:
    """
    Core coaching dialogue orchestrator.
    Manages conversation state and generates contextual responses.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._templates = self._load_templates()

    def _load_templates(self) -> dict:
        """Load conversation templates from JSON files."""
        template_path = Path(__file__).parent.parent.parent / "data" / "conversation_templates.json"
        try:
            with open(template_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Templates not found at {template_path}, using defaults")
            return {}

    async def get_or_create_session(
        self, session_id: UUID, user_id: int = None, topic: str = None
    ) -> Session:
        """Get existing session or create a new one."""
        result = await self.db.execute(
            select(Session).where(Session.session_id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session and user_id and topic:
            session = Session(
                session_id=session_id,
                user_id=user_id,
                topic=topic,
                latest_state={"current_step": "identify_concern", "turn": 0},
            )
            self.db.add(session)
            await self.db.flush()

        return session

    async def get_conversation_history(
        self, session_id: UUID, limit: int = 20
    ) -> list[dict]:
        """Retrieve recent messages for context."""
        result = await self.db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = result.scalars().all()
        return [
            {"role": m.role, "content": m.content}
            for m in reversed(messages)
        ]

    async def find_relevant_sites(
        self, topic: str, keywords: list[str] = None, limit: int = 5
    ) -> list[dict]:
        """Find relevant public information sites for the topic."""
        query = (
            select(PublicSite)
            .where(PublicSite.topic == topic)
            .where(PublicSite.is_active == True)
            .limit(limit)
        )
        result = await self.db.execute(query)
        sites = result.scalars().all()

        return [
            {
                "title": s.title,
                "url": s.url,
                "description": s.description,
                "category": s.category,
            }
            for s in sites
        ]

    def build_system_prompt(self, topic: str, state: dict) -> str:
        """
        Build the system prompt for the AI model based on topic and state.
        Implements 野口流対話構成 methodology.
        """
        current_step = state.get("current_step", "identify_concern")

        base_prompt = """あなたは「未来アシストAI」のコンシェルジュ・コーチングAIです。
ユーザーの悩みや関心に寄り添い、対話を通じて適切な公的情報へ案内します。

# 対話の基本方針（野口流対話構成）
1. まずユーザーの悩み・状況を丁寧に聞き取る
2. コーチング的な質問で本質的なニーズを引き出す
3. 適切な公的機関・サイトの情報を具体的に案内する
4. 押し付けず、ユーザーの自己決定を支援する

# 重要なルール
- 法的・医療的な個別アドバイスは行わない
- 必ず公的機関の情報を根拠として提示する
- ユーザーの感情に配慮し、共感的な応答をする
- プライバシーに配慮し、必要以上の個人情報を求めない
"""

        step_instructions = {
            "identify_concern": """
# 現在のフェーズ: 悩みの特定
- オープンな質問でユーザーの状況を把握してください
- 「どのような場面で悩まれていますか？」のような質問から始めてください
- まだ公的サイトの案内は行わないでください
""",
            "coaching_question": """
# 現在のフェーズ: コーチング質問
- ユーザーが何を一番大切にしたいかを引き出してください
- 「何を一番大切にしたいですか？」のような深い質問をしてください
- ユーザーの回答に基づいて、次に案内すべき情報を判断してください
""",
            "guide_generation": """
# 現在のフェーズ: 公的サイト案内
- ユーザーの悩みに合った公的機関の情報を具体的に案内してください
- URLと簡単な説明を含めてください
- 「以下の公的機関情報が参考になります」のように導入してください
""",
            "follow_up": """
# 現在のフェーズ: フォローアップ
- 案内した情報で十分かどうか確認してください
- 他に心配なことがないか聞いてください
- 必要に応じて別のトピックへ誘導してください
""",
        }

        topic_context = {
            "相続終活": "トピック: 相続・終活に関する相談。遺言、相続税、不動産登記等。",
            "介護と健康": "トピック: 介護・健康に関する相談。介護保険、地域支援、健康管理等。",
            "家庭問題": "トピック: 家庭問題に関する相談。家族関係、DV相談、生活困窮等。",
            "仕事と生活": "トピック: 仕事と生活のバランスに関する相談。",
            "お金と資産": "トピック: お金・資産管理に関する相談。NISA、年金、家計等。",
            "健康管理": "トピック: 健康管理全般に関する相談。",
        }

        prompt = base_prompt
        prompt += f"\n{topic_context.get(topic, '')}\n"
        prompt += step_instructions.get(current_step, "")

        return prompt

    def advance_state(self, current_state: dict) -> dict:
        """Advance the dialogue state machine to the next step."""
        current_step = current_state.get("current_step", "identify_concern")
        turn = current_state.get("turn", 0) + 1

        next_step = DIALOGUE_STATES.get(current_step, {}).get("next", "identify_concern")

        return {
            "current_step": next_step,
            "turn": turn,
            "previous_step": current_step,
        }

    async def process_message(
        self,
        session_id: UUID,
        user_input: str,
        ai_client=None,
    ) -> dict:
        """
        Process a user message through the coaching pipeline.
        Returns assistant reply, suggested links, and next question.
        """
        session = await self.get_or_create_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        state = session.latest_state or {"current_step": "identify_concern", "turn": 0}

        # Store user message
        user_msg = Message(
            session_id=session_id,
            role="user",
            content=user_input,
        )
        self.db.add(user_msg)

        # Build conversation context
        history = await self.get_conversation_history(session_id)
        system_prompt = self.build_system_prompt(session.topic, state)

        # Get relevant public sites for guide_generation phase
        suggested_links = []
        if state.get("current_step") == "guide_generation":
            sites = await self.find_relevant_sites(session.topic)
            suggested_links = sites
            # Add sites info to system prompt
            if sites:
                sites_text = "\n".join(
                    f"- [{s['title']}]({s['url']}): {s['description']}"
                    for s in sites
                )
                system_prompt += f"\n\n# 案内可能な公的サイト:\n{sites_text}"

        # Generate AI response
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_input})

        if ai_client:
            assistant_reply = await self._call_ai(ai_client, messages)
        else:
            # Fallback: template-based response
            assistant_reply = self._generate_template_response(
                session.topic, state, user_input
            )

        # Detect emotion (simplified)
        emotion_label, emotion_score = self._detect_emotion(user_input)

        # Store assistant message
        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=assistant_reply,
            suggested_links=[
                {"title": s["title"], "url": s["url"]} for s in suggested_links
            ],
            emotion_label=emotion_label,
            emotion_score=emotion_score,
        )
        self.db.add(assistant_msg)

        # Advance state
        new_state = self.advance_state(state)
        session.latest_state = new_state
        session.message_count = (session.message_count or 0) + 2

        await self.db.flush()

        # Determine next question based on new state
        next_question = self._get_next_question(session.topic, new_state)

        return {
            "assistant_reply": assistant_reply,
            "suggested_links": suggested_links,
            "next_question": next_question,
            "emotion_label": emotion_label,
            "emotion_score": emotion_score,
        }

    async def _call_ai(self, ai_client, messages: list[dict]) -> str:
        """Call the AI model for response generation."""
        try:
            if settings.ai_backend == "openai":
                response = await ai_client.chat.completions.create(
                    model=settings.ai_model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1000,
                )
                return response.choices[0].message.content
            elif settings.ai_backend == "anthropic":
                system_msg = messages[0]["content"] if messages[0]["role"] == "system" else ""
                chat_msgs = [m for m in messages if m["role"] != "system"]
                response = await ai_client.messages.create(
                    model=settings.ai_model,
                    system=system_msg,
                    messages=chat_msgs,
                    max_tokens=1000,
                )
                return response.content[0].text
        except Exception as e:
            logger.error(f"AI call failed: {e}")
            return "申し訳ございません。一時的にサービスが不安定です。しばらくしてからお試しください。"

    def _generate_template_response(
        self, topic: str, state: dict, user_input: str
    ) -> str:
        """Fallback template-based response when AI is unavailable."""
        step = state.get("current_step", "identify_concern")

        templates = {
            "identify_concern": {
                "相続終活": "相続や終活についてのご相談ですね。具体的にどのような点でお悩みですか？例えば、遺言の作成、相続税、不動産の相続登記などがございます。",
                "介護と健康": "介護や健康に関するご相談ですね。最近、介護に関してどんな不安がありますか？",
            },
            "coaching_question": {
                "相続終活": "お話しいただきありがとうございます。その中で、何を一番大切にしたいとお考えですか？ご家族との関係、資産の保全、手続きの簡便さなど、優先順位をお聞かせください。",
                "介護と健康": "介護負担を軽減するために使えそうな支援について、何かご存知のものはありますか？",
            },
            "guide_generation": {
                "相続終活": "以下の公的機関情報が参考になります。詳しい手続きについては各機関にお問い合わせください。",
                "介護と健康": "こちらの自治体支援ページをご覧ください。お住まいの地域の支援情報が掲載されています。",
            },
            "follow_up": {
                "default": "他にもお悩みのことはございますか？別のテーマについてもご相談いただけます。",
            },
        }

        step_templates = templates.get(step, templates.get("follow_up", {}))
        return step_templates.get(topic, step_templates.get("default", "承知しました。もう少し詳しくお聞かせください。"))

    def _detect_emotion(self, text: str) -> tuple[Optional[str], Optional[float]]:
        """
        Simplified emotion detection based on keyword matching.
        In production, replace with transformer-based model.
        """
        negative_keywords = ["不安", "心配", "困", "辛", "悲", "怖", "ストレス", "疲"]
        positive_keywords = ["嬉しい", "安心", "助かり", "ありがとう", "良い", "楽しい"]

        neg_count = sum(1 for kw in negative_keywords if kw in text)
        pos_count = sum(1 for kw in positive_keywords if kw in text)

        if neg_count > pos_count:
            return "negative", min(neg_count * 0.3, 1.0)
        elif pos_count > neg_count:
            return "positive", min(pos_count * 0.3, 1.0)
        return "neutral", 0.5

    def _get_next_question(self, topic: str, state: dict) -> Optional[str]:
        """Suggest the next question based on dialogue state."""
        step = state.get("current_step", "identify_concern")

        hints = {
            "identify_concern": "まず、お悩みの状況について教えてください。",
            "coaching_question": "もう少し詳しくお聞かせください。",
            "guide_generation": "関連する公的サイト情報をお探しします。",
            "follow_up": "他にもご相談されたいことはありますか？",
        }

        return hints.get(step)
