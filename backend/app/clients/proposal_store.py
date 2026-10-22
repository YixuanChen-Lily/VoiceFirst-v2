"""The table of saved proposals. Each proposal belongs to the user who created it."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import Column, DateTime, Engine, MetaData, String, Table, Text, delete, insert, select, update
from sqlalchemy.dialects.postgresql import JSONB

metadata = MetaData()

proposals = Table(
    "proposals",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("owner_id", String(64), nullable=False, index=True),
    Column("title", Text, nullable=False),
    # The whole form as one JSON object, so adding a form field needs no database change.
    Column("data", JSONB, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

SUMMARY_COLUMNS = (proposals.c.id, proposals.c.title, proposals.c.created_at, proposals.c.updated_at)


@dataclass
class ProposalRecord:
    id: str
    owner_id: str
    title: str
    data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


@dataclass
class ProposalSummaryRecord:
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ProposalStore:
    """Every method is scoped to an owner: other people's proposals behave as if they do not exist."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        metadata.create_all(engine)

    def create(self, owner_id: str, title: str, data: Dict[str, Any]) -> ProposalRecord:
        now = _now()
        record = ProposalRecord(
            id=str(uuid.uuid4()), owner_id=owner_id, title=title, data=data, created_at=now, updated_at=now
        )
        with self._engine.begin() as connection:
            connection.execute(insert(proposals).values(**record.__dict__))
        return record

    def get(self, proposal_id: str, owner_id: str) -> Optional[ProposalRecord]:
        query = select(proposals).where(proposals.c.id == proposal_id, proposals.c.owner_id == owner_id)
        with self._engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        return ProposalRecord(**row) if row else None

    def list(self, owner_id: str) -> List[ProposalSummaryRecord]:
        """Most recently saved first. Leaves out the form data, which the list does not need."""
        query = (
            select(*SUMMARY_COLUMNS)
            .where(proposals.c.owner_id == owner_id)
            .order_by(proposals.c.updated_at.desc())
        )
        with self._engine.connect() as connection:
            return [ProposalSummaryRecord(**row) for row in connection.execute(query).mappings()]

    def update(self, proposal_id: str, owner_id: str, title: str, data: Dict[str, Any]) -> Optional[ProposalRecord]:
        query = (
            update(proposals)
            .where(proposals.c.id == proposal_id, proposals.c.owner_id == owner_id)
            .values(title=title, data=data, updated_at=_now())
        )
        with self._engine.begin() as connection:
            changed = connection.execute(query).rowcount
        return self.get(proposal_id, owner_id) if changed else None

    def delete(self, proposal_id: str, owner_id: str) -> bool:
        query = delete(proposals).where(proposals.c.id == proposal_id, proposals.c.owner_id == owner_id)
        with self._engine.begin() as connection:
            return connection.execute(query).rowcount > 0
