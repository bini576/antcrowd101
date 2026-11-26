from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional
from datetime import datetime

class TrustUpdateBase(BaseModel):
    title: str
    content: str
    published_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class TrustUpdateCreate(TrustUpdateBase):
    organization_id: UUID

class TrustUpdateRead(TrustUpdateBase):
    id: UUID
    published: bool
