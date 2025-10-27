import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router


def _get_allowed_origins() -> List[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "*",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ]


def create_app() -> FastAPI:
    """
    Application factory so tests and ASGI servers can reuse the same setup.
    """
    app = FastAPI(title="Proposal Builder API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()
