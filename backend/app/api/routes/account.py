from fastapi import APIRouter, Depends

from ...core.auth import User, get_current_user
from ...schemas.account import MeOut

router = APIRouter(tags=["account"])


@router.get("/me", response_model=MeOut)
async def read_me(user: User = Depends(get_current_user)) -> MeOut:
    """Who is signed in, and whether they may manage the library."""
    return MeOut(id=user.id, email=user.email, is_admin=user.is_admin)
