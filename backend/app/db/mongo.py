from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> AsyncIOMotorDatabase:
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(
        settings.mongodb_uri,
        tz_aware=True,
        uuidRepresentation="standard",
        serverSelectionTimeoutMS=5000,
    )
    _db = _client[settings.mongodb_db]
    await _db.command("ping")
    await ensure_indexes(_db)
    return _db


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database is not connected")
    return _db


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index([("username", ASCENDING)], unique=True)
    await db.conversations.create_index(
        [("members.user_id", ASCENDING), ("updated_at", DESCENDING)]
    )
    await db.conversations.create_index(
        [("direct_key", ASCENDING)],
        unique=True,
        partialFilterExpression={"type": "direct"},
    )
    await db.messages.create_index(
        [("conversation_id", ASCENDING), ("created_at", DESCENDING), ("_id", DESCENDING)]
    )
    await db.messages.create_index(
        [("conversation_id", ASCENDING), ("client_id", ASCENDING)], unique=True
    )


async def db_health() -> dict[str, Any]:
    db = get_db()
    await db.command("ping")
    return {"ok": True}
