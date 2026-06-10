from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.plan import Plan


class PlanStep(Base, UUIDMixin, TimestampMixin):
    """One item inside a plan: a roadmap milestone or a checklist task.

    A step can carry a due date (powers reminders/agenda) and may link to a
    note in the study tree, connecting planning directly to the material.
    """

    __tablename__ = "plan_steps"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("plans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="todo")  # todo | doing | done
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"), nullable=True
    )

    plan: Mapped["Plan"] = relationship(back_populates="steps")
