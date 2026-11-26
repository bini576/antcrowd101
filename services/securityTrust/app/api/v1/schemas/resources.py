from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional

class TrustResourceBase(BaseModel):
    title: str
    resource_type: Optional[str] = None
    url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TrustResourceCreate(TrustResourceBase):
    organization_id: UUID

class TrustResourceRead(TrustResourceBase):
    id: UUID
    published: bool
