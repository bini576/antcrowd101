from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional
from datetime import datetime

class TrustBadgeBase(BaseModel):
    level: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TrustBadgeCreate(TrustBadgeBase):
    organization_id: UUID

class TrustBadgeRead(TrustBadgeBase):
    id: UUID
    issued_at: datetime
