"""Saving and reopening proposals."""

import json
from functools import lru_cache
from typing import Any, Dict, List

from ..clients.proposal_store import ProposalRecord, ProposalStore, ProposalSummaryRecord
from ..core import database, settings

UNTITLED = "Untitled proposal"
TITLE_MAX_CHARS = 200


class ProposalsNotConfigured(Exception):
    """The database settings are missing."""


class ProposalNotFound(Exception):
    """No such proposal, or it belongs to someone else."""


class ProposalTooLarge(Exception):
    """The form data is over the size limit."""


@lru_cache(maxsize=1)
def get_proposal_store() -> ProposalStore:
    return ProposalStore(database.get_engine())


def _store() -> ProposalStore:
    if not database.is_configured():
        raise ProposalsNotConfigured("Saving proposals is not configured on this server.")
    return get_proposal_store()


def _title(data: Dict[str, Any]) -> str:
    title = data.get("projectTitle")
    title = title.strip() if isinstance(title, str) else ""
    return (title or UNTITLED)[:TITLE_MAX_CHARS]


def _check_size(data: Dict[str, Any]) -> None:
    size = len(json.dumps(data, ensure_ascii=False).encode("utf-8"))
    if size > settings.MAX_PROPOSAL_BYTES:
        limit_kb = settings.MAX_PROPOSAL_BYTES // 1024
        raise ProposalTooLarge(f"This proposal is too large to save (over {limit_kb} KB of text).")


def create_proposal(owner_id: str, data: Dict[str, Any]) -> ProposalRecord:
    _check_size(data)
    return _store().create(owner_id, _title(data), data)


def list_proposals(owner_id: str) -> List[ProposalSummaryRecord]:
    return _store().list(owner_id)


def get_proposal(proposal_id: str, owner_id: str) -> ProposalRecord:
    record = _store().get(proposal_id, owner_id)
    if record is None:
        raise ProposalNotFound(proposal_id)
    return record


def save_proposal(proposal_id: str, owner_id: str, data: Dict[str, Any]) -> ProposalRecord:
    _check_size(data)
    record = _store().update(proposal_id, owner_id, _title(data), data)
    if record is None:
        raise ProposalNotFound(proposal_id)
    return record


def delete_proposal(proposal_id: str, owner_id: str) -> None:
    if not _store().delete(proposal_id, owner_id):
        raise ProposalNotFound(proposal_id)
