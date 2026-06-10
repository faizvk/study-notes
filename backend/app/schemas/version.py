import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.topic import BlockDocument


class VersionCreate(BaseModel):
    """Create a named checkpoint from the topic's current state."""

    label: str | None = Field(default=None, max_length=255)


class VersionSummary(BaseModel):
    """Lightweight entry for the version list (no content payload)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    topic_id: uuid.UUID
    title_snapshot: str
    label: str | None
    is_checkpoint: bool
    created_at: datetime


class VersionRead(VersionSummary):
    content_snapshot: BlockDocument
