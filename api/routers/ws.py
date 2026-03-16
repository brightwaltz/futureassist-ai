"""
WebSocket endpoint for real-time coaching chat.
Replaces the separate Node.js conversation engine.
"""
import json
import logging
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import async_session
from api.services.coaching_service import CoachingService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# In-memory session state (replaces Redis for simplicity)
session_states: dict[str, dict] = {}


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

                # Send greeting
                async with async_session() as db:
                    service = CoachingService(db)
                    greeting = service._generate_template_response(
                        topic,
                        {"current_step": "identify_concern"},
                        "",
                    )

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

                async with async_session() as db:
                    service = CoachingService(db)

                    # Get public sites if in guide phase
                    suggested_links = []
                    if state["current_step"] == "guide_generation":
                        suggested_links = await service.find_relevant_sites(state["topic"])

                    # Generate response
                    response_text = service._generate_template_response(
                        state["topic"], state, text
                    )
                    emotion_label, emotion_score = service._detect_emotion(text)

                    # Advance state
                    state["turn"] += 1
                    if state["turn"] >= 2:
                        steps = ["identify_concern", "coaching_question", "guide_generation", "follow_up"]
                        idx = steps.index(state["current_step"])
                        state["current_step"] = steps[(idx + 1) % len(steps)]
                        state["turn"] = 0
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
        logger.error(f"WebSocket error: {e}")
        try:
            await ws.send_json({
                "type": "error",
                "payload": {"message": "Internal server error"},
            })
        except Exception:
            pass
