"""Async SQLAlchemy engine + session factory."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.settings import get_settings


class Base(DeclarativeBase):
    pass


def _engine():
    s = get_settings()
    # pool_recycle=300: recycle connections older than 5 minutes — many
    # managed Postgres providers and idle laptops drop sockets after a few
    # minutes of inactivity, which then surfaces as ConnectionDoesNotExistError
    # on the first request after a quiet period. pool_pre_ping is a second
    # line of defence (ping before checkout) so a dead socket gets rotated out
    # before SQLAlchemy hands it to a query.
    return create_async_engine(
        s.database_url,
        pool_pre_ping=True,
        pool_recycle=300,
        future=True,
    )


_engine_singleton = None
_session_factory = None


def get_engine():
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = _engine()
    return _engine_singleton


def get_sessionmaker():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False, class_=AsyncSession)
    return _session_factory


async def get_session() -> AsyncSession:
    factory = get_sessionmaker()
    async with factory() as session:
        yield session
