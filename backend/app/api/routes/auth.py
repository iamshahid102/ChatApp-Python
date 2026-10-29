from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_current_user
from app.core.ratelimit import RateLimiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongo import get_db
from app.models.schemas import AuthResponse, LoginRequest, RegisterRequest, UserPublic
from app.services.users import avatar_color, user_public

router = APIRouter(prefix="/auth", tags=["auth"])

login_limiter = RateLimiter(limit=10, window_seconds=300)

# Hashing a dummy value keeps failed-login timing similar for unknown usernames.
_DUMMY_HASH = hash_password("not-a-real-password")


def _client_key(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest, db: AsyncIOMotorDatabase = Depends(get_db)
) -> AuthResponse:
    username = payload.username.strip().lower()
    display_name = payload.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="Display name is required")

    password_hash = await run_in_threadpool(hash_password, payload.password)
    now = datetime.now(UTC)
    document: dict[str, Any] = {
        "username": username,
        "display_name": display_name,
        "password_hash": password_hash,
        "avatar_color": avatar_color(username),
        "created_at": now,
        "last_seen_at": now,
    }

    try:
        result = await db.users.insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="That username is already taken") from exc

    document["_id"] = result.inserted_id
    return AuthResponse(
        token=create_access_token(str(result.inserted_id)),
        user=UserPublic(**user_public(document)),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> AuthResponse:
    login_limiter.check(_client_key(request))
    username = payload.username.strip().lower()

    user = await db.users.find_one({"username": username})
    password_hash = user["password_hash"] if user else _DUMMY_HASH
    valid = await run_in_threadpool(verify_password, password_hash, payload.password)

    if user is None or not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    verified_at = datetime.now(UTC)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_seen_at": verified_at}})
    user["last_seen_at"] = verified_at

    return AuthResponse(
        token=create_access_token(str(user["_id"])),
        user=UserPublic(**user_public(user)),
    )


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict[str, Any] = Depends(get_current_user)) -> UserPublic:
    return UserPublic(**user_public(current_user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: dict[str, Any] = Depends(get_current_user)) -> None:
    # Tokens are stateless in v1; the client discards its copy.
    return None
