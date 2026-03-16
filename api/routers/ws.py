"""
WebSocket endpoint for real-time coaching chat.
Replaces the separate Node.js conversation engine.
"""
import json
import logging
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session
from api.config import get_settings
from api.services.coaching_service import CoachingService, DIALOGUE_STATES

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(tags=["websocket"])

# In-memory session state (replaces Redis for simplicity)
session_states: dict[str, dict] = {}


def _get_ai_client():
    """Create an AI client if API key is configured."""
    if settings.ai_backend == "openai" and settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            return AsyncOpenAI(api_key=settings.openai_api_key)
        except ImportError:
            logger.warning("openai package not installed")
    elif settings.ai_backend == "anthropic" and settings.anthropic_api_key:
        try:
            from anthropic import AsyncAnthropic
            return AsyncAnthropic(api_key=settings.anthropic_api_key)
        except ImportError:
            logger.warning("anthropic package not installed")
    return None


async def _generate_ai_response(
    service: CoachingService,
    state: dict,
    user_input: str,
    conversation_history: list[dict],
) -> str:
    """Generate response using AI or fall back to templates."""
    ai_client = _get_ai_client()

    topic = state.get("topic", "その他")
    current_step = state.get("current_step", "identify_concern")

    # Build system prompt
    system_prompt = service.build_system_prompt(topic, state)

    # Add public site info during guide_generation
    suggested_links = []
    if current_step == "guide_generation":
        sites = await service.find_relevant_sites(topic)
        suggested_links = sites
        if sites:
            sites_text = "\n".join(
                f"- [{s['title']}]({s['url']}): {s['description']}"
                for s in sites
            )
            system_prompt += f"\n\n# 案内可能な公的サイト:\n{sites_text}"

    if ai_client:
        try:
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(conversation_history)
            messages.append({"role": "user", "content": user_input})

            reply = await service._call_ai(ai_client, messages)
            return reply, suggested_links
        except Exception as e:
            logger.error(f"AI call failed, falling back to templates: {e}")

    # Fallback: enhanced template response
    reply = _enhanced_template_response(topic, state, user_input)
    return reply, suggested_links


def _enhanced_template_response(topic: str, state: dict, user_input: str) -> str:
    """
    Improved template responses that incorporate user input.
    Each step returns a contextually different response.
    """
    step = state.get("current_step", "identify_concern")
    turn = state.get("turn", 0)

    # Topic-specific responses
    topic_map = {
        "相続終活": {
            "identify_concern": [
                f"「{user_input}」についてのご相談ですね。もう少し詳しく状況をお聞かせいただけますか？例えば、ご家族の構成や、特に気になっている点などがあれば教えてください。",
                f"承知しました。{user_input}に関して、現在どのような状況でしょうか？すでに何か手続きを始められていますか？",
            ],
            "coaching_question": [
                f"ありがとうございます。{user_input}とのことですね。その中で、一番大切にしたいことは何でしょうか？例えば、ご家族との関係、資産の保全、手続きの簡便さなど、優先順位をお聞かせください。",
                f"なるほど、{user_input}ということですね。理想的にはどのような形で解決できると安心されますか？",
            ],
            "guide_generation": [
                f"お話を伺った内容をもとに、参考になりそうな公的機関の情報をご案内します。\n\n"
                "■ 法務局「相続登記の申請義務化」\n  https://houmukyoku.moj.go.jp/homu/souzokutouki\n\n"
                "■ 国税庁「相続税の申告のしかた」\n  https://www.nta.go.jp/taxes/shiraberu/sozoku-tokushu/\n\n"
                "■ 法テラス（無料法律相談）\n  https://www.houterasu.or.jp/\n\n"
                "これらの情報は参考としてご覧ください。具体的な手続きについてご不明な点はありますか？",
                f"ご相談内容に基づいて、以下の公的情報が参考になると思います。\n\n"
                "■ 日本公証人連合会（遺言公正証書）\n  https://www.koshonin.gr.jp/\n\n"
                "■ 法務省「遺言書保管制度」\n  https://www.moj.go.jp/MINJI/minji03_00051.html\n\n"
                "■ 各自治体の無料相談窓口\n  お住まいの市区町村の「法律相談」を検索してみてください。\n\n"
                "他にお調べしたいことはありますか？",
            ],
            "follow_up": [
                "案内した情報はお役に立ちそうですか？他にも気になる点や、別のテーマについてもご相談いただけます。",
                "他にもご心配なことはございますか？相続以外のテーマ（介護、お金の管理など）についてもお気軽にご相談ください。",
            ],
        },
        "介護と健康": {
            "identify_concern": [
                f"「{user_input}」についてのご相談ですね。介護に関して、具体的にどのような場面でお困りですか？ご自身の介護、ご家族の介護など、状況をお聞かせください。",
                f"承知しました。{user_input}に関して、現在どのような支援を受けていらっしゃいますか？",
            ],
            "coaching_question": [
                f"ありがとうございます。{user_input}とのことですね。介護の中で、一番負担に感じていることは何でしょうか？",
                f"なるほど、{user_input}ということですね。理想的にはどのようなサポートがあると助かりますか？",
            ],
            "guide_generation": [
                "お話を伺った内容をもとに、参考になりそうな公的機関の情報をご案内します。\n\n"
                "■ 厚生労働省「介護保険制度の概要」\n  https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/\n\n"
                "■ 地域包括支援センター\n  お住まいの地域の包括支援センターにご相談ください。\n\n"
                "■ 介護サービス情報公表システム\n  https://www.kaigokensaku.mhlw.go.jp/\n\n"
                "これらの情報は参考としてご覧ください。",
            ],
            "follow_up": [
                "案内した情報はお役に立ちそうですか？他にも気になる点がございましたらお気軽にどうぞ。",
            ],
        },
    }

    # Default fallback for unlisted topics
    default_responses = {
        "identify_concern": [
            f"「{user_input}」についてのご相談ですね。もう少し具体的に、どのような点でお悩みか教えていただけますか？",
        ],
        "coaching_question": [
            f"ありがとうございます。{user_input}とのことですね。その中で、一番大切にしたいことや優先したいことは何でしょうか？",
        ],
        "guide_generation": [
            "お話を伺った内容をもとに、関連する公的機関の情報をお調べしました。お住まいの自治体の相談窓口もご活用ください。",
        ],
        "follow_up": [
            "他にもご相談されたいことはございますか？別のテーマについてもお気軽にどうぞ。",
        ],
    }

    topic_responses = topic_map.get(topic, default_responses)
    step_responses = topic_responses.get(step, default_responses.get(step, ["承知しました。もう少し詳しくお聞かせください。"]))

    # Vary response by turn to avoid repetition
    idx = turn % len(step_responses)
    return step_responses[idx]


