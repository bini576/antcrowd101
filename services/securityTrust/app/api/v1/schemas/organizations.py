from pydantic import BaseModel, ConfigDict
from uuid import UUID

class OrganizationBase(BaseModel):
    name: str
    slug: str
    model_config = ConfigDict(from_attributes=True)

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationRead(OrganizationBase):
    id: UUID
