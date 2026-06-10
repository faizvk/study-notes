import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# A BlockNote document is a JSON array of block objects.
BlockDocument = list[dict[str, Any]]


class TopicCreate(BaseModel):
    title: str = Field(default="Untitled", max_length=500)
    parent_id: uuid.UUID | None = None
    # Optional initial position; if omitted the topic is appended after its siblings.
    position: int | None = None


class TopicUpdate(BaseModel):
    """Partial update. Saving content also creates an automatic version snapshot."""

    title: str | None = Field(default=None, max_length=500)
    content: BlockDocument | None = None
    tags: list[str] | None = None
    is_pinned: bool | None = None


class TopicMove(BaseModel):
    """Move a topic to a new parent and/or position among siblings."""

    parent_id: uuid.UUID | None = None
    position: int = Field(ge=0)


class TopicReorder(BaseModel):
    """Reorder a set of sibling topics; ``ordered_ids`` is the new left-to-right order."""

    parent_id: uuid.UUID | None = None
    ordered_ids: list[uuid.UUID]


class TopicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    position: int
    content: BlockDocument
    tags: list[str]
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class TopicNode(BaseModel):
    """Lightweight node for the navigation tree (no content payload)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    position: int
    is_pinned: bool = False
    children: list["TopicNode"] = Field(default_factory=list)


class TopicCard(BaseModel):
    """A child subtopic rendered as a clickable card."""

    id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    position: int
    is_pinned: bool
    tags: list[str]
    child_count: int
    preview: str
    updated_at: datetime


class SearchResult(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    snippet: str
    matched_in: str  # "title" | "content"
    tags: list[str]
    is_pinned: bool
