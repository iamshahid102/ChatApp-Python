from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.models.schemas import ConversationSummary, MessageOut, MessagePage
from app.services.users import multi_user_public, user_public

MAX_MESSAGE_LENGTH = 2000


def utcnow() -> datetime:
    return datetime.now(UTC)


def object_id(value: str, *, label: str = "Resource") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found"
        ) from exc


def direct_key(first: ObjectId, second: ObjectId) -> str:
    return ":".join(sorted([str(first), str(second)]))


async def get_conversation_for_user(
    db: Any, conversation_id: str, user_id: ObjectId
) -> dict[str, Any]:
    cid = object_id(conversation_id, label="Conversation")
    conversation = await db.conversations.find_one({"_id": cid, "members.user_id": user_id})
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def member_ids(conversation: dict[str, Any]) -> list[str]:
    return [str(member["user_id"]) for member in conversation["members"]]


async def _unread_count(
    db: Any, conversation: dict[str, Any], viewer_id: ObjectId
) -> int:
    read_at = (conversation.get("reads") or {}).get(str(viewer_id))
    query: dict[str, Any] = {
        "conversation_id": conversation["_id"],
        "sender_id": {"$ne": viewer_id},
    }
    if read_at is not None:
        query["created_at"] = {"$gt": read_at}
    return int(await db.messages.count_documents(query))


async def conversation_summary(
    db: Any,
    conversation: dict[str, Any],
    viewer_id: ObjectId,
    users_map: dict[str, dict[str, Any]] | None = None,
) -> ConversationSummary:
    if users_map is None:
        ids = [member["user_id"] for member in conversation["members"]]
        documents = await db.users.find({"_id": {"$in": ids}}).to_list(length=None)
        users_map = multi_user_public(documents)

    members = [
        users_map[str(member["user_id"])]
        for member in conversation["members"]
        if str(member["user_id"]) in users_map
    ]
    last = conversation.get("last_message")
    last_message = None
    if last:
        last_message = {
            "text": last.get("text", ""),
            "sender_id": str(last.get("sender_id", "")),
            "created_at": last.get("created_at", conversation["updated_at"]),
        }

    return ConversationSummary(
        id=str(conversation["_id"]),
        type=conversation["type"],
        name=conversation.get("name"),
        owner_id=str(conversation["owner_id"]) if conversation.get("owner_id") else None,
        members=members,
        last_message=last_message,
        unread_count=await _unread_count(db, conversation, viewer_id),
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"],
    )


async def conversation_summaries(
    db: Any, conversations: list[dict[str, Any]], viewer_id: ObjectId
) -> list[ConversationSummary]:
    ids = {member["user_id"] for convo in conversations for member in convo["members"]}
    documents = await db.users.find({"_id": {"$in": list(ids)}}).to_list(length=None)
    users_map = multi_user_public(documents)
    return [
        await conversation_summary(db, convo, viewer_id, users_map) for convo in conversations
    ]


def serialize_message(message: dict[str, Any]) -> dict[str, Any]:
    return MessageOut(
        id=str(message["_id"]),
        conversation_id=str(message["conversation_id"]),
        sender_id=str(message["sender_id"]),
        text=message["text"],
        client_id=message.get("client_id", ""),
        created_at=message["created_at"],
    ).model_dump(mode="json")


async def create_message(
    db: Any,
    conversation: dict[str, Any],
    sender: dict[str, Any],
    text: str,
    client_id: str,
) -> tuple[dict[str, Any], bool]:
    """Persist a message. Returns (message, created) and is idempotent on client_id."""
    cleaned = text.strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    if len(cleaned) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=422, detail=f"Message must be at most {MAX_MESSAGE_LENGTH} characters"
        )
    if not client_id or len(client_id) > 64:
        raise HTTPException(status_code=422, detail="Invalid client_id")

    conversation_id = conversation["_id"]
    existing = await db.messages.find_one(
        {"conversation_id": conversation_id, "client_id": client_id}
    )
    if existing is not None:
        return existing, False

    sender_id = sender["_id"]
    created_at = utcnow()
    document = {
        "_id": ObjectId(),
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "text": cleaned,
        "client_id": client_id,
        "created_at": created_at,
    }

    try:
        await db.messages.insert_one(document)
    except DuplicateKeyError:
        existing = await db.messages.find_one(
            {"conversation_id": conversation_id, "client_id": client_id}
        )
        if existing is not None:
            return existing, False
        raise

    await db.conversations.update_one(
        {"_id": conversation_id},
        {
            "$set": {
                "last_message": {
                    "text": cleaned,
                    "sender_id": sender_id,
                    "created_at": created_at,
                },
                f"reads.{sender_id}": created_at,
                "updated_at": created_at,
            }
        },
    )
    return document, True


async def message_page(
    db: Any,
    conversation: dict[str, Any],
    *,
    before: datetime | None,
    limit: int,
) -> MessagePage:
    query: dict[str, Any] = {"conversation_id": conversation["_id"]}
    if before is not None:
        if before.tzinfo is None:
            before = before.replace(tzinfo=UTC)
        query["created_at"] = {"$lt": before}

    documents = (
        await db.messages.find(query)
        .sort([("created_at", -1), ("_id", -1)])
        .limit(limit + 1)
        .to_list(length=limit + 1)
    )
    has_more = len(documents) > limit
    documents = documents[:limit]
    documents.reverse()

    sender_ids = {document["sender_id"] for document in documents}
    users = await db.users.find({"_id": {"$in": list(sender_ids)}}).to_list(length=None)

    return MessagePage(
        messages=[
            MessageOut(
                id=str(document["_id"]),
                conversation_id=str(document["conversation_id"]),
                sender_id=str(document["sender_id"]),
                text=document["text"],
                client_id=document.get("client_id", ""),
                created_at=document["created_at"],
            )
            for document in documents
        ],
        users={str(document["_id"]): user_public(document) for document in users},
        has_more=has_more,
    )


async def mark_read(db: Any, conversation: dict[str, Any], user_id: ObjectId) -> None:
    await db.conversations.update_one(
        {"_id": conversation["_id"]}, {"$set": {f"reads.{user_id}": utcnow()}}
    )
