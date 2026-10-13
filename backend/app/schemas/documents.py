from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scope: Literal["library", "proposal"]
    proposal_id: Optional[str] = None
    title: str
    filename: str
    kind: Optional[str] = None
    doc_type: Optional[str] = None
    funder: Optional[str] = None
    size_bytes: int
    status: Literal["processing", "ready", "failed"]
    error: Optional[str] = None
    chunk_count: int
    created_at: datetime


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    proposal_id: Optional[str] = Field(
        default=None,
        description="Also search the documents you uploaded for this proposal, not only the shared library.",
    )
    k: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    document_id: str
    title: str
    filename: str
    scope: str
    page: Optional[int] = None
    text: str
    distance: float


class SearchResponse(BaseModel):
    results: List[SearchResult]
