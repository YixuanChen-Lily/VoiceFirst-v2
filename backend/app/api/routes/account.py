from fastapi import APIRouter, Depends

from ...core.auth import User, get_current_user
from ...schemas.account import MeOut

router = APIRouter(tags=["account"])


@router.get("/me", response_model=MeOut)
async def read_me(user: User = Depends(get_current_user)) -> MeOut:
    """Who is signed in, whether they may manage the library, and whether their use is capped."""
    return MeOut(
        id=user.id,
        email=user.email,
        is_admin=user.is_admin,
        is_guest=user.is_guest,
        has_full_access=user.has_full_access,
    )
