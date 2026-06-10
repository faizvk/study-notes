from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file_asset import FileAsset


class StorageBackend(ABC):
    """Abstract file storage.

    Swap the concrete implementation (e.g. for an S3 backend) without changing the
    routes. The current implementation keeps bytes in Postgres.
    """

    @abstractmethod
    async def save(
        self, db: AsyncSession, *, owner_id: uuid.UUID, filename: str, content_type: str, data: bytes
    ) -> FileAsset: ...

    @abstractmethod
    async def get(self, db: AsyncSession, *, file_id: uuid.UUID) -> FileAsset | None: ...

    @abstractmethod
    async def delete(self, db: AsyncSession, *, owner_id: uuid.UUID, file_id: uuid.UUID) -> bool: ...


class PostgresStorageBackend(StorageBackend):
    """Stores the file bytes directly in the ``file_assets`` table."""

    async def save(self, db, *, owner_id, filename, content_type, data):
        asset = FileAsset(
            owner_id=owner_id,
            filename=filename,
            content_type=content_type,
            size=len(data),
            data=data,
        )
        db.add(asset)
        await db.flush()
        await db.refresh(asset)
        return asset

    async def get(self, db, *, file_id):
        return await db.get(FileAsset, file_id)

    async def delete(self, db, *, owner_id, file_id):
        stmt = select(FileAsset).where(
            FileAsset.id == file_id, FileAsset.owner_id == owner_id
        )
        asset = (await db.execute(stmt)).scalar_one_or_none()
        if asset is None:
            return False
        await db.delete(asset)
        await db.flush()
        return True


# Singleton used by the routes. Replace with an S3-backed instance later.
storage: StorageBackend = PostgresStorageBackend()
