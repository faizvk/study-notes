from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.topic import Topic


class Version(Base, UUIDMixin, TimestampMixin):
    """A point-in-time snapshot of a topic's title and content.

    ``is_checkpoint=True`` marks a user-named checkpoint that is preserved forever;
    automatic snapshots (``is_checkpoint=False``) are pruned beyond MAX_AUTO_VERSIONS.
    """

    __tablename__ = "versions"

    topic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title_snapshot: Mapped[str] = mapped_column(String(500), nullable=False)
    content_snapshot: Mapped[list] = mapped_column(JSONB, nullable=False)
    label: Mapped[str | None] = mapped_column(String(255))
    is_checkpoint: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    topic: Mapped["Topic"] = relationship(back_populates="versions")
