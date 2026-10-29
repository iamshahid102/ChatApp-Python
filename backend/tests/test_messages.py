from httpx import AsyncClient

from tests.utils import auth, register, send_message, start_direct


async def test_message_history_is_ordered_and_paginated(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    direct = await start_direct(client, alice["token"], bob["user"]["id"])

    for index in range(5):
        await send_message(client, alice["token"], direct["id"], f"Message {index}", f"m-{index}")

    first_page = await client.get(
        f"/api/v1/conversations/{direct['id']}/messages",
        params={"limit": 2},
        headers=auth(bob["token"]),
    )
    assert first_page.status_code == 200, first_page.text
    body = first_page.json()
    assert [message["text"] for message in body["messages"]] == ["Message 3", "Message 4"]
    assert body["has_more"] is True
    assert body["users"][alice["user"]["id"]]["username"] == "alice"

    oldest = body["messages"][0]["created_at"]
    second_page = await client.get(
        f"/api/v1/conversations/{direct['id']}/messages",
        params={"limit": 2, "before": oldest},
        headers=auth(bob["token"]),
    )
    assert [message["text"] for message in second_page.json()["messages"]] == [
        "Message 1",
        "Message 2",
    ]


async def test_duplicate_client_id_is_idempotent(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    direct = await start_direct(client, alice["token"], bob["user"]["id"])

    first = await send_message(client, alice["token"], direct["id"], "Once", "same-id")
    second = await send_message(client, alice["token"], direct["id"], "Once", "same-id")

    assert first["id"] == second["id"]

    history = await client.get(
        f"/api/v1/conversations/{direct['id']}/messages", headers=auth(bob["token"])
    )
    assert len(history.json()["messages"]) == 1


async def test_blank_message_is_rejected(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    direct = await start_direct(client, alice["token"], bob["user"]["id"])

    response = await client.post(
        f"/api/v1/conversations/{direct['id']}/messages",
        json={"text": "   ", "client_id": "blank"},
        headers=auth(alice["token"]),
    )
    assert response.status_code == 422


async def test_non_member_cannot_send_or_read_messages(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    carol = await register(client, "carol")
    direct = await start_direct(client, alice["token"], bob["user"]["id"])

    send = await client.post(
        f"/api/v1/conversations/{direct['id']}/messages",
        json={"text": "Sneaky", "client_id": "x-1"},
        headers=auth(carol["token"]),
    )
    assert send.status_code == 404

    read = await client.get(
        f"/api/v1/conversations/{direct['id']}/messages", headers=auth(carol["token"])
    )
    assert read.status_code == 404


async def test_conversation_list_is_sorted_by_activity(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    carol = await register(client, "carol")

    first = await start_direct(client, alice["token"], bob["user"]["id"])
    second = await start_direct(client, alice["token"], carol["user"]["id"])

    await send_message(client, alice["token"], first["id"], "Older", "a-1")
    await send_message(client, alice["token"], second["id"], "Newer", "a-2")

    listing = await client.get("/api/v1/conversations", headers=auth(alice["token"]))
    ids = [conversation["id"] for conversation in listing.json()]
    assert ids[0] == second["id"]
    assert set(ids) == {first["id"], second["id"]}
