import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import PackageType, RequestStatus


class TrainingRequestCreate(BaseModel):
    organization_id: uuid.UUID
    package_type: PackageType
    number_of_participants: int = Field(..., ge=1, le=1000)
    preferred_date: date
    special_focus: str | None = Field(None, max_length=500)


class TrainingRequestRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str | None = None
    organization_sector: str | None = None
    organization_contact_person: str | None = None
    organization_contact_email: str | None = None
    organization_phone: str | None = None
    researcher_id: uuid.UUID | None = None
    package_type: PackageType
    number_of_participants: int
    preferred_date: date
    special_focus: str | None
    status: RequestStatus
    created_at: datetime
    scheduled_date: date | None = None
    status_changed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TrainingRequestStatusUpdate(BaseModel):
    status: RequestStatus


class TrainingRequestAssignResearcher(BaseModel):
    researcher_id: uuid.UUID


class TrainingPlanCreate(BaseModel):
    request_id: uuid.UUID
    trainer_id: uuid.UUID
    start_date: date
    end_date: date
    location: str = Field(..., min_length=2, max_length=200)
    customized_outline: str = Field(..., min_length=10, max_length=10000)


class TrainingPlanRead(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    trainer_id: uuid.UUID
    start_date: date
    end_date: date
    location: str
    customized_outline: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
