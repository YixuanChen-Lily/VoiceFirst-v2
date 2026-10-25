"""
The table that records each uploaded document: what it is, where its file is, and its status.

A document is either in the shared library or one of a user's own files. A user's
file is stored once and linked to the proposals that use it (see proposal_file_store).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, DateTime, Engine, Integer, MetaData, String, Table, Text, delete, insert, or_, select, text, update

metadata = MetaData()

documents = Table(
    "kb_documents",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("scope", String(20), nullable=False, index=True),  # "library" or "personal"
    Column("owner_id", String(64), nullable=True, index=True),  # who uploaded it
    Column("title", Text, nullable=False),
    Column("filename", Text, nullable=False),
    Column("content_type", Text, nullable=False),
    Column("kind", String(20), nullable=True),  # "pdf", "docx", "xlsx" or "text"
    Column("doc_type", String(50), nullable=True),  # guideline, policy, funder programme, ...
    Column("funder", Text, nullable=True),
    Column("storage_path", Text, nullable=False),
    Column("size_bytes", Integer, nullable=False),
    # "stored" (kept, not searchable), "processing", "ready" (searchable) or "failed"
    Column("status", String(20), nullable=False),
    Column("error", Text, nullable=True),
    Column("chunk_count", Integer, nullable=False, default=0),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


@dataclass
class DocumentRecord:
    id: str
    scope: str
    owner_id: Optional[str]
    title: str
    filename: str
    content_type: str
    kind: Optional[str]
    doc_type: Optional[str]
    funder: Optional[str]
    storage_path: str
    size_bytes: int
    status: str
    error: Optional[str]
    chunk_count: int
    created_at: datetime


def new_document_id() -> str:
    return str(uuid.uuid4())


class DocumentStore:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        metadata.create_all(engine)
        # create_all does not add columns to a table that already exists.
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS owner_id VARCHAR(64)"))

    def create(self, record: DocumentRecord) -> DocumentRecord:
        with self._engine.begin() as connection:
            connection.execute(insert(documents).values(**record.__dict__))
        return record

    def get(self, document_id: str) -> Optional[DocumentRecord]:
        with self._engine.connect() as connection:
            row = connection.execute(select(documents).where(documents.c.id == document_id)).mappings().first()
        return DocumentRecord(**row) if row else None

    def get_many(self, document_ids: List[str]) -> List[DocumentRecord]:
        if not document_ids:
            return []
        query = select(documents).where(documents.c.id.in_(document_ids))
        with self._engine.connect() as connection:
            return [DocumentRecord(**row) for row in connection.execute(query).mappings()]

    def list(self, visible_to: str, scope: Optional[str] = None) -> List[DocumentRecord]:
        """Library documents plus the documents this user uploaded."""
        query = (
            select(documents)
            .where(or_(documents.c.scope == "library", documents.c.owner_id == visible_to))
            .order_by(documents.c.created_at.desc())
        )
        if scope:
            query = query.where(documents.c.scope == scope)
        with self._engine.connect() as connection:
            return [DocumentRecord(**row) for row in connection.execute(query).mappings()]

    def update(self, document_id: str, **changes) -> Optional[DocumentRecord]:
        with self._engine.begin() as connection:
            connection.execute(update(documents).where(documents.c.id == document_id).values(**changes))
        return self.get(document_id)

    def delete(self, document_id: str) -> None:
        with self._engine.begin() as connection:
            connection.execute(delete(documents).where(documents.c.id == document_id))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
