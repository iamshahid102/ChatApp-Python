from typing import Any

from app.models.schemas import UserPublic
from app.services.chat import member_ids, serialize_message
from app.services.users import user_public
from app.ws.hub import hub


def user_payload(document: dict[str, Any]) -> dict[str, Any]:
    """JSON-safe user object for websocket frames."""
    return UserPublic(**user_public(document)).model_dump(mode="json")


def conversation_brief(conversation: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(conversation["_id"]),
        "type": conversation["type"],
        "name": conversation.get("name"),
        "owner_id": str(conversation["owner_id"]) if conversation.get("owner_id") else None,
        "member_ids": member_ids(conversation),
        "updated_at": conversation["updated_at"].isoformat(),
    }


async def broadcast_new_message(
    conversation: dict[str, Any], message: dict[str, Any], sender: dict[str, Any]
) -> None:
    sender_id = str(sender["_id"])
    message_payload = serialize_message(message)
    recipients = [user_id for user_id in member_ids(conversation) if user_id != sender_id]

    await hub.broadcast(
        recipients,
        {
            "type": "message.new",
            "data": {
                "conversation_id": str(conversation["_id"]),
                "message": message_payload,
                "sender": user_payload(sender),
            },
        },
    )
    # Every tab of the sender gets the confirmed copy so optimistic bubbles reconcile.
    await hub.send_to_user(
        sender_id,
        {
            "type": "message.sent",
            "data": {
                "conversation_id": str(conversation["_id"]),
                "message": message_payload,
                "client_id": message.get("client_id", ""),
            },
        },
    )


async def broadcast_conversation_updated(conversation: dict[str, Any]) -> None:
    await hub.broadcast(
        member_ids(conversation),
        {
            "type": "conversation.updated",
            "data": {"conversation": conversation_brief(conversation)},
        },
    )
