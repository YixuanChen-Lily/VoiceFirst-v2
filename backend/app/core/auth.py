"""
Sign-in checks. The website signs users in with Supabase Auth and sends the
resulting token with every request; this module verifies that token.
"""

import time
from dataclasses import dataclass
from typing import Dict, Optional

import httpx
import jwt
from fastapi import Depends, Header, HTTPException

from . import settings

_JWKS_TTL_SECONDS = 600
_ALGORITHMS = ["ES256", "RS256"]


@dataclass(frozen=True)
class User:
    id: str
    email: str
    is_admin: bool
    # Signed in with "Continue as guest", without an email.
    is_guest: bool = False
    # Unlimited use. Without it, the AI features and uploads are capped (services/guest_limits.py).
    has_full_access: bool = True


# Used when AUTH_DISABLED is set, so local development works without signing in.
LOCAL_DEV_USER = User(id="local-dev", email="local-dev@localhost", is_admin=True)

_signing_keys: Dict[str, object] = {}
_signing_keys_fetched_at = 0.0


def _issuer() -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"


def _fetch_signing_keys() -> Dict[str, object]:
    """Download the project's public signing keys, keyed by key id."""
    response = httpx.get(f"{_issuer()}/.well-known/jwks.json", timeout=10.0)
    response.raise_for_status()
    return {
        key["kid"]: jwt.PyJWK.from_dict(key).key
        for key in response.json().get("keys", [])
        if key.get("kid")
    }


def _signing_key(key_id: str):
    """Look up a signing key, refreshing the cached set when it is stale or the id is new."""
    global _signing_keys, _signing_keys_fetched_at
    stale = time.monotonic() - _signing_keys_fetched_at > _JWKS_TTL_SECONDS
    if stale or key_id not in _signing_keys:
        _signing_keys = _fetch_signing_keys()
        _signing_keys_fetched_at = time.monotonic()
    return _signing_keys.get(key_id)


def verify_token(token: str) -> User:
    """Check the token's signature, expiry, issuer and audience, and return who it belongs to."""
    try:
        key_id = jwt.get_unverified_header(token).get("kid")
        key = _signing_key(key_id) if key_id else None
        if key is None:
            raise jwt.InvalidTokenError("Unknown signing key.")
        claims = jwt.decode(
            token,
            key,
            algorithms=_ALGORITHMS,
            audience="authenticated",
            issuer=_issuer(),
            options={"require": ["exp", "sub"]},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Your sign-in has expired or is not valid. Sign in again.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Sign-in could not be checked right now. Try again.") from exc

    if claims.get("is_anonymous"):
        return User(id=claims["sub"], email="", is_admin=False, is_guest=True, has_full_access=False)
    email = (claims.get("email") or "").lower()
    is_admin = email in settings.LIBRARY_ADMIN_EMAILS
    return User(
        id=claims["sub"],
        email=email,
        is_admin=is_admin,
        has_full_access=is_admin or email in settings.FULL_ACCESS_EMAILS,
    )


def get_current_user(authorization: Optional[str] = Header(default=None)) -> User:
    """FastAPI dependency: the signed-in user, or a 401."""
    if settings.AUTH_DISABLED:
        return LOCAL_DEV_USER
    if not settings.SUPABASE_URL:
        raise HTTPException(status_code=503, detail="Sign-in is not configured on this server.")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return verify_token(token.strip())


def require_admin(user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency: a signed-in library admin, or a 403."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Only library admins can do this.")
    return user
