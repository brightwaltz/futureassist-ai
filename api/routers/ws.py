"""
WebSocket endpoint for real-time coaching chat.
Replaces the separate Node.js conversation engine.
"""
import json
import logging
from datetime import datetime
from uuid import uuid4, UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.database import async_session
from api.config import get_settings
from api.models.orm import DEFAULT_TENANT_ID, User, Conversation
from api.services.coaching_service import CoachingService, DIALOGUE_STATES
from api.services.logging_service import log_conversation_start, log_message

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
    current_step = state.get("current_step", "information_organizing")

    # Build system prompt
    system_prompt = service.build_system_prompt(topic, state)

    # Add public site info during action_bridging
    suggested_links = []
    if current_step == "action_bridging":
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
    Each step returns a contextually different response based on Life Ability 5 elements.
    """
    step = state.get("current_step", "information_organizing")
    turn = state.get("turn", 0)

    # Topic-specific responses
    topic_map = {
        "相続終活": {
            "information_organizing": [
                f"「{user_input}」についてのご相談ですね。まずは状況を整理しましょう。ご家族の構成や、特に気になっている点など、事実と気持ちを分けてお聞かせください。",
                f"承知しました。{user_input}に関して、現在の状況を整理させてください。客観的な事実（手続きの状況など）と、気持ちの面（不安・焦りなど）を分けてお話しいただけますか？",
            ],
            "decision_support": [
                f"ありがとうございます。{user_input}とのことですね。その中で、一番大切にしたいことは何でしょうか？例えば、ご家族との関係、資産の保全、手続きの簡便さなど、優先順位をお聞かせください。",
                f"なるほど、{user_input}ということですね。理想的にはどのような形で解決できると「自分で決めた」と納得できますか？",
            ],
            "action_bridging": [
                f"お話を伺った内容をもとに、具体的な次の一歩をご案内します。\n\n"
                "■ 法務局「相続登記の申請義務化」\n  https://houmukyoku.moj.go.jp/homu/souzokutouki\n\n"
                "■ 国税庁「相続税の申告のしかた」\n  https://www.nta.go.jp/taxes/shiraberu/sozoku-tokushu/\n\n"
                "■ 法テラス（無料法律相談）\n  https://www.houterasu.or.jp/\n\n"
                "まず最初にできることとして、お住まいの地域の無料法律相談の予約をおすすめします。",
                f"ご相談内容に基づいて、以下の公的情報が参考になると思います。\n\n"
                "■ 日本公証人連合会（遺言公正証書）\n  https://www.koshonin.gr.jp/\n\n"
                "■ 法務省「遺言書保管制度」\n  https://www.moj.go.jp/MINJI/minji03_00051.html\n\n"
                "■ 各自治体の無料相談窓口\n  お住まいの市区町村の「法律相談」を検索してみてください。\n\n"
                "まずは一つ、取りかかりやすいものから始めてみましょう。",
            ],
            "life_stability": [
                "今回の相続に関連して、長期的な視点でも確認しておきましょう。例えば、今後の介護や資産管理の備えなど、関連するライフイベントへの準備は大丈夫ですか？",
                "相続の手続き以外にも、今後のライフプランへの影響を考えておくと安心です。心の余裕を保つためにも、一度に全部ではなく段階的に進めていきましょう。",
            ],
            "resource_optimization": [
                "最後に、時間と費用の面で負担を軽減するポイントをまとめます。法テラスの無料相談や、自治体の相談窓口を活用すると、専門家費用を抑えられます。他にもご相談されたいテーマはありますか？",
                "今日の対話で整理できたことを振り返ると、状況の把握と次のステップが明確になりましたね。時間的な余裕を作るためにも、期限のあるものから優先して取り組みましょう。他にもお悩みはありますか？",
            ],
        },
        "介護と健康": {
            "information_organizing": [
                f"「{user_input}」についてのご相談ですね。まずは状況を整理しましょう。介護に関して、事実（現在の介護状況）と気持ち（不安やストレス）を分けてお聞かせください。",
                f"承知しました。{user_input}に関して、現在どのような支援を受けていて、何が一番負担になっていますか？",
            ],
            "decision_support": [
                f"ありがとうございます。{user_input}とのことですね。介護の中で、一番大切にしたいことは何でしょうか？ご自身の生活との両立、ご家族の安心、費用面など、優先順位を一緒に考えましょう。",
                f"なるほど、{user_input}ということですね。理想的にはどのようなサポートがあると、納得のいく介護ができると思いますか？",
            ],
            "action_bridging": [
                "お話を伺った内容をもとに、具体的な支援情報をご案内します。\n\n"
                "■ 厚生労働省「介護保険制度の概要」\n  https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/\n\n"
                "■ 地域包括支援センター\n  お住まいの地域の包括支援センターにご相談ください。\n\n"
                "■ 介護サービス情報公表システム\n  https://www.kaigokensaku.mhlw.go.jp/\n\n"
                "まず最初に、お近くの地域包括支援センターに相談してみることをおすすめします。",
            ],
            "life_stability": [
                "介護は長期的な視点も大切です。今後の変化に備えて、ケアマネジャーとの定期的な相談や、家族間での役割分担の見直しを検討してみてください。心の余裕を保つことも重要です。",
            ],
            "resource_optimization": [
                "介護保険の自己負担軽減制度や、自治体独自の助成制度も確認してみてください。時間面では、レスパイトケア（介護者の休息支援）の利用もおすすめです。他にもご相談されたいことはありますか？",
            ],
        },
    }

    # Default fallback for unlisted topics
    default_responses = {
        "information_organizing": [
            f"「{user_input}」についてのご相談ですね。まずは状況を整理しましょう。具体的に、どのような点でお悩みか教えていただけますか？",
        ],
        "decision_support": [
            f"ありがとうございます。{user_input}とのことですね。その中で、一番大切にしたいことや優先したいことは何でしょうか？",
        ],
        "action_bridging": [
            "お話を伺った内容をもとに、関連する公的機関の情報をご案内します。お住まいの自治体の相談窓口もご活用ください。",
        ],
        "life_stability": [
            "今回のご相談に関連して、長期的な視点でも確認しておきましょう。今後の備えについて一緒に考えてみませんか？",
        ],
        "resource_optimization": [
            "最後に、時間やコスト面で負担を軽減できるポイントをまとめます。無料で利用できる制度もありますので、ぜひご活用ください。他にもご相談されたいことはありますか？",
        ],
    }

    topic_responses = topic_map.get(topic, default_responses)
    step_responses = topic_responses.get(step, default_responses.get(step, ["承知しました。もう少し詳しくお聞かせください。"]))

    # Vary response by turn to avoid repetition
    idx = turn % len(step_responses)
    return step_responses[idx]


async def _validate_user_id(user_id) -> int | None:
    """Validate that user_id corresponds to an existing user. Returns int or None."""
    if user_id is None:
        return None
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return None
    try:
        async with async_session() as db:
            result = await db.execute(select(User).where(User.id == uid))
            if result.scalar_one_or_none():
                return uid
    except Exception as e:
        logger.warning(f"Failed to validate user_id={user_id}: {e}")
    return None


async def _persist_state(conversation_id, state):
    """Save session state to Conversation.metadata_ for persistence across restarts."""
    if not conversation_id:
        return
    try:
        async with async_session() as db:
            conv = await db.get(Conversation, conversation_id)
            if conv:
                conv.metadata_ = state
                await db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist state: {e}")


@router.websocket("/ws/chat")
async def coaching_websocket(ws: WebSocket):
    """
    WebSocket endpoint for real-time coaching dialogue.
    Protocol:
      Client → { type: "init_session", payload: { user_id, topic, session_id? } }
      Client → { type: "user_message", payload: { text } }
      Client → { type: "resume_session", payload: { user_id, conversation_id } }
      Client → { type: "end_session", payload: {} }
      Server → { type: "session_initialized"|"assistant_message"|"typing"|"session_resumed"|"error", payload }
    """
    await ws.accept()
    session_id = None
    conversation_history = []  # Track conversation for AI context
    conversation_id = None  # v2 logging
    tenant_id = UUID(DEFAULT_TENANT_ID)  # default; could be resolved from headers later

    try:
        while True:
            raw = await ws.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")
            payload = message.get("payload", {})

            if msg_type == "init_session":
                session_id = payload.get("session_id") or str(uuid4())
                raw_user_id = payload.get("user_id")
                topic = payload.get("topic", "その他")

                # Validate user exists in DB; use None if not found
                validated_user_id = await _validate_user_id(raw_user_id)

                state = {
                    "session_id": session_id,
                    "user_id": validated_user_id,
                    "topic": topic,
                    "current_step": "information_organizing",
                    "turn": 0,
                }
                session_states[session_id] = state
                conversation_history = []

                # Generate greeting (Life Ability framing)
                greetings = {
                    "相続終活": "相続や終活についてのご相談ですね。まずは状況を一緒に整理しましょう。今、一番気になっていることは何ですか？",
                    "介護と健康": "介護や健康に関するご相談ですね。まずは何が気がかりなのか、一緒に整理していきましょう。",
                    "家庭問題": "家庭に関するご相談ですね。安心してお話しください。まず、今の状況を整理するところから始めましょう。",
                    "仕事と生活": "仕事と生活に関するご相談ですね。まずはお悩みの全体像を一緒に整理していきましょう。",
                    "お金と資産": "お金や資産管理についてのご相談ですね。まずは今の状況と気になっていることを整理しましょう。",
                    "健康管理": "健康管理についてのご相談ですね。まずはどのようなことが気になっているか、整理していきましょう。",
                }
                greeting = greetings.get(topic, "ご相談承ります。まずは状況を一緒に整理しましょう。どのようなことでお悩みですか？")

                conversation_history.append({"role": "assistant", "content": greeting})

                # v2 logging: create conversation record
                # NOTE: session_id is a random UUID with no matching row in sessions table,
                # so we must pass None to avoid FK constraint violation.
                try:
                    async with async_session() as db:
                        conv = await log_conversation_start(
                            db,
                            tenant_id=tenant_id,
                            session_id=None,
                            user_id=validated_user_id,
                            channel="chat",
                            topic=topic,
                        )
                        await log_message(
                            db,
                            conversation_id=conv.id,
                            tenant_id=tenant_id,
                            sender_type="assistant",
                            content=greeting,
                        )
                        await db.commit()
                        conversation_id = conv.id
                except Exception as e:
                    logger.warning(f"Failed to log conversation start: {e}")

                # Persist initial state
                await _persist_state(conversation_id, state)

                await ws.send_json({
                    "type": "session_initialized",
                    "payload": {
                        "session_id": session_id,
                        "topic": topic,
                        "greeting": greeting,
                        "current_step": "information_organizing",
                    },
                })

            elif msg_type == "resume_session":
                raw_user_id = payload.get("user_id")
                resume_conv_id = payload.get("conversation_id")

                if not resume_conv_id:
                    await ws.send_json({
                        "type": "error",
                        "payload": {"message": "conversation_id is required"},
                    })
                    continue

                try:
                    conv_uuid = UUID(str(resume_conv_id))
                except (ValueError, TypeError):
                    await ws.send_json({
                        "type": "error",
                        "payload": {"message": "Invalid conversation_id"},
                    })
                    continue

                # Load conversation + messages from DB
                try:
                    async with async_session() as db:
                        result = await db.execute(
                            select(Conversation)
                            .where(Conversation.id == conv_uuid)
                            .options(selectinload(Conversation.messages))
                        )
                        conv = result.scalar_one_or_none()

                    if not conv:
                        await ws.send_json({
                            "type": "error",
                            "payload": {"message": "Conversation not found"},
                        })
                        continue

                    # Verify user ownership
                    validated_user_id = await _validate_user_id(raw_user_id)
                    if conv.user_id and validated_user_id and conv.user_id != validated_user_id:
                        await ws.send_json({
                            "type": "error",
                            "payload": {"message": "Conversation does not belong to user"},
                        })
                        continue

                    # Restore session state
                    session_id = str(uuid4())
                    conversation_id = conv.id

                    # Restore state from metadata_ or build a default
                    if conv.metadata_ and isinstance(conv.metadata_, dict):
                        state = dict(conv.metadata_)
                        state["session_id"] = session_id
                    else:
                        state = {
                            "session_id": session_id,
                            "user_id": validated_user_id,
                            "topic": conv.topic or "その他",
                            "current_step": "information_organizing",
                            "turn": 0,
                        }

                    session_states[session_id] = state

                    # Restore conversation history from DB messages
                    conversation_history = []
                    sorted_msgs = sorted(
                        conv.messages,
                        key=lambda m: m.created_at or datetime.min,
                    )
                    messages_payload = []
                    for m in sorted_msgs:
                        role = "assistant" if m.sender_type == "assistant" else "user"
                        conversation_history.append({"role": role, "content": m.content})
                        messages_payload.append({
                            "sender_type": m.sender_type,
                            "content": m.content,
                            "created_at": m.created_at.isoformat() if m.created_at else None,
                        })

                    await ws.send_json({
                        "type": "session_resumed",
                        "payload": {
                            "session_id": session_id,
                            "topic": state.get("topic", conv.topic),
                            "current_step": state.get("current_step", "information_organizing"),
                            "messages": messages_payload,
                        },
                    })

                except Exception as e:
                    logger.error(f"Failed to resume session: {e}", exc_info=True)
                    await ws.send_json({
                        "type": "error",
                        "payload": {"message": "Failed to resume session"},
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
                steps = ["information_organizing", "decision_support", "action_bridging", "life_stability", "resource_optimization"]
                current_idx = steps.index(state["current_step"]) if state["current_step"] in steps else 0
                state["turn"] += 1
                # Advance step every message (not every 2 turns)
                state["current_step"] = steps[min(current_idx + 1, len(steps) - 1)]
                session_states[session_id] = state

                next_question = service._get_next_question(state["topic"], state)

                # v2 logging: log user message and assistant response
                if conversation_id:
                    try:
                        async with async_session() as db:
                            nlp = {
                                "emotion_label": emotion_label,
                                "emotion_score": emotion_score,
                            }
                            await log_message(
                                db,
                                conversation_id=conversation_id,
                                tenant_id=tenant_id,
                                sender_type="user",
                                content=text,
                                nlp_annotations=nlp,
                            )
                            await log_message(
                                db,
                                conversation_id=conversation_id,
                                tenant_id=tenant_id,
                                sender_type="assistant",
                                content=response_text,
                            )
                            await db.commit()
                    except Exception as e:
                        logger.warning(f"Failed to log messages: {e}")

                # Persist state after each message
                await _persist_state(conversation_id, state)

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
