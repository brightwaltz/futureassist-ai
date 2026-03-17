"""
Dialogue Concierge & Coaching Service.
Implements Life Ability 5-element coaching methodology.
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


# ─── Dialogue State Machine States (Life Ability 5-Element Flow) ───

DIALOGUE_STATES = {
    "information_organizing": {  # ① 情報整理力
        "description": "悩み・不安を言語化し、事実・感情・制約条件に分離する",
        "next": "decision_support",
        "la_element": "情報整理力",
    },
    "decision_support": {  # ② 意思決定納得度
        "description": "価値基準と優先順位を明確化し、納得のいく選択を支援する",
        "next": "action_bridging",
        "la_element": "意思決定納得度",
    },
    "action_bridging": {  # ③ 行動移行力
        "description": "具体的な行動ステップと公的サイト情報を案内する",
        "next": "life_stability",
        "la_element": "行動移行力",
    },
    "life_stability": {  # ④ 生活運用安定性
        "description": "長期的な視点でライフイベントへの対応力を確認する",
        "next": "resource_optimization",
        "la_element": "生活運用安定性",
    },
    "resource_optimization": {  # ⑤ 可処分リソース創出力
        "description": "時間・費用・心理的余裕の確保について提案する",
        "next": "information_organizing",  # cycle back
        "la_element": "可処分リソース創出力",
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
                latest_state={"current_step": "information_organizing", "turn": 0},
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
        Implements Life Ability 5-element methodology.
        """
        current_step = state.get("current_step", "information_organizing")

        base_prompt = """あなたは「未来アシストAI」— Life Ability（意思決定の質）を高めるための実践AIです。

# Life Abilityとは
Life Abilityとは、人生全体を対象に、情報・感情・選択肢を整理し、
自分と家族にとって納得度の高い意思決定と生活運用を継続できる状態・能力です。

# 5つの要素
① 情報整理力: 迷い・不安を言語化し、事実／感情／制約条件を分離して論点を整理する
② 意思決定納得度: 価値基準と優先順位を踏まえ、「自分で決めた」と言える選択を支援する
③ 行動移行力: 決断を「次の一手」に変換し、制度・専門家・支援先へ最短接続する
④ 生活運用安定性: 介護・相続・医療・家族問題への対応力を高め、判断停止を防ぐ
⑤ 可処分リソース創出力: 可処分時間・可処分所得・心理的安全性を回復し、生活余力を増やす

# 対話の方針
1. まずユーザーの悩みを受け止め、「情報整理」を支援する（事実・感情・制約の分離）
2. コーチング質問で価値基準と優先順位を明確化し、「意思決定の納得度」を高める
3. 具体的な行動ステップと公的機関情報を提示し、「行動移行」を促す
4. 長期的なライフイベント対応の視点を提供し、「生活運用の安定性」に寄与する
5. 時間・コスト・心理的負担の軽減視点を常に意識し、「可処分リソースの創出」を意識する

# 重要なルール
- 法的・医療的な個別アドバイスは行わない
- 必ず公的機関の情報を根拠として提示する
- ユーザーの感情に配慮し、共感的な応答をする
- 押し付けず、ユーザーの自己決定を支援する
- プライバシーに配慮し、必要以上の個人情報を求めない
"""

        step_instructions = {
            "information_organizing": """
# 現在のフェーズ: 情報整理（Life Ability①）
- ユーザーの悩みを受け止め、「何に悩んでいるのか」を整理する手助けをしてください
- 事実（客観的状況）、感情（不安・焦りなど）、制約条件（時間・お金・人間関係）の3つに分けて整理してください
- 「今、一番気になっていることは何ですか？」のようなオープンな質問から始めてください
- まだ解決策や公的サイトの案内は行わないでください
""",
            "decision_support": """
# 現在のフェーズ: 意思決定支援（Life Ability②）
- ユーザーが「何を大切にしたいか」「何を優先するか」を自分で言語化できるよう支援してください
- 「何を一番大切にしたいですか？」「理想的な結果はどのような状態ですか？」のような質問をしてください
- ユーザーが自分で判断できるよう、選択肢を提示しつつ、決定はユーザーに委ねてください
- 「自分で決めた」という納得感を持てるように対話を進めてください
""",
            "action_bridging": """
# 現在のフェーズ: 行動移行支援（Life Ability③）
- ユーザーの意思決定を具体的な「次の一歩」に変換してください
- 関連する公的機関・制度・専門家の情報を具体的に案内してください（URLと説明を含む）
- 「まず最初にできること」を1つ明確に提示してください
- 行動のハードルを下げる提案を心がけてください
""",
            "life_stability": """
# 現在のフェーズ: 生活運用安定性（Life Ability④）
- 今の悩みが長期的にどう影響しうるかを穏やかに確認してください
- 「今後、似たような状況が起きたときの備え」について一緒に考えてください
- 他の関連するライフイベント（介護、相続、健康、お金など）への波及も視野に入れてください
- 判断停止や先送りを防ぐための「心の余裕」について触れてください
""",
            "resource_optimization": """
# 現在のフェーズ: 可処分リソース創出（Life Ability⑤）
- 時間・お金・心理的な余裕の観点から、負担を軽減できるポイントを提案してください
- 「この手続きにかかる時間の目安」「無料で使える制度」などの実用情報を提供してください
- 全体のまとめとして、今日の対話で整理できたことを振り返ってください
- 他にも相談したいテーマがあるか確認してください
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
        current_step = current_state.get("current_step", "information_organizing")
        turn = current_state.get("turn", 0) + 1

        next_step = DIALOGUE_STATES.get(current_step, {}).get("next", "information_organizing")

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

        state = session.latest_state or {"current_step": "information_organizing", "turn": 0}

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

        # Get relevant public sites for action_bridging phase
        suggested_links = []
        if state.get("current_step") == "action_bridging":
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
        step = state.get("current_step", "information_organizing")

        templates = {
            "information_organizing": {
                "相続終活": "相続や終活についてのご相談ですね。まずは状況を整理しましょう。具体的にどのような点でお悩みですか？例えば、遺言の作成、相続税、不動産の相続登記などがございます。",
                "介護と健康": "介護や健康に関するご相談ですね。まずは何が気がかりなのか、一緒に整理していきましょう。",
            },
            "decision_support": {
                "相続終活": "お話しいただきありがとうございます。その中で、何を一番大切にしたいとお考えですか？ご家族との関係、資産の保全、手続きの簡便さなど、優先順位をお聞かせください。",
                "介護と健康": "ありがとうございます。介護の中で、一番大切にしたいことは何でしょうか？ご自身の生活と介護のバランスについてお聞かせください。",
            },
            "action_bridging": {
                "相続終活": "以下の公的機関情報が参考になります。詳しい手続きについては各機関にお問い合わせください。",
                "介護と健康": "こちらの自治体支援ページをご覧ください。お住まいの地域の支援情報が掲載されています。",
            },
            "life_stability": {
                "相続終活": "今回の相続に関連して、今後のライフプランへの影響も考えておくと安心です。他にも気になる点はございますか？",
                "介護と健康": "介護は長期的な視点も大切です。今後の変化に備えて、今のうちに確認しておくと良いことをお伝えします。",
                "default": "今回のご相談に関連して、長期的な視点でも確認しておきましょう。他にも気になることはありますか？",
            },
            "resource_optimization": {
                "default": "最後に、時間やお金の面で負担を減らせるポイントをまとめます。他にもご相談されたいテーマがあればお気軽にどうぞ。",
            },
        }

        step_templates = templates.get(step, templates.get("resource_optimization", {}))
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
        step = state.get("current_step", "information_organizing")

        hints = {
            "information_organizing": "まず、お悩みの状況について教えてください。",
            "decision_support": "何を一番大切にしたいか、お聞かせください。",
            "action_bridging": "具体的な行動ステップをご案内します。",
            "life_stability": "長期的な視点で確認しておきましょう。",
            "resource_optimization": "時間やコスト面での負担軽減を考えましょう。",
        }

        return hints.get(step)
