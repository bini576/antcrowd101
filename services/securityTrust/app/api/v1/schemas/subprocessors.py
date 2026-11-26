from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional

class TrustSubprocessorBase(BaseModel):
    name: str
    purpose: Optional[str] = None
    location: Optional[str] = None
    data_categories: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TrustSubprocessorCreate(TrustSubprocessorBase):
    organization_id: UUID

class TrustSubprocessorRead(TrustSubprocessorBase):
    id: UUID
    published: bool
