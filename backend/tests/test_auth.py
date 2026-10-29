from httpx import AsyncClient

from tests.utils import DEFAULT_PASSWORD, auth, login, register


async def test_register_returns_token_and_user(client: AsyncClient) -> None:
    data = await register(client, "emily", "Emily Carter")

    assert data["token"]
    assert data["user"]["username"] == "emily"
    assert data["user"]["display_name"] == "Emily Carter"
    assert data["user"]["avatar_color"].startswith("#")


async def test_username_is_case_insensitive_and_unique(client: AsyncClient) -> None:
    await register(client, "Emily")

    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "emily", "display_name": "Copy cat", "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 409
    assert "taken" in response.json()["detail"].lower()


async def test_login_and_me(client: AsyncClient) -> None:
    await register(client, "emily")
    data = await login(client, "emily")

    response = await client.get("/api/v1/auth/me", headers=auth(data["token"]))
    assert response.status_code == 200
    assert response.json()["username"] == "emily"


async def test_login_with_wrong_password_is_rejected(client: AsyncClient) -> None:
    await register(client, "emily")

    response = await client.post(
        "/api/v1/auth/login", json={"username": "emily", "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


async def test_invalid_token_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me", headers=auth("not-a-token"))
    assert response.status_code == 401


async def test_register_validates_username_format(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "not valid", "display_name": "Nope", "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 422


async def test_password_must_be_long_enough(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "shorty", "display_name": "Short", "password": "short"},
    )
    assert response.status_code == 422


async def test_logout_returns_no_content(client: AsyncClient) -> None:
    data = await register(client, "emily")
    response = await client.post("/api/v1/auth/logout", headers=auth(data["token"]))
    assert response.status_code == 204
