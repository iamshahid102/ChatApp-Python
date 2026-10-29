import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("chatapp.ws.hub")


class ConnectionHub:
    """In-memory registry of live sockets, keyed by user id."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("socket connected for %s", user_id)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(user_id)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(user_id, None)
        logger.info("socket disconnected for %s", user_id)

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    def online_user_ids(self) -> set[str]:
        return set(self._connections.keys())

    async def send_to_user(self, user_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(user_id, ()))
        await self._send_many(user_id, sockets, payload)

    async def broadcast(
        self,
        user_ids: list[str] | set[str],
        payload: dict[str, Any],
        *,
        exclude: set[str] | None = None,
    ) -> None:
        excluded = exclude or set()
        targets: list[tuple[str, list[WebSocket]]] = []
        async with self._lock:
            for user_id in user_ids:
                if user_id in excluded:
                    continue
                sockets = list(self._connections.get(user_id, ()))
                if sockets:
                    targets.append((user_id, sockets))

        for user_id, sockets in targets:
            await self._send_many(user_id, sockets, payload)

    async def _send_many(
        self, user_id: str, sockets: list[WebSocket], payload: dict[str, Any]
    ) -> None:
        dead: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                logger.exception("failed to send %s to %s", payload.get("type"), user_id)
                dead.append(socket)
        for socket in dead:
            await self.disconnect(user_id, socket)


hub = ConnectionHub()
