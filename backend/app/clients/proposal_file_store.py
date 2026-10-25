"""
Which of a user's files each proposal uses, as what, and whether the assistant may read it there.

A file is stored once (in kb_documents) and can be linked to many proposals. Every
method is scoped to an owner, so other people's links behave as if they do not exist.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Engine,
    MetaData,
    String,
    Table,
    Text,
    delete,
    func,
    insert,
    select,
    update,
)

metadata = MetaData()

proposal_files = Table(
    "proposal_files",
    metadata,
    Column("proposal_id", String(36), primary_key=True),
    Column("document_id", String(36), primary_key=True, index=True),
    Column("owner_id", String(64), nullable=False, index=True),
    Column("role", String(20), nullable=False),  # "background" or "attachment"
    Column("label", Text, nullable=True),  # e.g. "Letters of Support"
    Column("use_in_chat", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


@dataclass
class ProposalFileLink:
    proposal_id: str
    document_id: str
    owner_id: str
    role: str
    label: Optional[str]
    use_in_chat: bool
    created_at: datetime


def _mine(proposal_id: str, document_id: str, owner_id: str):
    return (
        proposal_files.c.proposal_id == proposal_id,
        proposal_files.c.document_id == document_id,
        proposal_files.c.owner_id == owner_id,
    )


class ProposalFileStore:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        metadata.create_all(engine)

    def add(
        self, proposal_id: str, document_id: str, owner_id: str, role: str, label: Optional[str], use_in_chat: bool
    ) -> ProposalFileLink:
        link = ProposalFileLink(
            proposal_id=proposal_id,
            document_id=document_id,
            owner_id=owner_id,
            role=role,
            label=label,
            use_in_chat=use_in_chat,
            created_at=datetime.now(timezone.utc),
        )
        with self._engine.begin() as connection:
            connection.execute(insert(proposal_files).values(**link.__dict__))
        return link

    def get(self, proposal_id: str, document_id: str, owner_id: str) -> Optional[ProposalFileLink]:
        query = select(proposal_files).where(*_mine(proposal_id, document_id, owner_id))
        with self._engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        return ProposalFileLink(**row) if row else None

    def list_for_proposal(self, proposal_id: str, owner_id: str) -> List[ProposalFileLink]:
        """Oldest first, so files keep the order they were added in."""
        query = (
            select(proposal_files)
            .where(proposal_files.c.proposal_id == proposal_id, proposal_files.c.owner_id == owner_id)
            .order_by(proposal_files.c.created_at)
        )
        with self._engine.connect() as connection:
            return [ProposalFileLink(**row) for row in connection.execute(query).mappings()]

    def update(self, proposal_id: str, document_id: str, owner_id: str, **changes) -> Optional[ProposalFileLink]:
        query = update(proposal_files).where(*_mine(proposal_id, document_id, owner_id)).values(**changes)
        with self._engine.begin() as connection:
            connection.execute(query)
        return self.get(proposal_id, document_id, owner_id)

    def remove(self, proposal_id: str, document_id: str, owner_id: str) -> bool:
        query = delete(proposal_files).where(*_mine(proposal_id, document_id, owner_id))
        with self._engine.begin() as connection:
            return connection.execute(query).rowcount > 0

    def remove_for_proposal(self, proposal_id: str, owner_id: str) -> List[str]:
        """Unlink every file from a proposal; returns the ids of the files that were linked."""
        query = (
            delete(proposal_files)
            .where(proposal_files.c.proposal_id == proposal_id, proposal_files.c.owner_id == owner_id)
            .returning(proposal_files.c.document_id)
        )
        with self._engine.begin() as connection:
            return list(connection.execute(query).scalars())

    def remove_for_document(self, document_id: str, owner_id: str) -> None:
        query = delete(proposal_files).where(
            proposal_files.c.document_id == document_id, proposal_files.c.owner_id == owner_id
        )
        with self._engine.begin() as connection:
            connection.execute(query)

    def usage(self, owner_id: str) -> Dict[str, int]:
        """How many proposals use each of this user's files."""
        query = (
            select(proposal_files.c.document_id, func.count())
            .where(proposal_files.c.owner_id == owner_id)
            .group_by(proposal_files.c.document_id)
        )
        with self._engine.connect() as connection:
            return {document_id: count for document_id, count in connection.execute(query)}

    def used_in_chat_anywhere(self, document_id: str) -> bool:
        """Whether any proposal lets the assistant read this file."""
        query = (
            select(proposal_files.c.document_id)
            .where(proposal_files.c.document_id == document_id, proposal_files.c.use_in_chat.is_(True))
            .limit(1)
        )
        with self._engine.connect() as connection:
            return connection.execute(query).first() is not None
