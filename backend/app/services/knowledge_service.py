"""
The knowledge base: store an uploaded document, index it for search, and search it.

Indexing a document runs in this order:
    save the original file -> record it -> read its text -> split into chunks
    -> embed the chunks -> store them in the vector index -> mark the record ready

The original is saved first so a document can be re-indexed later (for example
after changing the chunk size) without asking anyone to upload it again.

Library documents are indexed as soon as they are uploaded. A user's own files are
only stored at first; they are indexed while a proposal lets the assistant read them
(see proposal_files_service).
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


_HEADING_MAX_WORDS = 10
_HEADING_MAX_CHARS = 80
_FILE_EXTENSION = re.compile(r"\.(pdf|docx|xlsx|txt|md|csv)$", re.IGNORECASE)


def _is_heading(line: str) -> bool:
    """
    A short line that reads like a title: no sentence ending, not a list item or
    table row, not a link. Good enough for the headings in typical guidelines.
    """
    line = line.strip()
    if not line or len(line) > _HEADING_MAX_CHARS or len(line.split()) > _HEADING_MAX_WORDS:
        return False
    if line[0] in "-*•|" or line[-1] in ".,;:?!" or "http" in line or "@" in line:
        return False
    if " | " in line:  # a table or spreadsheet row
        return False
    return line[0].isupper() or line[0].isdigit()


def _headings(text: str) -> List[tuple[int, str]]:
    """Positions and text of the heading-like lines in `text`."""
    found, position = [], 0
    for line in text.split("\n"):
        if _is_heading(line):
            found.append((position, line.strip()))
        position += len(line) + 1
    return found


def _label(title: str, sections: List[str]) -> str:
    title = _FILE_EXTENSION.sub("", title).strip()
    sections = [section for section in sections if section != title]
    return f"{title} › {' / '.join(sections)}" if sections else title


def split_into_chunks(record: DocumentRecord, content: bytes) -> tuple[str, List[Document]]:
    """
    Read the file and cut it into overlapping chunks, each tagged with where it came from.

    Each chunk's text starts with a label naming the document and the section it
    falls under. Without it, a chunk that is just the middle of a bulleted list
    says neither which program nor which topic it is about, and search misses it.
    """
    parsed = document_parsing_service.parse_document(content, record.filename)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        add_start_index=True,
    )

    chunks: List[Document] = []
    current_section: Optional[str] = None  # carries over from one PDF page to the next
    for part in document_parsing_service.to_langchain_documents(parsed):
        headings = _headings(part.page_content)
        for chunk in splitter.split_documents([part]):
            start = chunk.metadata.get("start_index", 0)
            end = start + len(chunk.page_content)
            # A chunk belongs to the last heading before it starts, plus any heading inside it.
            earlier = [heading for position, heading in headings if position <= start]
            inside = [heading for position, heading in headings if start < position < end]
            opening = earlier[-1] if earlier else current_section
            sections = ([opening] if opening else []) + inside
            chunk.metadata["sections"] = list(dict.fromkeys(sections))
            chunks.append(chunk)
        if headings:
            current_section = headings[-1][1]

    for index, chunk in enumerate(chunks):
        sections = chunk.metadata.get("sections", [])
        chunk.page_content = f"{_label(record.title, sections)}\n\n{chunk.page_content}"
        chunk.metadata = {
            "document_id": record.id,
            "scope": record.scope,
            "owner_id": record.owner_id,
            "title": record.title,
            "filename": record.filename,
            "doc_type": record.doc_type,
            "funder": record.funder,
            "page": chunk.metadata.get("page"),
            "section": " / ".join(sections) or None,
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


def _store_original(
    *,
    content: bytes,
    filename: str,
    content_type: str,
    scope: str,
    owner_id: str,
    title: Optional[str] = None,
    doc_type: Optional[str] = None,
    funder: Optional[str] = None,
    status: str,
) -> DocumentRecord:
    """Save the original file and record it."""
    _require_configured()
    _ensure_bucket()

    document_id = new_document_id()
    record = DocumentRecord(
        id=document_id,
        scope=scope,
        owner_id=owner_id,
        title=(title or "").strip() or filename,
        filename=filename,
        content_type=content_type,
        kind=None,
        doc_type=doc_type or None,
        funder=funder or None,
        storage_path=f"{scope}/{document_id}/{_safe_name(filename)}",
        size_bytes=len(content),
        status=status,
        error=None,
        chunk_count=0,
        created_at=utc_now(),
    )
    storage.upload(record.storage_path, content, content_type)
    return get_document_store().create(record)


def ingest_document(
    *,
    content: bytes,
    filename: str,
    content_type: str,
    owner_id: str,
    title: Optional[str] = None,
    doc_type: Optional[str] = None,
    funder: Optional[str] = None,
) -> DocumentRecord:
    """Add a document to the shared library and index it straight away."""
    record = _store_original(
        content=content,
        filename=filename,
        content_type=content_type,
        scope="library",
        owner_id=owner_id,
        title=title,
        doc_type=doc_type,
        funder=funder,
        status="processing",
    )
    try:
        return _index(record, content)
    except document_parsing_service.DocumentParsingError:
        # An unreadable file can never be indexed, so do not keep it.
        get_document_store().delete(record.id)
        storage.delete(record.storage_path)
        raise


def store_personal_file(*, content: bytes, filename: str, content_type: str, owner_id: str) -> DocumentRecord:
    """Keep one of a user's own files without reading it. It becomes searchable only when indexed."""
    return _store_original(
        content=content,
        filename=filename,
        content_type=content_type,
        scope="personal",
        owner_id=owner_id,
        status="stored",
    )


