"""
A user's own files ("My files") and the proposals that use them.

A file is uploaded once and can be added to any of the user's proposals, as a
background document or as an attachment. Each proposal decides whether the
assistant may read the file there: background documents always, attachments only
when switched on.

A file is searchable (has chunks in the vector index) exactly while at least one
proposal lets the assistant read it. Switching it on indexes it from the stored
original; when no proposal uses it any more, its chunks are deleted and the file
itself is kept.
"""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Optional

from ..clients.document_store import DocumentRecord
from ..clients.proposal_file_store import ProposalFileLink, ProposalFileStore
from ..core import database
from . import document_parsing_service, knowledge_service, proposal_service

logger = logging.getLogger(__name__)

ROLES = ("background", "attachment")


class FileNotFound(Exception):
    """No such file, or it belongs to someone else."""


class FileNotInProposal(Exception):
    pass


class BackgroundAlwaysRead(Exception):
    """Background documents are always available to the assistant."""


@dataclass
class ShelfFile:
    record: DocumentRecord
    used_in: int  # how many proposals use it


@dataclass
class ProposalFile:
    link: ProposalFileLink
    record: DocumentRecord


@lru_cache(maxsize=1)
def get_link_store() -> ProposalFileStore:
    return ProposalFileStore(database.get_engine())


def _own_file(document_id: str, owner_id: str) -> DocumentRecord:
    record = knowledge_service.get_document(document_id)
    if record is None or record.scope != "personal" or record.owner_id != owner_id:
        raise FileNotFound(document_id)
    return record


def _own_proposal(proposal_id: str, owner_id: str) -> None:
    """Raises ProposalNotFound unless the proposal exists and is this user's."""
    proposal_service.get_proposal(proposal_id, owner_id)


def _sync_index(record: DocumentRecord) -> DocumentRecord:
    """Index the file if some proposal lets the assistant read it; otherwise drop its chunks."""
    wanted = get_link_store().used_in_chat_anywhere(record.id)
    if wanted and record.status != "ready":
        return knowledge_service.index_document(record)
    if not wanted and (record.chunk_count or record.status != "stored"):
        return knowledge_service.unindex_document(record)
    return record


def _use_in_chat(role: str, requested: Optional[bool]) -> bool:
    if role == "background":
        return True
    return bool(requested)


# My files


def upload_file(
    *,
    owner_id: str,
    content: bytes,
    filename: str,
    content_type: str,
    proposal_id: Optional[str] = None,
    role: str = "attachment",
    label: Optional[str] = None,
    use_in_chat: Optional[bool] = None,
) -> tuple[DocumentRecord, Optional[ProposalFile]]:
    """
    Keep a file in My files and, when a proposal is given, add it to that proposal too.
    A file the assistant should read but cannot is not kept.
    """
    if proposal_id:
        _own_proposal(proposal_id, owner_id)
    record = knowledge_service.store_personal_file(
        content=content, filename=filename, content_type=content_type, owner_id=owner_id
    )
    if not proposal_id:
        return record, None
    try:
        added = add_to_proposal(
            owner_id=owner_id,
            proposal_id=proposal_id,
            document_id=record.id,
            role=role,
            label=label,
            use_in_chat=use_in_chat,
        )
    except document_parsing_service.DocumentParsingError:
        knowledge_service.delete_document(record.id, owner_id, is_admin=False)
        raise
    return added.record, added


def list_my_files(owner_id: str) -> List[ShelfFile]:
    records = knowledge_service.list_documents(owner_id, scope="personal")
    usage = get_link_store().usage(owner_id)
    return [ShelfFile(record=record, used_in=usage.get(record.id, 0)) for record in records]


def delete_file(owner_id: str, document_id: str) -> None:
    """Delete a file everywhere: from My files, from every proposal, and from search."""
    _own_file(document_id, owner_id)
    get_link_store().remove_for_document(document_id, owner_id)
    knowledge_service.delete_document(document_id, owner_id, is_admin=False)


# A proposal's files


def list_proposal_files(owner_id: str, proposal_id: str) -> List[ProposalFile]:
    _own_proposal(proposal_id, owner_id)
    return _proposal_files(owner_id, proposal_id)