@router.websocket("/ws/chat")
async def coaching_websocket(ws: WebSocket):
    """
    WebSocket endpoint for real-time coaching dialogue.
    Protocol:
      Client → { type: "init_session", payload: { user_id, topic, session_id? } }
      Client → { type: "user_message", payload: { text } }
      Client → { type: "end_session", payload: {} }
      Server → { type: "session_initialized"|"assistant_message"|"typing"|"error", payload }
    """
    await ws.accept()
    session_id = None
    conversation_history = []  # Track conversation for AI context

    try:
        while True:
            raw = await ws.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")
            payload = message.get("payload", {})

            if msg_type == "init_session":
                session_id = payload.get("session_id") or str(uuid4())
                user_id = payload.get("user_id")
                topic = payload.get("topic", "その他")

                state = {
                    "session_id": session_id,
                    "user_id": user_id,
                    "topic": topic,
                    "current_step": "identify_concern",
                    "turn": 0,
                }
                session_states[session_id] = state
                conversation_history = []

                # Generate greeting
                greetings = {
                    "相続終活": "相続や終活についてのご相談ですね。具体的にどのような点でお悩みですか？例えば、遺言の作成、相続税、不動産の相続登記などがございます。お気軽にお話しください。",
                    "介護と健康": "介護や健康に関するご相談ですね。最近、介護や健康についてどんなことが気になっていますか？",
                    "家庭問題": "家庭に関するご相談ですね。どのようなことでお悩みですか？",
                    "仕事と生活": "仕事と生活に関するご相談ですね。具体的にどのようなことでお困りですか？",
                    "お金と資産": "お金や資産管理に関するご相談ですね。どのような点が気になっていますか？",
                    "健康管理": "健康管理についてのご相談ですね。具体的にどのようなことでお悩みですか？",
                }
                greeting = greetings.get(topic, "ご相談承ります。どのようなことでお悩みですか？お気軽にお話しください。")

                conversation_history.append({"role": "assistant", "content": greeting})

                await ws.send_json({
                    "type": "session_initialized",
                    "payload": {
                        "session_id": session_id,
                        "topic": topic,
                        "greeting": greeting,
                        "current_step": "identify_concern",
                    },
                })

            elif msg_type == "user_message":
                if not session_id or session_id not in session_states:
                    await ws.send_json({
                        "type": "error",
                        "payload": {"message": "Session not initialized"},
                    })
                    continue

                text = payload.get("text", "")
                state = session_states[session_id]

                # Typing indicator
                await ws.send_json({"type": "typing", "payload": {"is_typing": True}})

                # Add user message to history
                conversation_history.append({"role": "user", "content": text})

                async with async_session() as db:
                    service = CoachingService(db)

                    # Generate response (AI or template)
                    response_text, suggested_links = await _generate_ai_response(
                        service, state, text, conversation_history
                    )
                    emotion_label, emotion_score = service._detect_emotion(text)

                # Add assistant response to history
                conversation_history.append({"role": "assistant", "content": response_text})

                # Advance state: move to next step after each message
                steps = ["identify_concern", "coaching_question", "guide_generation", "follow_up"]
                current_idx = steps.index(state["current_step"]) if state["current_step"] in steps else 0
                state["turn"] += 1
                # Advance step every message (not every 2 turns)
                state["current_step"] = steps[min(current_idx + 1, len(steps) - 1)]
                session_states[session_id] = state

                next_question = service._get_next_question(state["topic"], state)

                await ws.send_json({
                    "type": "assistant_message",
                    "payload": {
                        "text": response_text,
                        "suggested_links": suggested_links,
                        "next_question": next_question,
                        "emotion": {"label": emotion_label, "score": emotion_score},
                        "current_step": state["current_step"],
                    },
                })
                await ws.send_json({"type": "typing", "payload": {"is_typing": False}})

            elif msg_type == "end_session":
                if session_id and session_id in session_states:
                    del session_states[session_id]
                await ws.send_json({
                    "type": "session_ended",
                    "payload": {"session_id": session_id},
                })
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: session={session_id}")
        if session_id and session_id in session_states:
            del session_states[session_id]
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await ws.send_json({
                "type": "error",
                "payload": {"message": "Internal server error"},
            })
        except Exception:
            pass
