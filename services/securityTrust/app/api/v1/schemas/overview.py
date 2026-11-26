from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional

# Pydantic v2 BaseModel configuration
class TrustOverviewBase(BaseModel):
    summary: str
    security_commitment: Optional[str] = None
    contact_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TrustOverviewCreate(TrustOverviewBase):
    organization_id: UUID

class TrustOverviewRead(TrustOverviewBase):
    id: UUID
    published: bool
