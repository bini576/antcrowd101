from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional

class TrustComplianceBase(BaseModel):
    framework: str
    status: Optional[str] = None
    evidence_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TrustComplianceCreate(TrustComplianceBase):
    organization_id: UUID

class TrustComplianceRead(TrustComplianceBase):
    id: UUID
    published: bool
