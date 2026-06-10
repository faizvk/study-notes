import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    content_type: str
    size: int
    created_at: datetime
    # Absolute-from-root URL the frontend can use in <img src> / links.
    url: str
