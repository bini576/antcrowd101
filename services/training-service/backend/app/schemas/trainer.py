import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.email import PortalEmail


class TrainerCreate(BaseModel):
    name: str
    email: PortalEmail
    expertise: str


class TrainerRead(BaseModel):
    id: uuid.UUID
    name: str
    email: PortalEmail
    expertise: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
