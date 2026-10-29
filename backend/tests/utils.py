from typing import Any

from httpx import AsyncClient

DEFAULT_PASSWORD = "correct-horse-42"


async def register(
    client: AsyncClient,
    username: str,
    display_name: str | None = None,
    password: str = DEFAULT_PASSWORD,
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "display_name": display_name or username.title(),
            "password": password,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def login(
    client: AsyncClient, username: str, password: str = DEFAULT_PASSWORD
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def start_direct(
    client: AsyncClient, token: str, other_user_id: str
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/conversations/direct",
        json={"user_id": other_user_id},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    return response.json()


async def send_message(
    client: AsyncClient, token: str, conversation_id: str, text: str, client_id: str
) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"text": text, "client_id": client_id},
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()
