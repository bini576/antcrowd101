from pydantic import BaseModel, ConfigDict
from uuid import UUID

class TrustFAQBase(BaseModel):
    question: str
    answer: str
    order_index: int = 0
    model_config = ConfigDict(from_attributes=True)

class TrustFAQCreate(TrustFAQBase):
    organization_id: UUID

class TrustFAQRead(TrustFAQBase):
    id: UUID
    published: bool
