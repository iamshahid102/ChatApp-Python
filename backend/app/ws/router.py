import json
import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.core.ratelimit import RateLimiter
from app.core.security import decode_access_token
from app.db.mongo import get_db
from app.services.chat import (
    create_message,
    get_conversation_for_user,
    mark_read,
    serialize_message,
)
from app.ws.events import broadcast_new_message
from app.ws.hub import hub

logger = logging.getLogger("chatapp.ws")
router = APIRouter()

message_limiter = RateLimiter(limit=20, window_seconds=10)

ERROR_CODES = {
    400: "bad_request",
    403: "not_a_member",
    404: "conversation_not_found",
    422: "invalid_message",
    429: "rate_limited",
}


async def _presence_peers(db: Any, user_id: ObjectId) -> list[str]:
    conversation_ids = await db.conversations.distinct("_id", {"members.user_id": user_id})
    if not conversation_ids:
        return []
    peers = await db.conversations.distinct(
        "members.user_id", {"_id": {"$in": conversation_ids}}
    )
    return [str(peer) for peer in peers if peer != user_id]


async def _send_error(
    websocket: WebSocket, code: str, message: str, client_id: str | None = None
) -> None:
    data: dict[str, Any] = {"code": code, "message": message}
    if client_id:
        data["client_id"] = client_id
    try:
        await websocket.send_json({"type": "error", "data": data})
    except Exception:
        pass


@router.websocket("/ws")
async def chat_socket(websocket: WebSocket, token: str = Query(default="")) -> None:
    db = get_db()
    user: dict[str, Any] | None = None

    if token:
        try:
            user = await db.users.find_one({"_id": ObjectId(decode_access_token(token))})
        except (ValueError, InvalidId, TypeError):
            user = None

    if user is None:
        await websocket.close(code=4401)
        return

    user_id = str(user["_id"])
    await websocket.accept()
    await hub.connect(user_id, websocket)

    peers = await _presence_peers(db, user["_id"])
    try:
        await websocket.send_json(
            {
                "type": "ready",
                "data": {
                    "user_id": user_id,
                    "online_user_ids": [peer for peer in peers if hub.is_online(peer)],
                },
            }
        )
        await hub.broadcast(
            peers,
            {"type": "presence", "data": {"user_id": user_id, "online": True}},
        )

        while True:
            raw = await websocket.receive_text()
            await _handle_client_event(websocket, db, user, raw, peers)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket connection failed for user %s", user_id)
    finally:
        await hub.disconnect(user_id, websocket)
        try:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"last_seen_at": datetime.now(UTC)}},
            )
        except Exception:
            logger.warning("Could not update last_seen for user %s", user_id)
        try:
            await hub.broadcast(
                peers,
                {"type": "presence", "data": {"user_id": user_id, "online": False}},
            )
        except Exception:
            logger.warning("Could not broadcast offline presence for user %s", user_id)


async def _handle_client_event(
    websocket: WebSocket,
    db: Any,
    user: dict[str, Any],
    raw: str,
    peers: list[str],
) -> None:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        await _send_error(websocket, "invalid_json", "Could not parse the event payload")
        return

    if not isinstance(payload, dict):
        await _send_error(websocket, "invalid_event", "Event payload must be an object")
        return

    event_type = payload.get("type")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    if event_type == "ping":
        await websocket.send_json({"type": "pong", "data": {}})
        return

    if event_type == "message.ack":
        try:
            conversation = await get_conversation_for_user(
                db, str(data.get("conversation_id", "")), user["_id"]
            )
            await mark_read(db, conversation, user["_id"])
        except HTTPException:
            # Read markers are best-effort; never disrupt the socket for them.
            pass
        return

    if event_type != "message.send":
        await _send_error(websocket, "unsupported_event", f"Unknown event: {event_type}")
        return

    client_id = data.get("client_id")
    client_id = str(client_id) if client_id is not None else ""
    text = data.get("text")

    if not isinstance(text, str) or not text.strip():
        await _send_error(websocket, "empty_message", "Message cannot be empty", client_id)
        return

    try:
        message_limiter.check(str(user["_id"]))
        conversation = await get_conversation_for_user(
            db, str(data.get("conversation_id", "")), user["_id"]
        )
        message, created = await create_message(db, conversation, user, text, client_id)
    except HTTPException as exc:
        await _send_error(
            websocket,
            ERROR_CODES.get(exc.status_code, "message_failed"),
            exc.detail,
            client_id,
        )
        return
    except Exception:
        logger.exception("Failed to persist message from user %s", user["_id"])
        await _send_error(websocket, "message_failed", "Could not send message", client_id)
        return

    if created:
        await broadcast_new_message(conversation, message, user)
    else:
        # Idempotent resend: confirm the stored copy to this socket only.
        await websocket.send_json(
            {
                "type": "message.sent",
                "data": {
                    "conversation_id": str(conversation["_id"]),
                    "message": serialize_message(message),
                    "client_id": client_id,
                },
            }
        )
