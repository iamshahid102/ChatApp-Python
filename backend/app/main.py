import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, conversations, messages, users
from app.core.config import get_settings
from app.db.mongo import close_db, connect_db, db_health
from app.ws.router import router as ws_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("chatapp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    logger.info("Connected to MongoDB (%s)", get_settings().mongodb_db)
    yield
    await close_db()
    logger.info("MongoDB connection closed")


app = FastAPI(
    title="ChatApp API",
    description="Simple 1:1 and group chat backend.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health", tags=["system"])
async def health() -> dict[str, object]:
    await db_health()
    return {"ok": True, "service": "chatapp-api"}


@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    return {"service": "ChatApp API", "docs": "/docs", "health": "/health"}
