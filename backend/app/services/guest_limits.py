"""
Caps for guests. Guests sign in without an email, so anyone with the link can be one;
the caps keep what a single guest can spend on the AI services and storage small.
Signed-in users with an email are not capped.
"""

from functools import lru_cache
from typing import Callable

from fastapi import Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from ..clients.usage_store import UsageStore
from ..core import database
from ..core.auth import User, get_current_user

# action: (how many uses a guest gets, what the limit message calls it)
GUEST_LIMITS = {
    "chat": (30, "assistant messages"),
    "voice": (60, "voice replies and recordings"),
    "draft_check": (5, "draft checks"),
    "draft_fill": (5, "drafts filled in"),
    "file_upload": (5, "file uploads"),
    "proposal": (5, "proposals"),
}
GUEST_MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@lru_cache(maxsize=1)
def get_usage_store() -> UsageStore:
    return UsageStore(database.get_engine())


async def use(user: User, action: str) -> None:
    """Count one use of `action` for a guest, or refuse with a 429 once their limit is reached."""
    if not user.is_guest:
        return
    if not database.is_configured():
        raise HTTPException(status_code=503, detail="Guest access is not available on this server.")
    limit, name = GUEST_LIMITS[action]
    allowed = await run_in_threadpool(get_usage_store().try_use, user.id, action, limit)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Guests can use up to {limit} {name}. Sign in with an email to keep going.",
        )


def guest_limit(action: str) -> Callable:
    """A route dependency that counts one use of `action` for guests before the route runs."""

    async def dependency(user: User = Depends(get_current_user)) -> User:
        await use(user, action)
        return user

    return dependency


def check_upload_size(user: User, size: int) -> None:
    if user.is_guest and size > GUEST_MAX_UPLOAD_BYTES:
        limit_mb = GUEST_MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Guests can upload files up to {limit_mb} MB.")
