from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_color: str
    last_seen_at: datetime | None = None

    model_config = ConfigDict(extra="forbid")


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    display_name: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=24)
    password: str = Field(min_length=1, max_length=72)


class LastMessage(BaseModel):
    text: str
    sender_id: str
    created_at: datetime


class ConversationSummary(BaseModel):
    id: str
    type: str
    name: str | None = None
    owner_id: str | None = None
    members: list[UserPublic]
    last_message: LastMessage | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime


class DirectCreateRequest(BaseModel):
    user_id: str


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    member_ids: list[str] = Field(default_factory=list)


class AddMembersRequest(BaseModel):
    member_ids: list[str] = Field(min_length=1)


class MessageCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    client_id: str = Field(min_length=1, max_length=64)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    text: str
    client_id: str
    created_at: datetime


class MessagePage(BaseModel):
    messages: list[MessageOut]
    users: dict[str, UserPublic]
    has_more: bool
