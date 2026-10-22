"""Saving, listing, reopening and deleting proposals, with an in-memory stand-in for the table."""

import pytest

from backend.app.clients.proposal_store import ProposalRecord, ProposalSummaryRecord, _now
from backend.app.core import settings
from backend.app.services import proposal_service

from .conftest import OTHER_STAFF, STAFF

FORM = {"projectTitle": "  Riverbend Youth Hub ", "organizationName": "Riverbend First Nation", "objective1": ""}


class FakeProposalStore:
    def __init__(self) -> None:
        self.rows = {}
        self.counter = 0

    def create(self, owner_id, title, data):
        self.counter += 1
        now = _now()
        record = ProposalRecord(f"p-{self.counter}", owner_id, title, data, now, now)
        self.rows[record.id] = record
        return record

    def get(self, proposal_id, owner_id):
        record = self.rows.get(proposal_id)
        return record if record and record.owner_id == owner_id else None

    def list(self, owner_id):
        mine = [r for r in self.rows.values() if r.owner_id == owner_id]
        mine.sort(key=lambda r: r.updated_at, reverse=True)
        return [ProposalSummaryRecord(r.id, r.title, r.created_at, r.updated_at) for r in mine]

    def update(self, proposal_id, owner_id, title, data):
        record = self.get(proposal_id, owner_id)
        if record is None:
            return None
        record.title, record.data, record.updated_at = title, data, _now()
        return record

    def delete(self, proposal_id, owner_id):
        return self.rows.pop(proposal_id, None) is not None if self.get(proposal_id, owner_id) else False


@pytest.fixture
def store(monkeypatch):
    fake = FakeProposalStore()
    monkeypatch.setattr(proposal_service, "get_proposal_store", lambda: fake)
    return fake


def _create(client, data=FORM):
    return client.post("/api/proposals", json={"data": data})


def test_create_saves_the_form_for_the_signed_in_user(client, store):
    response = _create(client)

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Riverbend Youth Hub"
    assert body["data"] == FORM
    assert store.rows[body["id"]].owner_id == STAFF.id


def test_title_defaults_when_the_project_title_is_empty(client, store):
    assert _create(client, {"projectTitle": "   "}).json()["title"] == "Untitled proposal"
    assert _create(client, {}).json()["title"] == "Untitled proposal"


def test_save_replaces_the_form_and_updates_the_title(client, store):
    proposal_id = _create(client).json()["id"]

    response = client.put(f"/api/proposals/{proposal_id}", json={"data": {"projectTitle": "Youth Hub 2.0", "budget": "$1"}})

    assert response.status_code == 200
    assert response.json()["title"] == "Youth Hub 2.0"
    assert client.get(f"/api/proposals/{proposal_id}").json()["data"] == {"projectTitle": "Youth Hub 2.0", "budget": "$1"}


def test_list_shows_only_my_proposals_without_their_form_data(client, store, sign_in):
    first = _create(client, {"projectTitle": "First"}).json()["id"]
    second = _create(client, {"projectTitle": "Second"}).json()["id"]
    sign_in(OTHER_STAFF)
    _create(client, {"projectTitle": "Someone else's"})
    sign_in(STAFF)

    listed = client.get("/api/proposals").json()

    assert [item["id"] for item in listed] == [second, first]
    assert set(listed[0]) == {"id", "title", "created_at", "updated_at"}


def test_other_people_cannot_open_save_or_delete_my_proposal(client, store, sign_in):
    proposal_id = _create(client).json()["id"]

    sign_in(OTHER_STAFF)
    assert client.get(f"/api/proposals/{proposal_id}").status_code == 404
    assert client.put(f"/api/proposals/{proposal_id}", json={"data": {}}).status_code == 404
    assert client.delete(f"/api/proposals/{proposal_id}").status_code == 404
    assert client.get("/api/proposals").json() == []

    sign_in(STAFF)
    assert client.get(f"/api/proposals/{proposal_id}").json()["data"] == FORM


def test_delete_removes_the_proposal(client, store):
    proposal_id = _create(client).json()["id"]

    assert client.delete(f"/api/proposals/{proposal_id}").status_code == 204
    assert client.get(f"/api/proposals/{proposal_id}").status_code == 404
    assert client.delete(f"/api/proposals/{proposal_id}").status_code == 404


def test_oversized_saves_are_refused(client, store, monkeypatch):
    monkeypatch.setattr(settings, "MAX_PROPOSAL_BYTES", 1024)
    proposal_id = _create(client).json()["id"]

    too_big = {"projectTitle": "Big", "executiveSummary": "x" * 2000}

    created = _create(client, too_big)
    saved = client.put(f"/api/proposals/{proposal_id}", json={"data": too_big})

    assert created.status_code == 413 and saved.status_code == 413
    assert saved.json()["detail"] == "This proposal is too large to save (over 1 KB of text)."
    assert client.get(f"/api/proposals/{proposal_id}").json()["data"] == FORM


def test_requests_must_send_form_data(client, store):
    assert client.post("/api/proposals", json={}).status_code == 422
    assert client.post("/api/proposals", json={"data": "not an object"}).status_code == 422


def test_missing_database_settings_return_503(client, monkeypatch):
    monkeypatch.setattr(proposal_service.database, "is_configured", lambda: False)

    assert client.get("/api/proposals").status_code == 503
