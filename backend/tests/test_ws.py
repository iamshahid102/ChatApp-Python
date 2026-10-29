import json
import socket
import threading
import time
from collections.abc import Iterator
from typing import Any

import httpx
import pymongo
import pytest
import uvicorn
from websockets.exceptions import InvalidStatus
from websockets.sync.client import connect

from app.main import app

PASSWORD = "correct-horse-42"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="module")
def server() -> Iterator[str]:
    sync_client = pymongo.MongoClient(
        "mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=3000
    )
    sync_client.drop_database("chatapp_test")
    sync_client.close()

    port = _free_port()
    config = uvicorn.Config(
        app, host="127.0.0.1", port=port, log_level="warning", lifespan="on"
    )
    uvicorn_server = uvicorn.Server(config)
    thread = threading.Thread(target=uvicorn_server.run, daemon=True)
    thread.start()

    deadline = time.monotonic() + 15
    while not uvicorn_server.started and time.monotonic() < deadline:
        time.sleep(0.05)
    assert uvicorn_server.started, "uvicorn did not start"

    base_url = f"http://127.0.0.1:{port}"
    try:
        yield base_url
    finally:
        uvicorn_server.should_exit = True
        thread.join(timeout=10)


def _register(http: httpx.Client, username: str) -> dict[str, Any]:
    response = http.post(
        "/api/v1/auth/register",
        json={"username": username, "display_name": username.title(), "password": PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _recv(socket: Any) -> dict[str, Any]:
    return json.loads(socket.recv(timeout=5))


def test_invalid_token_is_rejected(server: str) -> None:
    with pytest.raises(InvalidStatus) as error:
        with connect(f"ws://127.0.0.1:{server.rsplit(':', 1)[1]}/ws?token=not-valid"):
            pass
    assert error.value.response.status_code == 403


def test_direct_message_is_delivered_in_real_time(server: str) -> None:
    port = server.rsplit(":", 1)[1]
    with httpx.Client(base_url=server, timeout=10) as http:
        alice = _register(http, "wsalice")
        bob = _register(http, "wsbob")
        conversation = http.post(
            "/api/v1/conversations/direct",
            json={"user_id": bob["user"]["id"]},
            headers=_auth(alice["token"]),
        )
        assert conversation.status_code == 200, conversation.text
        conversation_id = conversation.json()["id"]

        with connect(f"ws://127.0.0.1:{port}/ws?token={alice['token']}") as socket_alice:
            assert _recv(socket_alice)["type"] == "ready"

            with connect(f"ws://127.0.0.1:{port}/ws?token={bob['token']}") as socket_bob:
                assert _recv(socket_bob)["type"] == "ready"

                presence = _recv(socket_alice)
                assert presence["type"] == "presence"
                assert presence["data"] == {"user_id": bob["user"]["id"], "online": True}

                socket_alice.send(
                    json.dumps(
                        {
                            "type": "message.send",
                            "data": {
                                "conversation_id": conversation_id,
                                "text": "Hello Bob",
                                "client_id": "ws-msg-1",
                            },
                        }
                    )
                )

                sent = _recv(socket_alice)
                assert sent["type"] == "message.sent"
                assert sent["data"]["message"]["text"] == "Hello Bob"
                assert sent["data"]["client_id"] == "ws-msg-1"

                delivered = _recv(socket_bob)
                assert delivered["type"] == "message.new"
                assert delivered["data"]["message"]["text"] == "Hello Bob"
                assert delivered["data"]["sender"]["username"] == "wsalice"

                # Idempotent resend: same stored message, no second broadcast.
                socket_alice.send(
                    json.dumps(
                        {
                            "type": "message.send",
                            "data": {
                                "conversation_id": conversation_id,
                                "text": "Hello Bob",
                                "client_id": "ws-msg-1",
                            },
                        }
                    )
                )
                resent = _recv(socket_alice)
                assert resent["type"] == "message.sent"
                assert resent["data"]["message"]["id"] == sent["data"]["message"]["id"]

                socket_bob.send(
                    json.dumps(
                        {
                            "type": "message.ack",
                            "data": {"conversation_id": conversation_id},
                        }
                    )
                )
                time.sleep(0.2)

        history = http.get(
            f"/api/v1/conversations/{conversation_id}/messages",
            headers=_auth(bob["token"]),
        )
        assert history.status_code == 200
        assert len(history.json()["messages"]) == 1
        assert history.json()["messages"][0]["text"] == "Hello Bob"


def test_non_member_cannot_send_via_socket(server: str) -> None:
    port = server.rsplit(":", 1)[1]
    with httpx.Client(base_url=server, timeout=10) as http:
        alice = _register(http, "wsalice2")
        bob = _register(http, "wsbob2")
        outsider = _register(http, "wsout")
        conversation = http.post(
            "/api/v1/conversations/direct",
            json={"user_id": bob["user"]["id"]},
            headers=_auth(alice["token"]),
        ).json()

        with connect(f"ws://127.0.0.1:{port}/ws?token={outsider['token']}") as socket:
            assert _recv(socket)["type"] == "ready"
            socket.send(
                json.dumps(
                    {
                        "type": "message.send",
                        "data": {
                            "conversation_id": conversation["id"],
                            "text": "Let me in",
                            "client_id": "intruder-1",
                        },
                    }
                )
            )
            error = _recv(socket)
            assert error["type"] == "error"
            assert error["data"]["code"] in {"not_a_member", "conversation_not_found"}


def test_empty_message_returns_error_event(server: str) -> None:
    port = server.rsplit(":", 1)[1]
    with httpx.Client(base_url=server, timeout=10) as http:
        alice = _register(http, "wsempty")
        bob = _register(http, "wsemptybob")
        conversation = http.post(
            "/api/v1/conversations/direct",
            json={"user_id": bob["user"]["id"]},
            headers=_auth(alice["token"]),
        ).json()

        with connect(f"ws://127.0.0.1:{port}/ws?token={alice['token']}") as socket:
            assert _recv(socket)["type"] == "ready"
            socket.send(
                json.dumps(
                    {
                        "type": "message.send",
                        "data": {
                            "conversation_id": conversation["id"],
                            "text": "   ",
                            "client_id": "empty-1",
                        },
                    }
                )
            )
            error = _recv(socket)
            assert error["type"] == "error"
            assert error["data"]["code"] == "empty_message"
