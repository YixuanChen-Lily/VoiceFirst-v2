"""The Postgres connection shared by the document records and the vector index."""

from functools import lru_cache
from typing import Optional

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import URL

from . import settings


def parse_database_url(raw: str) -> URL:
    """
    Split a postgres connection string into its parts by hand. Passwords often
    contain characters such as "/" or "@" that a standard URL parser misreads.
    """
    rest = raw.strip().split("://", 1)[-1]
    userinfo, _, hostpart = rest.rpartition("@")
    username, _, password = userinfo.partition(":")
    hostport, _, database = hostpart.partition("/")
    host, _, port = hostport.partition(":")
    return URL.create(
        "postgresql+psycopg",
        username=username,
        password=password,
        host=host,
        port=int(port) if port else 5432,
        database=database.split("?", 1)[0] or "postgres",
    )


def is_configured() -> bool:
    return bool(settings.SUPABASE_DB_URL)


def create_database_engine(raw_url: str) -> Engine:
    # A small pool: Supabase's session pooler allows few connections on the free plan.
    return create_engine(
        parse_database_url(raw_url),
        pool_size=2,
        max_overflow=2,
        pool_pre_ping=True,
        pool_recycle=300,
    )


@lru_cache(maxsize=1)
def get_engine() -> Optional[Engine]:
    if not settings.SUPABASE_DB_URL:
        return None
    return create_database_engine(settings.SUPABASE_DB_URL)
