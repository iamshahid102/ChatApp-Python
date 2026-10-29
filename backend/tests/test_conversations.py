from httpx import AsyncClient

from tests.utils import auth, register, send_message, start_direct


async def test_direct_conversation_is_idempotent(client: AsyncClient) -> None:
    alice = await register(client, "alice", "Alice")
    bob = await register(client, "bob", "Bob")

    first = await start_direct(client, alice["token"], bob["user"]["id"])
    second = await start_direct(client, alice["token"], bob["user"]["id"])
    from_bob = await start_direct(client, bob["token"], alice["user"]["id"])

    assert first["id"] == second["id"] == from_bob["id"]
    assert len(first["members"]) == 2
    assert first["type"] == "direct"


async def test_cannot_start_chat_with_yourself(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    response = await client.post(
        "/api/v1/conversations/direct",
        json={"user_id": alice["user"]["id"]},
        headers=auth(alice["token"]),
    )
    assert response.status_code == 400


async def test_group_creation_and_members(client: AsyncClient) -> None:
    alice = await register(client, "alice", "Alice")
    bob = await register(client, "bob", "Bob")
    carol = await register(client, "carol", "Carol")

    response = await client.post(
        "/api/v1/conversations/group",
        json={"name": "Design team", "member_ids": [bob["user"]["id"], carol["user"]["id"]]},
        headers=auth(alice["token"]),
    )
    assert response.status_code == 201, response.text
    group = response.json()
    assert group["name"] == "Design team"
    assert group["type"] == "group"
    assert {member["username"] for member in group["members"]} == {"alice", "bob", "carol"}

    detail = await client.get(
        f"/api/v1/conversations/{group['id']}", headers=auth(bob["token"])
    )
    assert detail.status_code == 200
    assert detail.json()["owner_id"] == alice["user"]["id"]


async def test_non_member_cannot_read_conversation(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    carol = await register(client, "carol")
    direct = await start_direct(client, alice["token"], bob["user"]["id"])

    response = await client.get(
        f"/api/v1/conversations/{direct['id']}", headers=auth(carol["token"])
    )
    assert response.status_code == 404


async def test_only_owner_can_add_members(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    carol = await register(client, "carol")

    created = await client.post(
        "/api/v1/conversations/group",
        json={"name": "Team", "member_ids": [bob["user"]["id"]]},
        headers=auth(alice["token"]),
    )
    group = created.json()

    forbidden = await client.post(
        f"/api/v1/conversations/{group['id']}/members",
        json={"member_ids": [carol["user"]["id"]]},
        headers=auth(bob["token"]),
    )
    assert forbidden.status_code == 403

    allowed = await client.post(
        f"/api/v1/conversations/{group['id']}/members",
        json={"member_ids": [carol["user"]["id"]]},
        headers=auth(alice["token"]),
    )
    assert allowed.status_code == 200
    assert len(allowed.json()["members"]) == 3


async def test_leaving_group_transfers_ownership(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")

    created = await client.post(
        "/api/v1/conversations/group",
        json={"name": "Team", "member_ids": [bob["user"]["id"]]},
        headers=auth(alice["token"]),
    )
    group_id = created.json()["id"]

    left = await client.delete(
        f"/api/v1/conversations/{group_id}/members/{alice['user']['id']}",
        headers=auth(alice["token"]),
    )
    assert left.status_code == 204

    detail = await client.get(f"/api/v1/conversations/{group_id}", headers=auth(bob["token"]))
    assert detail.status_code == 200
    assert detail.json()["owner_id"] == bob["user"]["id"]
    assert len(detail.json()["members"]) == 1

    alice_view = await client.get(
        f"/api/v1/conversations/{group_id}", headers=auth(alice["token"])
    )
    assert alice_view.status_code == 404


async def test_unread_count_and_read_marker(client: AsyncClient) -> None:
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    direct = await start_direct(client, alice["token"], bob["user"]["id"])

    await send_message(client, alice["token"], direct["id"], "Hey Bob", "msg-1")

    bob_list = await client.get("/api/v1/conversations", headers=auth(bob["token"]))
    assert bob_list.status_code == 200
    assert bob_list.json()[0]["unread_count"] == 1
    assert bob_list.json()[0]["last_message"]["text"] == "Hey Bob"

    read = await client.post(
        f"/api/v1/conversations/{direct['id']}/read", headers=auth(bob["token"])
    )
    assert read.status_code == 204

    bob_list = await client.get("/api/v1/conversations", headers=auth(bob["token"]))
    assert bob_list.json()[0]["unread_count"] == 0


async def test_users_search(client: AsyncClient) -> None:
    alice = await register(client, "alice", "Alice")
    await register(client, "bob", "Bob Builder")

    response = await client.get(
        "/api/v1/users", params={"q": "bob"}, headers=auth(alice["token"])
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["username"] == "bob"

    me = await client.get("/api/v1/users", params={"q": "alice"}, headers=auth(alice["token"]))
    assert me.json() == []
