import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.db.mongo import get_db
from app.models.schemas import UserPublic
from app.services.chat import object_id
from app.services.users import user_public

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
async def search_users(
    q: str = Query(default="", max_length=50),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserPublic]:
    query: dict[str, Any] = {"_id": {"$ne": current_user["_id"]}}
    term = q.strip()
    if term:
        pattern = re.escape(term)
        query["$or"] = [
            {"username": {"$regex": pattern, "$options": "i"}},
            {"display_name": {"$regex": pattern, "$options": "i"}},
        ]

    documents = await (
        db.users.find(query)
        .sort([("display_name", 1), ("username", 1)])
        .limit(limit)
        .to_list(length=limit)
    )
    return [UserPublic(**user_public(document)) for document in documents]


@router.get("/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserPublic:
    document = await db.users.find_one({"_id": object_id(user_id, label="User")})
    if document is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**user_public(document))
