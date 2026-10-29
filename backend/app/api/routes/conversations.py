from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.mongo import get_db
from app.models.schemas import (
    AddMembersRequest,
    ConversationSummary,
    DirectCreateRequest,
    GroupCreateRequest,
)
from app.services.chat import (
    conversation_summaries,
    conversation_summary,
    direct_key,
    object_id,
)
from app.services.users import user_public
from app.ws.events import broadcast_conversation_updated
from app.ws.hub import hub

router = APIRouter(prefix="/conversations", tags=["conversations"])


async def _load_users(db: AsyncIOMotorDatabase, ids: list[Any]) -> dict[str, dict[str, Any]]:
    documents = await db.users.find({"_id": {"$in": ids}}).to_list(length=None)
    return {str(document["_id"]): user_public(document) for document in documents}


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ConversationSummary]:
    conversations = (
        await db.conversations.find({"members.user_id": current_user["_id"]})
        .sort("updated_at", -1)
        .limit(100)
        .to_list(length=100)
    )
    return await conversation_summaries(db, conversations, current_user["_id"])


@router.post("/direct", response_model=ConversationSummary)
async def create_direct_conversation(
    payload: DirectCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ConversationSummary:
    target_id = object_id(payload.user_id, label="User")
    if target_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="You cannot chat with yourself")

    target = await db.users.find_one({"_id": target_id})
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    key = direct_key(current_user["_id"], target_id)
    now = datetime.now(UTC)
    set_on_insert = {
        "type": "direct",
        "direct_key": key,
        "members": [
            {"user_id": current_user["_id"], "joined_at": now},
            {"user_id": target_id, "joined_at": now},
        ],
        "reads": {},
        "last_message": None,
        "created_at": now,
        "updated_at": now,
    }

    try:
        conversation = await db.conversations.find_one_and_update(
            {"direct_key": key},
            {"$setOnInsert": set_on_insert},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        conversation = await db.conversations.find_one({"direct_key": key})

    if conversation is None:
        raise HTTPException(status_code=500, detail="Could not create conversation")
    return await conversation_summary(db, conversation, current_user["_id"])


@router.post("/group", response_model=ConversationSummary, status_code=status.HTTP_201_CREATED)
async def create_group_conversation(
    payload: GroupCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ConversationSummary:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Group name is required")

    ids = {current_user["_id"]}
    for raw in payload.member_ids:
        ids.add(object_id(raw, label="User"))

    if len(ids) > get_settings().max_group_members:
        raise HTTPException(
            status_code=400,
            detail=f"A group can have at most {get_settings().max_group_members} members",
        )

    users = await db.users.find({"_id": {"$in": list(ids)}}).to_list(length=None)
    if len(users) != len(ids):
        raise HTTPException(status_code=400, detail="One or more members were not found")

    now = datetime.now(UTC)
    ordered_ids = [current_user["_id"], *sorted(ids - {current_user["_id"]}, key=str)]
    document = {
        "type": "group",
        "name": name,
        "owner_id": current_user["_id"],
        "members": [{"user_id": user_id, "joined_at": now} for user_id in ordered_ids],
        "reads": {},
        "last_message": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.conversations.insert_one(document)
    document["_id"] = result.inserted_id

    await broadcast_conversation_updated(document)
    return await conversation_summary(db, document, current_user["_id"])


@router.get("/{conversation_id}", response_model=ConversationSummary)
async def get_conversation(
    conversation_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ConversationSummary:
    conversation = await db.conversations.find_one(
        {
            "_id": object_id(conversation_id, label="Conversation"),
            "members.user_id": current_user["_id"],
        }
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await conversation_summary(db, conversation, current_user["_id"])


@router.post("/{conversation_id}/members", response_model=ConversationSummary)
async def add_members(
    conversation_id: str,
    payload: AddMembersRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ConversationSummary:
    conversation = await db.conversations.find_one(
        {
            "_id": object_id(conversation_id, label="Conversation"),
            "members.user_id": current_user["_id"],
        }
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation["type"] != "group":
        raise HTTPException(status_code=400, detail="Only groups can have members added")
    if conversation.get("owner_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the group owner can add members")

    existing = {member["user_id"] for member in conversation["members"]}
    new_ids = {object_id(raw, label="User") for raw in payload.member_ids} - existing
    if not new_ids:
        raise HTTPException(status_code=400, detail="Those users are already members")
    if len(existing) + len(new_ids) > get_settings().max_group_members:
        raise HTTPException(
            status_code=400,
            detail=f"A group can have at most {get_settings().max_group_members} members",
        )

    found = await db.users.find({"_id": {"$in": list(new_ids)}}).to_list(length=None)
    if len(found) != len(new_ids):
        raise HTTPException(status_code=400, detail="One or more members were not found")

    now = datetime.now(UTC)
    await db.conversations.update_one(
        {"_id": conversation["_id"]},
        {
            "$push": {
                "members": {
                    "$each": [
                        {"user_id": user_id, "joined_at": now}
                        for user_id in sorted(new_ids, key=str)
                    ]
                }
            },
            "$set": {"updated_at": now},
        },
    )
    conversation = await db.conversations.find_one({"_id": conversation["_id"]})
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await broadcast_conversation_updated(conversation)
    return await conversation_summary(db, conversation, current_user["_id"])


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: str,
    user_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    conversation = await db.conversations.find_one(
        {
            "_id": object_id(conversation_id, label="Conversation"),
            "members.user_id": current_user["_id"],
        }
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    target_id = object_id(user_id, label="User")
    is_self = target_id == current_user["_id"]
    is_owner = conversation.get("owner_id") == current_user["_id"]
    if not is_self and not is_owner:
        raise HTTPException(status_code=403, detail="Only the group owner can remove members")
    if not any(member["user_id"] == target_id for member in conversation["members"]):
        raise HTTPException(status_code=404, detail="That user is not a member")

    remaining = [
        member for member in conversation["members"] if member["user_id"] != target_id
    ]

    if not remaining:
        await db.conversations.delete_one({"_id": conversation["_id"]})
        await db.messages.delete_many({"conversation_id": conversation["_id"]})
        await hub.send_to_user(
            str(target_id),
            {
                "type": "conversation.updated",
                "data": {
                    "conversation": {"id": str(conversation["_id"])},
                    "removed": True,
                },
            },
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    updates: dict[str, Any] = {
        "members": remaining,
        "updated_at": datetime.now(UTC),
    }
    if is_owner and conversation["type"] == "group":
        updates["owner_id"] = remaining[0]["user_id"]

    await db.conversations.update_one({"_id": conversation["_id"]}, {"$set": updates})
    refreshed = await db.conversations.find_one({"_id": conversation["_id"]})
    if refreshed is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    await broadcast_conversation_updated(refreshed)
    await hub.send_to_user(
        str(target_id),
        {
            "type": "conversation.updated",
            "data": {
                "conversation": {"id": str(conversation["_id"])},
                "removed": True,
            },
        },
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