def index_document(record: DocumentRecord) -> DocumentRecord:
    """Read a stored document and make it searchable. Parsing errors leave it stored, with the reason."""
    _require_configured()
    content = storage.download(record.storage_path)
    store = get_document_store()
    store.update(record.id, status="processing", error=None)
    try:
        return _index(record, content)
    except document_parsing_service.DocumentParsingError as exc:
        store.update(record.id, status="stored", error=str(exc))
        raise


def unindex_document(record: DocumentRecord) -> DocumentRecord:
    """Delete a document's searchable pieces but keep the file."""
    _require_configured()
    get_vector_index().remove(record.id, record.chunk_count)
    return get_document_store().update(record.id, status="stored", error=None, chunk_count=0)


def get_document(document_id: str) -> Optional[DocumentRecord]:
    _require_configured()
    return get_document_store().get(document_id)


def read_original(record: DocumentRecord) -> bytes:
    """The file exactly as it was uploaded."""
    _require_configured()
    return storage.download(record.storage_path)


def get_documents(document_ids: List[str]) -> List[DocumentRecord]:
    _require_configured()
    return get_document_store().get_many(document_ids)


def _get_changeable(document_id: str, owner_id: str, is_admin: bool) -> DocumentRecord:
    """Library documents can be changed by admins; personal files only by whoever uploaded them."""
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


def list_documents(owner_id: str, scope: Optional[str] = None) -> List[DocumentRecord]:
    """The shared library plus this user's own uploads."""
    _require_configured()
    return get_document_store().list(visible_to=owner_id, scope=scope)


def delete_document(document_id: str, owner_id: str, is_admin: bool) -> None:
    _require_configured()
    record = _get_changeable(document_id, owner_id, is_admin)
    get_vector_index().remove(record.id, record.chunk_count)
    storage.delete(record.storage_path)
    get_document_store().delete(record.id)


def search(
    query: str,
    owner_id: str,
    document_ids: Optional[List[str]] = None,
    k: int = 5,
    include_library: bool = True,
) -> List[SearchResult]:
    """
    Find the passages closest in meaning to the query, from the library and, when
    given, these of the user's own files. Without the library, from those files only.
    """
    _require_configured()
    if not include_library and not document_ids:
        return []
    matches = get_vector_index().search(
        query, owner_id=owner_id, document_ids=document_ids, k=k, include_library=include_library
    )
    return [
        SearchResult(
            document_id=chunk.metadata["document_id"],
            title=chunk.metadata["title"],
            filename=chunk.metadata["filename"],
            scope=chunk.metadata["scope"],
            page=chunk.metadata.get("page"),
            section=chunk.metadata.get("section"),
            text=chunk.page_content,
            distance=distance,
        )
        for chunk, distance in matches
    ]
