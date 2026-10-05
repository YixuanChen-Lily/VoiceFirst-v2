from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .core.settings import get_allowed_origins


def create_app() -> FastAPI:
    """
    Application factory so tests and ASGI servers can reuse the same setup.
    """
    app = FastAPI(title="Proposal Builder API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()
