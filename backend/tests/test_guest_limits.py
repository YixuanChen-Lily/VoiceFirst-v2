"""Guests (signed in without an email) get capped use of the features that cost money."""

import pytest

from backend.app.core.auth import User
from backend.app.services import guest_limits

from .conftest import STAFF

GUEST = User(id="guest-1", email="", is_admin=False, is_guest=True)
OTHER_GUEST = User(id="guest-2", email="", is_admin=False, is_guest=True)


class FakeUsageStore:
    def __init__(self) -> None:
        self.counts = {}

    def try_use(self, owner_id, action, limit):
        used = self.counts.get((owner_id, action), 0)
        if used >= limit:
            return False
        self.counts[(owner_id, action)] = used + 1
        return True


@pytest.fixture
def usage(monkeypatch):
    store = FakeUsageStore()
    monkeypatch.setattr(guest_limits, "get_usage_store", lambda: store)
    monkeypatch.setitem(guest_limits.GUEST_LIMITS, "draft_check", (2, "draft checks"))
    return store


def _check_draft(client):
    # An empty file: refused with a 400 once it gets past the guest cap, so no AI call is needed.
    return client.post("/api/proposals/analyze", files={"file": ("draft.txt", b"", "text/plain")})


def test_a_guest_is_stopped_at_the_limit(client, sign_in, usage):
    sign_in(GUEST)

    assert [_check_draft(client).status_code for _ in range(3)] == [400, 400, 429]
    assert _check_draft(client).json()["detail"] == (
        "Guests can use up to 2 draft checks. Sign in with an email to keep going."
    )


def test_each_guest_has_their_own_count(client, sign_in, usage):
    sign_in(GUEST)
    _check_draft(client), _check_draft(client)

    sign_in(OTHER_GUEST)
    assert _check_draft(client).status_code == 400


def test_people_who_signed_in_with_an_email_are_not_capped(client, sign_in, usage):
    sign_in(STAFF)

    assert [_check_draft(client).status_code for _ in range(4)] == [400] * 4
    assert usage.counts == {}


def test_guests_cannot_upload_large_files(client, sign_in, usage):
    sign_in(GUEST)
    big = b"x" * (guest_limits.GUEST_MAX_UPLOAD_BYTES + 1)

    response = client.post("/api/files", files={"file": ("plan.txt", big, "text/plain")})

    assert response.status_code == 413
    assert response.json()["detail"] == "Guests can upload files up to 5 MB."
    assert usage.counts == {}  # a refused file doesn't use up an upload


@pytest.mark.parametrize(
    "path, kwargs, action",
    [
        ("/api/assist/chat", {"json": {"message": "hi"}}, "chat"),
        ("/api/assist/tts", {"json": {"text": "hi"}}, "voice"),
        ("/api/assist/stt", {"files": {"file": ("a.webm", b"x", "audio/webm")}}, "voice"),
        ("/api/proposals/extract-fields", {"files": {"file": ("a.txt", b"x", "text/plain")}}, "draft_fill"),
        ("/api/proposals", {"json": {"data": {}}}, "proposal"),
        ("/api/files", {"files": {"file": ("a.txt", b"x", "text/plain")}}, "file_upload"),
    ],
)
def test_every_costly_route_is_capped_for_guests(client, sign_in, usage, path, kwargs, action):
    sign_in(GUEST)
    limit, _ = guest_limits.GUEST_LIMITS[action]
    usage.counts[(GUEST.id, action)] = limit

    assert client.post(path, **kwargs).status_code == 429
