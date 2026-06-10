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
