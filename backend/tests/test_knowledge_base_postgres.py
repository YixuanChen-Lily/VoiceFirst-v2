"""
The real document table and vector index, against a throwaway Postgres with pgvector.

Runs only when TEST_DATABASE_URL is set (CI starts a database for it). Embeddings
are faked so no request leaves the machine.
"""

import os

import pytest
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from backend.app.clients.document_store import DocumentRecord, DocumentStore, new_document_id, utc_now
from backend.app.clients.proposal_file_store import ProposalFileStore
from backend.app.clients.proposal_store import ProposalStore
from backend.app.clients.vector_index import VectorIndex
from backend.app.core.database import create_database_engine

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL is not set")


@pytest.fixture(scope="module")
def engine():
    engine = create_database_engine(TEST_DATABASE_URL)
    yield engine
    engine.dispose()


def _record(**overrides) -> DocumentRecord:
    values = dict(
        id=new_document_id(),
        scope="library",
        owner_id="user-a",
        title="Guidelines",
        filename="guidelines.txt",
        content_type="text/plain",
        kind=None,
        doc_type="guideline",
        funder=None,
        storage_path="library/x/guidelines.txt",
        size_bytes=10,
        status="processing",
        error=None,
        chunk_count=0,
        created_at=utc_now(),
    )
    values.update(overrides)
    return DocumentRecord(**values)


def test_document_records_round_trip(engine):
    store = DocumentStore(engine)
    record = store.create(_record(scope="personal", status="stored"))

    assert store.get(record.id) == record
    assert [item.id for item in store.get_many([record.id, "missing"])] == [record.id]
    assert record.id in [item.id for item in store.list("user-a", scope="personal")]
    assert record.id not in [item.id for item in store.list("user-a", scope="library")]
    assert record.id not in [item.id for item in store.list("user-b")]

    updated = store.update(record.id, status="ready", chunk_count=3, kind="text")
    assert (updated.status, updated.chunk_count, updated.kind) == ("ready", 3, "text")

    store.delete(record.id)
    assert store.get(record.id) is None


def test_vector_index_adds_searches_by_scope_and_removes(engine):
    index = VectorIndex(engine, DeterministicFakeEmbedding(size=64))
    library_id, ours_id, theirs_id = new_document_id(), new_document_id(), new_document_id()

    def chunk(text, document_id, scope, owner_id="user-a"):
        metadata = {
            "document_id": document_id,
            "scope": scope,
            "owner_id": owner_id,
            "title": text,
        }
        return Document(page_content=text, metadata=metadata)

    index.add(library_id, [chunk("library passage one", library_id, "library"), chunk("library passage two", library_id, "library")])
    index.add(ours_id, [chunk("our file passage", ours_id, "personal")])
    index.add(theirs_id, [chunk("their file passage", theirs_id, "personal", owner_id="user-b")])

    def found(owner_id, document_ids):
        mine = {library_id, ours_id, theirs_id}
        hits = index.search("passage", owner_id=owner_id, document_ids=document_ids, k=50)
        return sorted(doc.page_content for doc, _ in hits if doc.metadata["document_id"] in mine)

    assert found("user-a", None) == ["library passage one", "library passage two"]
    assert found("user-a", [ours_id]) == ["library passage one", "library passage two", "our file passage"]
    # Naming someone else's file does not reach it: it must also be your own.
    assert found("user-a", [ours_id, theirs_id]) == ["library passage one", "library passage two", "our file passage"]
    assert found("user-b", [theirs_id]) == ["library passage one", "library passage two", "their file passage"]
    # Without the library: only your own named files.
    hits = index.search("passage", owner_id="user-a", document_ids=[ours_id, theirs_id], k=50, include_library=False)
    assert sorted(doc.page_content for doc, _ in hits) == ["our file passage"]

    # The identical text embeds identically, so it is the closest match.
    top, distance = index.search("our file passage", owner_id="user-a", document_ids=[ours_id], k=1)[0]
    assert top.page_content == "our file passage"
    assert distance == pytest.approx(0.0, abs=1e-6)

    index.remove(library_id, 2)
    assert found("user-a", [ours_id]) == ["our file passage"]

    index.remove(ours_id, 1)
    index.remove(theirs_id, 1)


def test_proposals_round_trip_and_stay_private(engine):
    store = ProposalStore(engine)
    form = {"projectTitle": "Riverbend Youth Hub", "milestones": [{"name": "Open", "date": "2027-09"}], "note": "Café"}

    record = store.create("user-a", "Riverbend Youth Hub", form)
    assert store.get(record.id, "user-a").data == form
    assert store.get(record.id, "user-b") is None
    assert record.id in [item.id for item in store.list("user-a")]
    assert record.id not in [item.id for item in store.list("user-b")]

    assert store.update(record.id, "user-b", "Hijacked", {}) is None
    updated = store.update(record.id, "user-a", "Youth Hub 2.0", {"projectTitle": "Youth Hub 2.0"})
    assert updated.title == "Youth Hub 2.0" and updated.updated_at >= record.updated_at

    assert store.delete(record.id, "user-b") is False
    assert store.delete(record.id, "user-a") is True
    assert store.get(record.id, "user-a") is None


def test_proposal_file_links_round_trip_and_stay_private(engine):
    store = ProposalFileStore(engine)
    plan, budget = new_document_id(), new_document_id()
    first, second = new_document_id(), new_document_id()

    store.add(first, plan, "user-a", "background", "Community plan", True)
    store.add(first, budget, "user-a", "attachment", "Budget Spreadsheet", False)
    store.add(second, plan, "user-a", "background", None, True)

    assert [link.document_id for link in store.list_for_proposal(first, "user-a")] == [plan, budget]
    assert store.list_for_proposal(first, "user-b") == []
    assert store.get(first, budget, "user-b") is None
    assert store.usage("user-a")[plan] == 2
    assert store.used_in_chat_anywhere(plan) and not store.used_in_chat_anywhere(budget)

    assert store.update(first, budget, "user-a", use_in_chat=True).use_in_chat is True
    assert store.used_in_chat_anywhere(budget)

    assert store.remove(first, plan, "user-b") is False
    assert store.remove(first, plan, "user-a") is True
    assert sorted(store.remove_for_proposal(first, "user-a")) == [budget]
    store.remove_for_document(plan, "user-a")
    assert store.list_for_proposal(second, "user-a") == []
