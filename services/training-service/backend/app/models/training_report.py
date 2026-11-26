import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TrainingReport(Base):
    __tablename__ = "training_reports"
    __table_args__ = (
        CheckConstraint("satisfaction_score BETWEEN 1 AND 10", name="ck_satisfaction_score_range"),
        CheckConstraint("pre_assessment_score BETWEEN 0 AND 100", name="ck_pre_assessment_score_range"),
        CheckConstraint("post_assessment_score BETWEEN 0 AND 100", name="ck_post_assessment_score_range"),
        CheckConstraint("attendance_rate BETWEEN 0 AND 100", name="ck_attendance_rate_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    training_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    weaknesses_found: Mapped[str] = mapped_column(Text, nullable=False)
    recommendations: Mapped[str] = mapped_column(Text, nullable=False)
    satisfaction_score: Mapped[int] = mapped_column(Integer, nullable=False)
    pre_assessment_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    post_assessment_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attendance_rate: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    organization_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    organization_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    organization_feedback_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    training_plan = relationship("TrainingPlan", back_populates="report")
