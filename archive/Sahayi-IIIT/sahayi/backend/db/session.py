"""Async SQLAlchemy session setup for SAHAYI."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import get_settings
from db.models import Base

engine = create_async_engine(get_settings().database_url, future=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Create all tables if they do not already exist.

    Args:
        None: Uses module-level engine and metadata.
    Returns:
        None.
    Agent:
        Database
    """

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
