"""Sign-in checks, using tokens signed with a throwaway key the way Supabase signs them."""

import json
import time

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from backend.app.core import auth, settings

ISSUER = "https://test-project.supabase.co/auth/v1"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"


def _key_pair(key_id: str):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    return private_key, {**public_jwk, "kid": key_id, "alg": "ES256", "use": "sig"}


PRIVATE_KEY, PUBLIC_JWK = _key_pair("key-1")
OTHER_PRIVATE_KEY, _ = _key_pair("key-1")  # same id, different key: a forged token


def make_token(private_key=PRIVATE_KEY, key_id="key-1", **overrides) -> str:
    claims = {
        "sub": "user-123",
        "email": "Staff@Example.com",
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": int(time.time()) + 3600,
    }
    claims.update(overrides)
    claims = {name: value for name, value in claims.items() if value is not None}
    return jwt.encode(claims, private_key, algorithm="ES256", headers={"kid": key_id})


@pytest.fixture
def jwks(mock_api, monkeypatch):
    """Serve the public key where the backend looks for it, with a fresh key cache."""
    monkeypatch.setattr(auth, "_signing_keys", {})
    monkeypatch.setattr(auth, "_signing_keys_fetched_at", 0.0)
    return mock_api._router.get(JWKS_URL).mock(return_value=httpx.Response(200, json={"keys": [PUBLIC_JWK]}))


def _save(client, token=None, header=None):
    """Call a cheap protected route (who am I) with the given credentials."""
    headers = {"Authorization": header or f"Bearer {token}"} if (token or header) else {}
    return client.get("/api/me", headers=headers)


def test_requests_without_a_token_are_refused(anonymous_client, jwks):
    response = _save(anonymous_client)

    assert response.status_code == 401
    assert response.json()["detail"] == "Sign in to continue."
    assert _save(anonymous_client, header="Basic abc").status_code == 401


@pytest.mark.parametrize(
    "path, kwargs",
    [
        ("/api/assist/chat", {"json": {"message": "hi"}}),
        ("/api/assist/tts", {"json": {"text": "hi"}}),
        ("/api/assist/stt", {"files": {"file": ("a.webm", b"x", "audio/webm")}}),
        ("/api/proposals/analyze", {"files": {"file": ("a.txt", b"x", "text/plain")}}),
        ("/api/proposals/export", {"data": {"payload": "{}"}}),
        ("/api/documents", {"files": {"file": ("a.txt", b"x", "text/plain")}}),
        ("/api/documents/search", {"json": {"query": "x"}}),
    ],
)
def test_every_route_needs_sign_in(anonymous_client, jwks, path, kwargs):
    assert anonymous_client.post(path, **kwargs).status_code == 401


def test_a_valid_token_is_accepted(anonymous_client, jwks):
    response = _save(anonymous_client, make_token())

    assert response.status_code == 200


def test_signing_keys_are_fetched_once_and_cached(anonymous_client, jwks):
    _save(anonymous_client, make_token())
    _save(anonymous_client, make_token())

    assert jwks.call_count == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 60},
        {"aud": "something-else"},
        {"iss": "https://evil.example.com/auth/v1"},
        {"sub": None},
        {"private_key": OTHER_PRIVATE_KEY},
        {"key_id": "unknown-key"},
    ],
    ids=["expired", "wrong audience", "wrong issuer", "no user id", "forged signature", "unknown key"],
)
def test_bad_tokens_are_refused(anonymous_client, jwks, overrides):
    response = _save(anonymous_client, make_token(**overrides))

    assert response.status_code == 401


def test_garbage_tokens_are_refused(anonymous_client, jwks):
    assert _save(anonymous_client, "not-a-token").status_code == 401


def test_token_identity_and_admin_status(jwks):
    staff = auth.verify_token(make_token())
    admin = auth.verify_token(make_token(sub="user-9", email="ADMIN@example.com"))

    assert staff == auth.User(id="user-123", email="staff@example.com", is_admin=False)
    assert admin == auth.User(id="user-9", email="admin@example.com", is_admin=True)


def test_sign_in_can_be_switched_off_for_local_development(anonymous_client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_DISABLED", True)

    assert _save(anonymous_client).status_code == 200


def test_unreachable_key_server_is_a_503_not_a_401(anonymous_client, mock_api, monkeypatch):
    monkeypatch.setattr(auth, "_signing_keys", {})
    monkeypatch.setattr(auth, "_signing_keys_fetched_at", 0.0)
    mock_api._router.get(JWKS_URL).mock(side_effect=httpx.ConnectError("down"))

    assert _save(anonymous_client, make_token()).status_code == 503


def test_me_reports_the_signed_in_user_and_admin_status(anonymous_client, jwks):
    def me(**claims):
        token = make_token(**claims)
        return anonymous_client.get("/api/me", headers={"Authorization": f"Bearer {token}"})

    assert me().json() == {"id": "user-123", "email": "staff@example.com", "is_admin": False}
    assert me(sub="user-9", email="admin@example.com").json() == {
        "id": "user-9",
        "email": "admin@example.com",
        "is_admin": True,
    }
    assert anonymous_client.get("/api/me").status_code == 401
