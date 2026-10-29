"""
My files and the files each proposal uses: uploading, reusing a file in several
proposals, switching the assistant's access on and off, and cleaning up.

The document table, link table, vector index and proposals table are in-memory
stand-ins; Supabase Storage is mocked over HTTP.
"""

from datetime import datetime, timezone

import httpx
import pytest

from backend.app.clients.proposal_file_store import ProposalFileLink
from backend.app.services import knowledge_service, proposal_files_service, proposal_service

from .conftest import OTHER_STAFF, STAFF
from .test_document_parsing import make_pdf
from .test_knowledge_base import GUIDELINE, STORAGE, FakeDocumentStore, FakeVectorIndex
from .test_saved_proposals import FakeProposalStore

PLAN = (
    "Community plan\n\nRiverbend's top priority is a safe space for youth after school. "
    "Elders asked for land-based programming every summer."
).encode()


class FakeLinkStore:
    def __init__(self) -> None:
        self.links = {}

    def add(self, proposal_id, document_id, owner_id, role, label, use_in_chat):
        link = ProposalFileLink(
            proposal_id, document_id, owner_id, role, label, use_in_chat, datetime.now(timezone.utc)
        )
        self.links[(proposal_id, document_id)] = link
        return link

    def get(self, proposal_id, document_id, owner_id):
        link = self.links.get((proposal_id, document_id))
        return link if link and link.owner_id == owner_id else None

    def list_for_proposal(self, proposal_id, owner_id):
        return [link for link in self.links.values() if link.proposal_id == proposal_id and link.owner_id == owner_id]

    def update(self, proposal_id, document_id, owner_id, **changes):
        link = self.get(proposal_id, document_id, owner_id)
        for key, value in changes.items():
            setattr(link, key, value)
        return link

    def remove(self, proposal_id, document_id, owner_id):
        if self.get(proposal_id, document_id, owner_id) is None:
            return False
        del self.links[(proposal_id, document_id)]
        return True

    def remove_for_proposal(self, proposal_id, owner_id):
        gone = [link.document_id for link in self.list_for_proposal(proposal_id, owner_id)]
        for document_id in gone:
            del self.links[(proposal_id, document_id)]
        return gone

    def remove_for_document(self, document_id, owner_id):
        for key in [key for key, link in self.links.items() if key[1] == document_id and link.owner_id == owner_id]:
            del self.links[key]

    def usage(self, owner_id):
        counts = {}
        for link in self.links.values():
            if link.owner_id == owner_id:
                counts[link.document_id] = counts.get(link.document_id, 0) + 1
        return counts

    def used_in_chat_anywhere(self, document_id):
        return any(link.document_id == document_id and link.use_in_chat for link in self.links.values())


@pytest.fixture
def files(monkeypatch, mock_api):
    """Wire the services to in-memory stand-ins and mock Supabase Storage."""
    documents, index, links, proposals = FakeDocumentStore(), FakeVectorIndex(), FakeLinkStore(), FakeProposalStore()
    monkeypatch.setattr(knowledge_service, "get_document_store", lambda: documents)
    monkeypatch.setattr(knowledge_service, "get_vector_index", lambda: index)
    monkeypatch.setattr(proposal_files_service, "get_link_store", lambda: links)
    monkeypatch.setattr(proposal_service, "get_proposal_store", lambda: proposals)
    knowledge_service._ensure_bucket.cache_clear()

    stored = {}  # storage path -> bytes, so downloads return what was uploaded

    def upload(request):
        stored[request.url.path.split("/object/documents/", 1)[1]] = request.content
        return httpx.Response(200, json={"Key": "ok"})

    def download(request):
        return httpx.Response(200, content=stored[request.url.path.split("/object/documents/", 1)[1]])

    router = mock_api._router
    router.post(f"{STORAGE}/bucket").mock(return_value=httpx.Response(200, json={"name": "documents"}))
    routes = {
        "upload": router.post(url__startswith=f"{STORAGE}/object/documents/").mock(side_effect=upload),
        "download": router.get(url__startswith=f"{STORAGE}/object/documents/").mock(side_effect=download),
        "delete": router.delete(url__startswith=f"{STORAGE}/object/documents/").mock(
            return_value=httpx.Response(200, json={})
        ),
    }
    return {"documents": documents, "index": index, "links": links, "proposals": proposals, **routes}


def _proposal(client, title="Riverbend Youth Hub"):
    return client.post("/api/proposals", json={"data": {"projectTitle": title}}).json()["id"]


def _upload_to(client, proposal_id, content=PLAN, name="plan.txt", **form):
    return client.post(
        f"/api/proposals/{proposal_id}/files/upload", files={"file": (name, content, "text/plain")}, data=form
    )


def _search(client, query, proposal_id=None):
    body = client.post("/api/documents/search", json={"query": query, "proposal_id": proposal_id}).json()
    return sorted({result["title"] for result in body["results"]})


