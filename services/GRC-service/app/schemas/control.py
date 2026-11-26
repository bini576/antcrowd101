import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ControlBase(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    status: str = Field(default="implemented", max_length=50)
    owner: str | None = Field(default=None, max_length=255)


class ControlCreate(ControlBase):
    organization_id: uuid.UUID


class ControlRead(ControlBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
