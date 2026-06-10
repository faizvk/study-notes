from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class FileAsset(Base, UUIDMixin, TimestampMixin):
    """An uploaded file (image, etc.).

    For now the binary lives in Postgres (``data`` column). The storage layer is
    abstracted behind ``app.services.storage`` so this can move to S3 later without
    touching the routes.
    """

    __tablename__ = "file_assets"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