def test_a_background_document_is_stored_and_readable_straight_away(client, files):
    proposal_id = _proposal(client)

    response = _upload_to(client, proposal_id, role="background", label="Community plan")

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "background"
    assert body["label"] == "Community plan"
    assert body["use_in_chat"] is True
    assert body["status"] == "ready"
    assert files["upload"].calls[0].request.url.path.startswith("/storage/v1/object/documents/personal/")
    assert files["index"].chunks[body["document_id"]][0].metadata["scope"] == "personal"
    assert _search(client, "youth after school", proposal_id) == ["plan.txt"]


def test_an_attachment_is_stored_but_not_read_unless_switched_on(client, files):
    proposal_id = _proposal(client)

    body = _upload_to(client, proposal_id, GUIDELINE, "letter.txt", label="Letters of Support").json()

    assert (body["role"], body["use_in_chat"], body["status"]) == ("attachment", False, "stored")
    assert files["index"].chunks == {}  # never read, never sent for embedding
    assert not files["download"].called
    assert _search(client, "eligible costs", proposal_id) == []


def test_switching_an_attachment_on_and_off(client, files):
    proposal_id = _proposal(client)
    document_id = _upload_to(client, proposal_id, GUIDELINE, "budget.txt").json()["document_id"]

    on = client.patch(f"/api/proposals/{proposal_id}/files/{document_id}", json={"use_in_chat": True})

    assert on.status_code == 200
    assert (on.json()["use_in_chat"], on.json()["status"]) == (True, "ready")
    assert files["download"].called  # indexed from the stored original
    assert _search(client, "eligible costs", proposal_id) == ["budget.txt"]

    off = client.patch(f"/api/proposals/{proposal_id}/files/{document_id}", json={"use_in_chat": False})

    assert (off.json()["use_in_chat"], off.json()["status"]) == (False, "stored")
    assert document_id not in files["index"].chunks
    assert _search(client, "eligible costs", proposal_id) == []
    # The file itself is kept.
    assert document_id in files["documents"].records


def test_a_file_reused_in_two_proposals_keeps_its_pieces_while_either_uses_it(client, files):
    first, second = _proposal(client, "First"), _proposal(client, "Second")
    document_id = _upload_to(client, first, role="background").json()["document_id"]

    added = client.post(f"/api/proposals/{second}/files", json={"document_id": document_id, "role": "background"})
    assert added.status_code == 201
    assert len(files["upload"].calls) == 1  # stored once

    shelf = client.get("/api/files").json()
    assert [(item["id"], item["used_in"]) for item in shelf] == [(document_id, 2)]

    assert client.delete(f"/api/proposals/{first}/files/{document_id}").status_code == 204
    # Still searchable from the second proposal, but not from the first.
    assert document_id in files["index"].chunks
    assert _search(client, "youth after school", second) == ["plan.txt"]
    assert _search(client, "youth after school", first) == []

    assert client.delete(f"/api/proposals/{second}/files/{document_id}").status_code == 204
    # No proposal uses it now: its pieces go, the file stays in My files.
    assert document_id not in files["index"].chunks
    assert [(item["id"], item["used_in"], item["status"]) for item in client.get("/api/files").json()] == [
        (document_id, 0, "stored")
    ]


def test_switches_are_per_proposal(client, files):
    first, second = _proposal(client, "First"), _proposal(client, "Second")
    document_id = _upload_to(client, first, GUIDELINE, "budget.txt", use_in_chat="true").json()["document_id"]
    client.post(f"/api/proposals/{second}/files", json={"document_id": document_id})

    assert _search(client, "eligible costs", first) == ["budget.txt"]
    assert _search(client, "eligible costs", second) == []


def test_deleting_from_my_files_removes_it_everywhere(client, files):
    first, second = _proposal(client, "First"), _proposal(client, "Second")
    document_id = _upload_to(client, first, role="background").json()["document_id"]
    client.post(f"/api/proposals/{second}/files", json={"document_id": document_id, "role": "background"})

    assert client.delete(f"/api/files/{document_id}").status_code == 204

    assert files["delete"].called
    assert document_id not in files["documents"].records
    assert document_id not in files["index"].chunks
    assert files["links"].links == {}
    assert client.get(f"/api/proposals/{first}/files").json() == []


def test_deleting_a_proposal_unlinks_its_files_but_keeps_them(client, files):
    proposal_id = _proposal(client)
    document_id = _upload_to(client, proposal_id, role="background").json()["document_id"]

    assert client.delete(f"/api/proposals/{proposal_id}").status_code == 204

    assert files["links"].links == {}
    assert document_id not in files["index"].chunks
    assert [item["id"] for item in client.get("/api/files").json()] == [document_id]


def test_a_file_the_assistant_cannot_read_is_stored_as_an_attachment(client, files):
    proposal_id = _proposal(client)
    scan = make_pdf("")

    attachment = _upload_to(client, proposal_id, scan, "plans.pdf", label="Facility Plans")
    assert attachment.status_code == 201

    document_id = attachment.json()["document_id"]
    switched = client.patch(f"/api/proposals/{proposal_id}/files/{document_id}", json={"use_in_chat": True})

    assert switched.status_code == 400
    assert switched.json()["detail"].startswith("The assistant can't read this file. This PDF has no selectable text.")
    listed = client.get(f"/api/proposals/{proposal_id}/files").json()
    assert (listed[0]["use_in_chat"], listed[0]["status"]) == (False, "stored")
    assert "no selectable text" in listed[0]["error"]


