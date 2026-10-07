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
        proposal_id=None,
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
    record = store.create(_record(scope="proposal", proposal_id="riverbend"))

    assert store.get(record.id) == record
    assert record.id in [item.id for item in store.list(scope="proposal", proposal_id="riverbend")]
    assert record.id not in [item.id for item in store.list(scope="library")]

    updated = store.update(record.id, status="ready", chunk_count=3, kind="text")
    assert (updated.status, updated.chunk_count, updated.kind) == ("ready", 3, "text")

    store.delete(record.id)
    assert store.get(record.id) is None


def test_vector_index_adds_searches_by_scope_and_removes(engine):
    index = VectorIndex(engine, DeterministicFakeEmbedding(size=64))
    library_id, ours_id, theirs_id = new_document_id(), new_document_id(), new_document_id()

    def chunk(text, document_id, scope, proposal_id=None):
        metadata = {"document_id": document_id, "scope": scope, "proposal_id": proposal_id, "title": text}
        return Document(page_content=text, metadata=metadata)

    index.add(library_id, [chunk("library passage one", library_id, "library"), chunk("library passage two", library_id, "library")])
    index.add(ours_id, [chunk("our proposal passage", ours_id, "proposal", "riverbend")])
    index.add(theirs_id, [chunk("their proposal passage", theirs_id, "proposal", "other")])

    def found(proposal_id):
        mine = {library_id, ours_id, theirs_id}
        hits = index.search("passage", proposal_id=proposal_id, k=50)
        return sorted(doc.page_content for doc, _ in hits if doc.metadata["document_id"] in mine)

    assert found(None) == ["library passage one", "library passage two"]
    assert found("riverbend") == ["library passage one", "library passage two", "our proposal passage"]

    # The identical text embeds identically, so it is the closest match.
    top, distance = index.search("our proposal passage", proposal_id="riverbend", k=1)[0]
    assert top.page_content == "our proposal passage"
    assert distance == pytest.approx(0.0, abs=1e-6)

    index.remove(library_id, 2)
    assert found("riverbend") == ["our proposal passage"]

    index.remove(ours_id, 1)
    index.remove(theirs_id, 1)

