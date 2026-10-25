from fastapi import APIRouter, Depends

from ...core.auth import get_current_user
from . import account, assist, documents, files, proposals

# Every route needs a signed-in user.
router = APIRouter(dependencies=[Depends(get_current_user)])
router.include_router(proposals.router)
router.include_router(assist.router)
router.include_router(documents.router)
router.include_router(files.router)
router.include_router(account.router)

__all__ = ["router"]
