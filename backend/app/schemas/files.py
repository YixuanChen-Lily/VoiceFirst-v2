from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

FileRole = Literal["background", "attachment"]
FileStatus = Literal["stored", "processing", "ready", "failed"]


class MyFileOut(BaseModel):
    """A file in the user's My files."""

    id: str
    title: str
    filename: str
    kind: Optional[str] = None
    size_bytes: int
    status: FileStatus
    error: Optional[str] = None
    created_at: datetime
    used_in: int = Field(..., description="How many of the user's proposals use this file.")


class ProposalFileOut(BaseModel):
    """A file as one proposal uses it."""

    document_id: str
    title: str
    filename: str
    kind: Optional[str] = None
    size_bytes: int
    status: FileStatus = Field(..., description="'ready' means the assistant can search it.")
    error: Optional[str] = None
    role: FileRole
    label: Optional[str] = None
    use_in_chat: bool = Field(..., description="Whether the assistant may read this file in this proposal.")
    added_at: datetime


class AddFileRequest(BaseModel):
    document_id: str
    role: FileRole = "attachment"
    label: Optional[str] = Field(default=None, max_length=200)
    use_in_chat: Optional[bool] = Field(
        default=None, description="Attachments default to off; background documents are always on."
    )


class UpdateFileRequest(BaseModel):
    use_in_chat: bool
