from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ARRAY, Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.version import Version


class Topic(Base, UUIDMixin, TimestampMixin):
    """A node in the study-notes tree.

    A root topic (``parent_id is None``) is a top-level "note" with its own title.
    Each topic can contain child topics (sub-topics, recursively) and a block-based
    content document stored as JSON (a BlockNote document).
    """

    __tablename__ = "topics"
    __table_args__ = (
        # Fast lookup of a user's siblings under a given parent, ordered by position.
        Index("ix_topics_owner_parent_position", "owner_id", "parent_id", "position"),
        Index("ix_topics_owner_pinned", "owner_id", "is_pinned"),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # BlockNote document: a JSON array of block objects. Defaults to an empty document.
    content: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Denormalised plaintext of `content`, kept in sync on save for fast search.
    search_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    owner: Mapped["User"] = relationship(back_populates="topics")
    parent: Mapped["Topic | None"] = relationship(
        back_populates="children", remote_side="Topic.id"
    )
    children: Mapped[list["Topic"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Topic.position",
        passive_deletes=True,
    )
    versions: Mapped[list["Version"]] = relationship(
        back_populates="topic", cascade="all, delete-orphan", passive_deletes=True
    )
