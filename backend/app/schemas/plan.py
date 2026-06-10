import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlanCreate(BaseModel):
    title: str = Field(default="Untitled plan", max_length=500)
    kind: str = Field(default="checklist", pattern="^(roadmap|checklist)$")
    description: str = Field(default="", max_length=4000)


class PlanUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=4000)


class PlanSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    kind: str
    description: str
    position: int
    total_steps: int = 0
    done_steps: int = 0
    created_at: datetime
    updated_at: datetime


class StepCreate(BaseModel):
    title: str = Field(max_length=500)
    due_at: datetime | None = None
    topic_id: uuid.UUID | None = None
    note: str = Field(default="", max_length=4000)


class StepUpdate(BaseModel):
    """Partial update; fields explicitly sent as null clear the value."""

    title: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, pattern="^(todo|doing|done)$")
    note: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None
    topic_id: uuid.UUID | None = None


class StepReorder(BaseModel):
    ordered_ids: list[uuid.UUID]


class StepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_id: uuid.UUID
    title: str
    status: str
    note: str
    position: int
    due_at: datetime | None
    topic_id: uuid.UUID | None
    topic_title: str | None = None
    created_at: datetime
    updated_at: datetime


class PlanRead(PlanSummary):
    steps: list[StepRead] = []


class AgendaItem(BaseModel):
    step_id: uuid.UUID
    plan_id: uuid.UUID
    plan_title: str
    title: str
    status: str
    due_at: datetime
