import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# On Windows the default ProactorEventLoop is incompatible with psycopg's async
# mode; the selector loop is required. Must run before the event loop is created.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, files, search, topics, versions
from app.core.config import settings
from app.core.database import engine
from app.models import Base  # noqa: F401  (imports all models so metadata is populated)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT != "development" and settings.SECRET_KEY.startswith("dev-secret"):
        logging.getLogger("uvicorn.error").warning(
            "SECRET_KEY is the insecure dev default — set a real SECRET_KEY in production!"
        )
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, topics, versions, files, search):
    app.include_router(module.router, prefix=settings.API_PREFIX)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"name": settings.PROJECT_NAME, "docs": "/docs"}
