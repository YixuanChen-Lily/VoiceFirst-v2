"""The knowledge base API, with in-memory stand-ins for the database and vector index."""

from typing import Dict, List, Optional

import httpx
import pytest

from backend.app.clients.document_store import DocumentRecord
from backend.app.services import knowledge_service

from .conftest import ADMIN, STAFF
from .test_document_parsing import make_pdf

STORAGE = "https://test-project.supabase.co/storage/v1"
GUIDELINE = (
    "Eligibility\n\nApplicants must be a First Nation, Inuit or Métis community organization. "
    "Projects must begin within twelve months of approval.\n\n"
    "Budget rules\n\nThe program funds up to 75 percent of eligible costs, to a maximum of $300,000. "
    "In-kind contributions may count toward the remaining 25 percent."
).encode()


class FakeDocumentStore:
    def __init__(self) -> None:
        self.records: Dict[str, DocumentRecord] = {}

    def create(self, record):
        self.records[record.id] = record
        return record

    def get(self, document_id):
        return self.records.get(document_id)

    def get_many(self, document_ids):
        return [self.records[document_id] for document_id in document_ids if document_id in self.records]

    def list(self, visible_to, scope=None):
        return [
            record
            for record in self.records.values()
            if (record.scope == "library" or record.owner_id == visible_to)
            and (not scope or record.scope == scope)
        ]

    def update(self, document_id, **changes):
        record = self.records[document_id]
        for key, value in changes.items():
            setattr(record, key, value)
        return record

    def delete(self, document_id):
        self.records.pop(document_id, None)


class FakeVectorIndex:
    """Ranks chunks by how many query words they contain; applies the real scope rule."""

    def __init__(self) -> None:
        self.chunks: Dict[str, list] = {}
        self.fail_next_add = False

    def add(self, document_id, chunks):
        if self.fail_next_add:
            self.fail_next_add = False
            raise RuntimeError("embedding service unavailable")
        self.chunks[document_id] = list(chunks)

    def remove(self, document_id, count):
        self.chunks.pop(document_id, None)

    def search(self, query, owner_id: str, document_ids: Optional[List[str]], k: int, include_library: bool = True):
        words = set(query.lower().split())
        visible = [
            chunk
            for chunks in self.chunks.values()
            for chunk in chunks
            if (include_library and chunk.metadata["scope"] == "library")
            or (
                chunk.metadata["document_id"] in (document_ids or [])
                and chunk.metadata["owner_id"] == owner_id
            )
        ]
        scored = [(chunk, 1.0 / (1 + len(words & set(chunk.page_content.lower().split())))) for chunk in visible]
        return sorted(scored, key=lambda pair: pair[1])[:k]


@pytest.fixture
def kb(monkeypatch, mock_api, sign_in):
    """Wire the service to in-memory stand-ins, mock Supabase Storage, and sign in as an admin."""
    sign_in(ADMIN)
    store, index = FakeDocumentStore(), FakeVectorIndex()
    monkeypatch.setattr(knowledge_service, "get_document_store", lambda: store)
    monkeypatch.setattr(knowledge_service, "get_vector_index", lambda: index)
    knowledge_service._ensure_bucket.cache_clear()

    router = mock_api._router
    routes = {
        "bucket": router.post(f"{STORAGE}/bucket").mock(return_value=httpx.Response(200, json={"name": "documents"})),
        "upload": router.post(url__startswith=f"{STORAGE}/object/documents/").mock(
            return_value=httpx.Response(200, json={"Key": "ok"})
        ),
        "download": router.get(url__startswith=f"{STORAGE}/object/documents/").mock(
            return_value=httpx.Response(200, content=GUIDELINE)
        ),
        "delete": router.delete(url__startswith=f"{STORAGE}/object/documents/").mock(
            return_value=httpx.Response(200, json={})
        ),
    }
    return {"store": store, "index": index, **routes}


def _upload(client, content: bytes = GUIDELINE, name: str = "guidelines.txt", **form):
    return client.post("/api/documents", files={"file": (name, content, "text/plain")}, data=form)


