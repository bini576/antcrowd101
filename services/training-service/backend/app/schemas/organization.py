import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.email import PortalEmail


class OrganizationCreate(BaseModel):
    name: str
    sector: str
    contact_person: str
    contact_email: PortalEmail
    phone: str
    address: str


class OrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    sector: str
    contact_person: str
    contact_email: PortalEmail
    phone: str
    address: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
