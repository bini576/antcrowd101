import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TrainingReportCreate(BaseModel):
    training_plan_id: uuid.UUID
    summary: str
    weaknesses_found: str
    recommendations: str
    satisfaction_score: int = Field(..., ge=1, le=10)
    pre_assessment_score: int = Field(..., ge=0, le=100)
    post_assessment_score: int = Field(..., ge=0, le=100)
    attendance_rate: int = Field(..., ge=0, le=100)


class TrainingReportRead(BaseModel):
    id: uuid.UUID
    training_plan_id: uuid.UUID
    summary: str
    weaknesses_found: str
    recommendations: str
    satisfaction_score: int
    pre_assessment_score: int
    post_assessment_score: int
    attendance_rate: int
    organization_rating: int | None = None
    organization_feedback: str | None = None
    organization_feedback_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrainingReportFeedbackUpdate(BaseModel):
    organization_rating: int = Field(..., ge=1, le=5)
    organization_feedback: str = Field(..., min_length=5, max_length=5000)
