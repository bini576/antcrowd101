import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import UserRole
from app.schemas.email import PortalEmail


class RegisterRequest(BaseModel):
    email: PortalEmail
    password: str
    role: str
    organization_id: uuid.UUID | None = None
    trainer_id: uuid.UUID | None = None


class LoginRequest(BaseModel):
    email: PortalEmail
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: PortalEmail
    role: str
    legacy_role: str | None = None
    organization_id: uuid.UUID | None = None
    trainer_id: uuid.UUID | None = None
    module_access: list[str] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    token: str | None = None
    user: UserRead
