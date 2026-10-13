"""The searchable index of document chunks: LangChain's PGVector store on Postgres."""

from typing import List, Optional, Tuple

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_postgres import PGVector
from sqlalchemy import Engine

COLLECTION_NAME = "kb_chunks"


def chunk_ids(document_id: str, count: int) -> List[str]:
    return [f"{document_id}:{index}" for index in range(count)]


def scope_filter(owner_id: str, proposal_id: Optional[str]) -> dict:
    """
    Library documents are visible to every chat. A proposal's documents are
    visible only to the person who uploaded them, and only for that proposal.
    """
    library = {"scope": {"$eq": "library"}}
    if not proposal_id:
        return library
    own_proposal = {"$and": [{"proposal_id": {"$eq": proposal_id}}, {"owner_id": {"$eq": owner_id}}]}
    return {"$or": [library, own_proposal]}


class VectorIndex:
    def __init__(self, engine: Engine, embeddings: Embeddings) -> None:
        self._store = PGVector(
            embeddings=embeddings,
            connection=engine,
            collection_name=COLLECTION_NAME,
            use_jsonb=True,
        )

    def add(self, document_id: str, chunks: List[Document]) -> None:
        self._store.add_documents(chunks, ids=chunk_ids(document_id, len(chunks)))

    def remove(self, document_id: str, count: int) -> None:
        if count:
            self._store.delete(ids=chunk_ids(document_id, count))

    def search(
        self, query: str, owner_id: str, proposal_id: Optional[str], k: int
    ) -> List[Tuple[Document, float]]:
        """Return the k closest chunks with their distance (lower is closer)."""
        return self._store.similarity_search_with_score(
            query, k=k, filter=scope_filter(owner_id, proposal_id)
        )