def test_an_unreadable_background_document_is_not_kept(client, files):
    proposal_id = _proposal(client)

    response = _upload_to(client, proposal_id, make_pdf(""), "scan.pdf", role="background")

    assert response.status_code == 400
    assert files["documents"].records == {}
    assert files["links"].links == {}
    assert files["delete"].called


def test_background_documents_cannot_be_switched_off(client, files):
    proposal_id = _proposal(client)
    document_id = _upload_to(client, proposal_id, role="background").json()["document_id"]

    response = client.patch(f"/api/proposals/{proposal_id}/files/{document_id}", json={"use_in_chat": False})

    assert response.status_code == 400


def test_files_and_proposals_are_private(client, files, sign_in):
    proposal_id = _proposal(client)
    document_id = _upload_to(client, proposal_id, role="background").json()["document_id"]

    sign_in(OTHER_STAFF)
    their_proposal = _proposal(client, "Theirs")

    assert client.get("/api/files").json() == []
    assert client.get(f"/api/proposals/{proposal_id}/files").status_code == 404
    assert _upload_to(client, proposal_id).status_code == 404
    # Someone else's file cannot be added to your own proposal, switched, or deleted.
    assert client.post(f"/api/proposals/{their_proposal}/files", json={"document_id": document_id}).status_code == 404
    assert client.patch(f"/api/proposals/{proposal_id}/files/{document_id}", json={"use_in_chat": False}).status_code == 404
    assert client.delete(f"/api/files/{document_id}").status_code == 404
    # Naming the proposal in a search does not reach its files either.
    assert _search(client, "youth after school", proposal_id) == []

    sign_in(STAFF)
    assert _search(client, "youth after school", proposal_id) == ["plan.txt"]


def test_library_documents_are_not_my_files(client, files):
    assert client.delete(f"/api/files/{'missing'}").status_code == 404


def test_upload_to_my_files_without_a_proposal(client, files):
    response = client.post("/api/files", files={"file": ("cv.pdf", b"%PDF-1.4 not read", "application/pdf")})

    assert response.status_code == 201
    assert (response.json()["status"], response.json()["used_in"]) == ("stored", 0)


def test_upload_validation(client, files):
    proposal_id = _proposal(client)

    assert _upload_to(client, proposal_id, b"").status_code == 400
    assert _upload_to(client, proposal_id, role="cover-letter").status_code == 422
    assert _upload_to(client, "no-such-proposal").status_code == 404


def _export_proposal(client, proposal_id, **form):
    import json

    return client.post(
        "/api/proposals/export",
        data={
            "payload": json.dumps({"project_title": "Riverbend Youth Hub", "organization_name": "Riverbend"}),
            "proposal_id": proposal_id,
            **form,
        },
    )


def test_export_lists_attachments_by_name_only(client, files):
    from io import BytesIO
    from zipfile import ZipFile

    proposal_id = _proposal(client)
    _upload_to(client, proposal_id, GUIDELINE, "letter.txt", role="attachment", label="Letters of Support")
    _upload_to(client, proposal_id, PLAN, "plan.txt", role="background", label="Community context")

    response = _export_proposal(client, proposal_id)

    assert response.status_code == 200
    assert response.headers["content-disposition"].endswith('.docx"')
    document = ZipFile(BytesIO(response.content)).read("word/document.xml").decode()
    assert "Supporting Documents" in document
    assert "Letters of Support: letter.txt" in document
    assert GUIDELINE.decode()[:40] not in document  # listed, never pasted in
    assert "plan.txt" not in document  # background files are for the assistant, not the funder


def test_export_with_files_returns_a_zip_of_the_document_and_attachments(client, files):
    from io import BytesIO
    from zipfile import ZipFile

    proposal_id = _proposal(client)
    _upload_to(client, proposal_id, GUIDELINE, "letter.txt", role="attachment", label="Letters of Support")
    _upload_to(client, proposal_id, b"Second letter", "letter.txt", role="attachment", label="Letters of Support")
    _upload_to(client, proposal_id, PLAN, "plan.txt", role="background")

    response = _export_proposal(client, proposal_id, include_files="true")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["content-disposition"] == 'attachment; filename="Riverbend-Youth-Hub-draft-proposal.zip"'
    archive = ZipFile(BytesIO(response.content))
    assert sorted(archive.namelist()) == [
        "Attachments/letter (2).txt",
        "Attachments/letter.txt",
        "Riverbend-Youth-Hub-draft-proposal.docx",
    ]
    assert {archive.read("Attachments/letter.txt"), archive.read("Attachments/letter (2).txt")} == {
        GUIDELINE,
        b"Second letter",
    }
    document = ZipFile(BytesIO(archive.read("Riverbend-Youth-Hub-draft-proposal.docx"))).read("word/document.xml")
    assert b"Letters of Support: letter.txt" in document
