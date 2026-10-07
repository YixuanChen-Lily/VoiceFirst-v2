from fastapi import APIRouter

from . import assist, documents, proposals

router = APIRouter()
router.include_router(proposals.router)
router.include_router(assist.router)
router.include_router(documents.router)

__all__ = ["router"]
