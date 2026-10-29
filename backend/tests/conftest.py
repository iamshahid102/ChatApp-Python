import os

os.environ["APP_ENV"] = "test"
os.environ["MONGODB_URI"] = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017")
os.environ["MONGODB_DB"] = "chatapp_test"
os.environ["JWT_SECRET"] = "test-secret-value-at-least-32-bytes-long"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes.auth import login_limiter
from app.core.config import get_settings
from app.db.mongo import close_db, connect_db, ensure_indexes
from app.main import app
from app.ws.router import message_limiter


@pytest.fixture
async def client():
    login_limiter.reset()
    message_limiter.reset()
    db = await connect_db()
    await db.client.drop_database(get_settings().mongodb_db)
    await ensure_indexes(db)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as async_client:
        yield async_client

    await close_db()
