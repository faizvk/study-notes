from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.plan_step import PlanStep


class Plan(Base, UUIDMixin, TimestampMixin):
    """A study plan: a roadmap (ordered journey) or a checklist (todos).

    Plans live alongside the notes tree — they organise the work *around*
    studying: what to learn next, what's blocking, what to review.
    """

    __tablename__ = "plans"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled plan")
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="checklist")  # roadmap | checklist
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    steps: Mapped[list["PlanStep"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanStep.position",
        passive_deletes=True,
    )