def test_upload_saves_the_original_then_indexes_it(client, kb):
    response = _upload(client, title="Program Guidelines", doc_type="guideline", funder="ISC")

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ready"
    assert body["title"] == "Program Guidelines"
    assert body["scope"] == "library"
    assert body["kind"] == "text"
    assert body["chunk_count"] > 1
    assert body["size_bytes"] == len(GUIDELINE)

    upload = kb["upload"].calls[0].request
    assert upload.url.path == f"/storage/v1/object/documents/library/{body['id']}/guidelines.txt"
    assert upload.content == GUIDELINE
    assert upload.headers["authorization"] == "Bearer test-supabase-key"

    chunks = kb["index"].chunks[body["id"]]
    assert len(chunks) == body["chunk_count"]
    # Each chunk is a label line plus at most CHUNK_SIZE (200 in tests) characters of the document.
    assert all(chunk.page_content.startswith("Program Guidelines") for chunk in chunks)
    assert all(len(chunk.page_content.split("\n\n", 1)[1]) <= 200 for chunk in chunks)
    assert chunks[0].metadata == {
        "document_id": body["id"],
        "scope": "library",
        "owner_id": "user-admin",
        "title": "Program Guidelines",
        "filename": "guidelines.txt",
        "doc_type": "guideline",
        "funder": "ISC",
        "page": None,
        "section": "Eligibility / Budget rules",
        "chunk_index": 0,
    }


def test_title_defaults_to_the_file_name(client, kb):
    assert _upload(client).json()["title"] == "guidelines.txt"


def test_pdf_chunks_carry_their_page_number(client, kb):
    pdf = make_pdf("Eligibility rules are on this page.", "Budget rules are on this page.")

    body = _upload(client, pdf, "guide.pdf").json()

    assert body["kind"] == "pdf"
    assert [chunk.metadata["page"] for chunk in kb["index"].chunks[body["id"]]] == [1, 2]


def test_search_returns_the_closest_passages_with_their_source(client, kb):
    document_id = _upload(client, title="Program Guidelines").json()["id"]

    response = client.post("/api/documents/search", json={"query": "maximum percent of eligible costs", "k": 2})

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert "75 percent of eligible costs" in results[0]["text"]
    assert results[0]["document_id"] == document_id
    assert results[0]["title"] == "Program Guidelines"
    assert results[0]["scope"] == "library"


def test_only_admins_can_change_the_library(client, kb, sign_in):
    document_id = _upload(client).json()["id"]

    sign_in(STAFF)
    assert _upload(client).status_code == 403
    assert client.delete(f"/api/documents/{document_id}").status_code == 403
    assert client.post(f"/api/documents/{document_id}/reindex").status_code == 403
    assert document_id in kb["store"].records


def test_delete_removes_the_file_the_chunks_and_the_record(client, kb):
    document_id = _upload(client).json()["id"]

    response = client.delete(f"/api/documents/{document_id}")

    assert response.status_code == 204
    assert kb["delete"].called
    assert document_id not in kb["index"].chunks
    assert client.get("/api/documents").json() == []
    assert client.delete(f"/api/documents/{document_id}").status_code == 404


def test_an_unreadable_file_is_rejected_and_not_kept(client, kb):
    response = _upload(client, make_pdf(""), "scan.pdf")

    assert response.status_code == 400
    assert response.json()["detail"].startswith("This PDF has no selectable text.")
    assert kb["store"].records == {}
    assert kb["delete"].called


def test_a_failed_index_keeps_the_file_so_it_can_be_retried(client, kb):
    kb["index"].fail_next_add = True

    failed = _upload(client)

    assert failed.status_code == 502
    document_id = failed.json()["detail"]["document_id"]
    assert kb["store"].records[document_id].status == "failed"
    assert not kb["delete"].called

    retried = client.post(f"/api/documents/{document_id}/reindex")

    assert retried.status_code == 200
    assert retried.json()["status"] == "ready"
    assert retried.json()["chunk_count"] > 1
    assert kb["download"].called


def test_upload_validation(client, kb):
    empty = _upload(client, b"")
    old_proposal_scope = _upload(client, scope="proposal")

    assert empty.status_code == 400
    # People's own files go through /api/files now.
    assert old_proposal_scope.status_code == 422


def test_storage_failure_is_reported(client, kb):
    kb["upload"].mock(return_value=httpx.Response(500, text="storage is down"))

    response = _upload(client)

    assert response.status_code == 502
    assert kb["store"].records == {}


def test_missing_configuration_returns_503(client, monkeypatch, sign_in):
    sign_in(ADMIN)
    monkeypatch.setattr(knowledge_service, "is_configured", lambda: False)

    assert client.get("/api/documents").status_code == 503
    assert _upload(client).status_code == 503
