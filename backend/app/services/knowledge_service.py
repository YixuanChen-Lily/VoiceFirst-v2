"""
The knowledge base: store an uploaded document, index it for search, and search it.

Indexing a document runs in this order:
    save the original file -> record it -> read its text -> split into chunks
    -> embed the chunks -> store them in the vector index -> mark the record ready

The original is saved first so a document can be re-indexed later (for example
after changing the chunk size) without asking anyone to upload it again.
"""

import logging
import re
from functools import lru_cache
from typing import List, Optional

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..clients import supabase_storage_client as storage
from ..clients.document_store import DocumentRecord, DocumentStore, new_document_id, utc_now
from ..clients.vector_index import VectorIndex
from ..core import database, settings
from ..schemas.documents import SearchResult
from . import document_parsing_service

logger = logging.getLogger(__name__)


class KnowledgeBaseNotConfigured(Exception):
    """Supabase or OpenAI settings are missing."""


class DocumentNotFound(Exception):
    pass


class NotAllowed(Exception):
    """The user may not change this document."""


class IndexingFailed(Exception):
    """The file was saved but could not be indexed. The record is kept so it can be retried."""

    def __init__(self, record: DocumentRecord) -> None:
        super().__init__(record.error or "Indexing failed.")
        self.record = record


def is_configured() -> bool:
    return storage.is_configured() and database.is_configured() and bool(settings.OPENAI_API_KEY)


def _require_configured() -> None:
    if not is_configured():
        raise KnowledgeBaseNotConfigured("The knowledge base is not configured on this server.")


@lru_cache(maxsize=1)
def get_document_store() -> DocumentStore:
    return DocumentStore(database.get_engine())


@lru_cache(maxsize=1)
def get_vector_index() -> VectorIndex:
    embeddings = OpenAIEmbeddings(model=settings.EMBEDDING_MODEL, api_key=settings.OPENAI_API_KEY)
    return VectorIndex(database.get_engine(), embeddings)


@lru_cache(maxsize=1)
def _ensure_bucket() -> bool:
    storage.ensure_bucket()
    return True


def _safe_name(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", filename).strip("-") or "document"


def split_into_chunks(record: DocumentRecord, content: bytes) -> tuple[str, List[Document]]:
    """Read the file and cut it into overlapping chunks, each tagged with where it came from."""
    parsed = document_parsing_service.parse_document(content, record.filename)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(document_parsing_service.to_langchain_documents(parsed))
    for index, chunk in enumerate(chunks):
        chunk.metadata = {
            "document_id": record.id,
            "scope": record.scope,
            "proposal_id": record.proposal_id,
            "owner_id": record.owner_id,
            "title": record.title,
            "filename": record.filename,
            "doc_type": record.doc_type,
            "funder": record.funder,
            "page": chunk.metadata.get("page"),
            "chunk_index": index,
        }
    return parsed.kind, chunks


def _index(record: DocumentRecord, content: bytes) -> DocumentRecord:
    """Chunk, embed and store one document, then mark its record ready (or failed)."""
    store = get_document_store()
    try:
        kind, chunks = split_into_chunks(record, content)
        index = get_vector_index()
        index.remove(record.id, record.chunk_count)
        index.add(record.id, chunks)
    except document_parsing_service.DocumentParsingError:
        raise
    except Exception as exc:
        logger.exception("Indexing failed for document %s", record.id)
        failed = store.update(record.id, status="failed", error=f"Indexing failed: {type(exc).__name__}")
        raise IndexingFailed(failed) from exc
    return store.update(record.id, status="ready", error=None, kind=kind, chunk_count=len(chunks))


def ingest_document(
    *,
    content: bytes,
    filename: str,
    content_type: str,
    scope: str,
    owner_id: str,
    title: Optional[str] = None,
    proposal_id: Optional[str] = None,
    doc_type: Optional[str] = None,
    funder: Optional[str] = None,
) -> DocumentRecord:
    _require_configured()
    _ensure_bucket()

    document_id = new_document_id()
    record = DocumentRecord(
        id=document_id,
        scope=scope,
        proposal_id=proposal_id if scope == "proposal" else None,
        owner_id=owner_id,
        title=(title or "").strip() or filename,
        filename=filename,
        content_type=content_type,
        kind=None,
        doc_type=doc_type or None,
        funder=funder or None,
        storage_path=f"{scope}/{document_id}/{_safe_name(filename)}",
        size_bytes=len(content),
        status="processing",
        error=None,
        chunk_count=0,
        created_at=utc_now(),
    )

    storage.upload(record.storage_path, content, content_type)
    store = get_document_store()
    store.create(record)

    try:
        return _index(record, content)
    except document_parsing_service.DocumentParsingError:
        # An unreadable file can never be indexed, so do not keep it.
        store.delete(record.id)
        storage.delete(record.storage_path)
        raise


def _get_changeable(document_id: str, owner_id: str, is_admin: bool) -> DocumentRecord:
    """Library documents can be changed by admins; proposal documents by whoever uploaded them."""
    record = get_document_store().get(document_id)
    if record is None:
        raise DocumentNotFound(document_id)
    if record.scope == "library":
        if not is_admin:
            raise NotAllowed("Only library admins can change library documents.")
    elif record.owner_id != owner_id:
        # Do not reveal that someone else's document exists.
        raise DocumentNotFound(document_id)
    return record


def reindex_document(document_id: str, owner_id: str, is_admin: bool) -> DocumentRecord:
    """Rebuild a document's chunks from its stored original."""
    _require_configured()
    record = _get_changeable(document_id, owner_id, is_admin)
    content = storage.download(record.storage_path)
    get_document_store().update(record.id, status="processing", error=None)
    return _index(record, content)


def list_documents(
    owner_id: str, scope: Optional[str] = None, proposal_id: Optional[str] = None
) -> List[DocumentRecord]:
    """The shared library plus this user's own uploads."""
    _require_configured()
    return get_document_store().list(visible_to=owner_id, scope=scope, proposal_id=proposal_id)


def delete_document(document_id: str, owner_id: str, is_admin: bool) -> None:
    _require_configured()
    record = _get_changeable(document_id, owner_id, is_admin)
    get_vector_index().remove(record.id, record.chunk_count)
    storage.delete(record.storage_path)
    get_document_store().delete(record.id)


def search(query: str, owner_id: str, proposal_id: Optional[str] = None, k: int = 5) -> List[SearchResult]:
    """Find the passages closest in meaning to the query, from the library and this user's proposal."""
    _require_configured()
    matches = get_vector_index().search(query, owner_id=owner_id, proposal_id=proposal_id, k=k)
    return [
        SearchResult(
            document_id=chunk.metadata["document_id"],
            title=chunk.metadata["title"],
            filename=chunk.metadata["filename"],
            scope=chunk.metadata["scope"],
            page=chunk.metadata.get("page"),
            text=chunk.page_content,
            distance=distance,
        )
        for chunk, distance in matches
    ]
