from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.db.mongo import get_db
from app.models.schemas import MessageCreateRequest, MessageOut, MessagePage
from app.services.chat import (
    create_message,
    get_conversation_for_user,
    mark_read,
    message_page,
    serialize_message,
)
from app.ws.events import broadcast_new_message

router = APIRouter(prefix="/conversations", tags=["messages"])


@router.get("/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: str,
    before: datetime | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=50),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessagePage:
    conversation = await get_conversation_for_user(db, conversation_id, current_user["_id"])
    return await message_page(db, conversation, before=before, limit=limit)


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: str,
    payload: MessageCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageOut:
    conversation = await get_conversation_for_user(db, conversation_id, current_user["_id"])
    message, created = await create_message(
        db, conversation, current_user, payload.text, payload.client_id
    )
    if created:
        await broadcast_new_message(conversation, message, current_user)
    return MessageOut(**serialize_message(message))


@router.post("/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_conversation(
    conversation_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    conversation = await get_conversation_for_user(db, conversation_id, current_user["_id"])
    await mark_read(db, conversation, current_user["_id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