def _proposal_files(owner_id: str, proposal_id: str) -> List[ProposalFile]:
    links = get_link_store().list_for_proposal(proposal_id, owner_id)
    records: Dict[str, DocumentRecord] = {
        record.id: record for record in knowledge_service.get_documents([link.document_id for link in links])
    }
    return [ProposalFile(link=link, record=records[link.document_id]) for link in links if link.document_id in records]


def add_to_proposal(
    *,
    owner_id: str,
    proposal_id: str,
    document_id: str,
    role: str,
    label: Optional[str] = None,
    use_in_chat: Optional[bool] = None,
) -> ProposalFile:
    """Add a file from My files to a proposal. Adding it again updates how it is used."""
    _own_proposal(proposal_id, owner_id)
    record = _own_file(document_id, owner_id)
    store = get_link_store()
    previous = store.get(proposal_id, document_id, owner_id)
    use = _use_in_chat(role, use_in_chat)
    if previous:
        link = store.update(proposal_id, document_id, owner_id, role=role, label=label, use_in_chat=use)
    else:
        link = store.add(proposal_id, document_id, owner_id, role, label, use)
    try:
        record = _sync_index(record)
    except document_parsing_service.DocumentParsingError:
        # The assistant cannot read this file, so it cannot be used the way it was asked to be.
        if previous:
            store.update(
                proposal_id,
                document_id,
                owner_id,
                role=previous.role,
                label=previous.label,
                use_in_chat=previous.use_in_chat,
            )
        else:
            store.remove(proposal_id, document_id, owner_id)
        raise
    return ProposalFile(link=link, record=record)


def set_use_in_chat(owner_id: str, proposal_id: str, document_id: str, use_in_chat: bool) -> ProposalFile:
    """Switch whether the assistant may read this file in this proposal."""
    _own_proposal(proposal_id, owner_id)
    store = get_link_store()
    link = store.get(proposal_id, document_id, owner_id)
    if link is None:
        raise FileNotInProposal(document_id)
    if link.role == "background" and not use_in_chat:
        raise BackgroundAlwaysRead("Background documents are always available to the assistant.")
    record = _own_file(document_id, owner_id)

    link = store.update(proposal_id, document_id, owner_id, use_in_chat=use_in_chat)
    try:
        record = _sync_index(record)
    except document_parsing_service.DocumentParsingError:
        store.update(proposal_id, document_id, owner_id, use_in_chat=False)
        raise
    return ProposalFile(link=link, record=record)


def remove_from_proposal(owner_id: str, proposal_id: str, document_id: str) -> None:
    """Take a file out of a proposal. It stays in My files."""
    _own_proposal(proposal_id, owner_id)
    if not get_link_store().remove(proposal_id, document_id, owner_id):
        raise FileNotInProposal(document_id)
    _sync_index(_own_file(document_id, owner_id))


def forget_proposal(owner_id: str, proposal_id: str) -> None:
    """
    After a proposal is deleted: unlink its files and drop chunks nothing else needs.
    The proposal is already gone, so a failure here is logged rather than reported.
    """
    if not knowledge_service.is_configured():
        return
    try:
        document_ids = get_link_store().remove_for_proposal(proposal_id, owner_id)
        records = knowledge_service.get_documents(document_ids)
    except Exception:
        logger.exception("Could not unlink the files of deleted proposal %s", proposal_id)
        return
    for record in records:
        try:
            _sync_index(record)
        except Exception:
            logger.exception("Could not tidy the search index for file %s", record.id)


# For the assistant


def chat_files(owner_id: str, proposal_id: str) -> List[ProposalFile]:
    """
    The files in this proposal, for the chat. Links are scoped to their owner, so a
    proposal id that is not this user's simply has no files.
    """
    return _proposal_files(owner_id, proposal_id)


def readable_document_ids(files: List[ProposalFile]) -> List[str]:
    """The files the assistant may search: switched on here and indexed."""
    return [item.record.id for item in files if item.link.use_in_chat and item.record.status == "ready"]
