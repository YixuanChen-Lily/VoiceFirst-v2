"""How many times each guest has used each capped feature."""

from sqlalchemy import Column, Engine, Integer, MetaData, String, Table
from sqlalchemy.dialects.postgresql import insert

metadata = MetaData()

guest_usage = Table(
    "guest_usage",
    metadata,
    Column("owner_id", String(64), primary_key=True),
    Column("action", String(32), primary_key=True),
    Column("count", Integer, nullable=False),
)


class UsageStore:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        metadata.create_all(engine)

    def try_use(self, owner_id: str, action: str, limit: int) -> bool:
        """
        Count one more use, unless the owner has already reached the limit. One statement,
        so two requests at the same moment can't both slip past the limit.
        """
        statement = insert(guest_usage).values(owner_id=owner_id, action=action, count=1)
        statement = statement.on_conflict_do_update(
            index_elements=[guest_usage.c.owner_id, guest_usage.c.action],
            set_={"count": guest_usage.c.count + 1},
            where=guest_usage.c.count < limit,
        ).returning(guest_usage.c.count)
        with self._engine.begin() as connection:
            return connection.execute(statement).first() is not None
