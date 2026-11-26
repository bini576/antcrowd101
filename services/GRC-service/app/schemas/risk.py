import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RiskBase(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    severity: str = Field(default="medium", max_length=20)
    status: str = Field(default="open", max_length=30)
    owner: str | None = Field(default=None, max_length=255)


class RiskCreate(RiskBase):
    organization_id: uuid.UUID


class RiskRead(RiskBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
