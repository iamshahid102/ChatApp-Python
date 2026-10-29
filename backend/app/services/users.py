from datetime import datetime
from typing import Any

AVATAR_COLORS = [
    "#C7F032",
    "#0D0D0D",
    "#8FA88B",
    "#E0A458",
    "#7FA6D9",
    "#D98C8C",
    "#5B7F6A",
]


def avatar_color(username: str) -> str:
    total = sum(ord(char) for char in username)
    return AVATAR_COLORS[total % len(AVATAR_COLORS)]


def user_public(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "username": document["username"],
        "display_name": document["display_name"],
        "avatar_color": document.get("avatar_color", "#C7F032"),
        "last_seen_at": document.get("last_seen_at"),
    }


def user_private(document: dict[str, Any]) -> dict[str, Any]:
    return {
        **user_public(document),
        "created_at": document.get("created_at"),
    }


def multi_user_public(documents: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(document["_id"]): user_public(document) for document in documents}


def touch_last_seen(document: dict[str, Any], when: datetime) -> None:
    document["last_seen_at"] = when
