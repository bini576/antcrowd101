import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PackageType, RequestStatus


class TrainingRequest(Base):
    __tablename__ = "training_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    researcher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trainers.id", ondelete="SET NULL"), nullable=True
    )
    package_type: Mapped[PackageType] = mapped_column(Enum(PackageType, name="package_type_enum"), nullable=False)
    number_of_participants: Mapped[int] = mapped_column(Integer, nullable=False)
    preferred_date: Mapped[date] = mapped_column(Date, nullable=False)
    special_focus: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status_enum"), nullable=False, default=RequestStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization = relationship("Organization", back_populates="training_requests")
    researcher = relationship("Trainer")
    quote = relationship("TrainingQuote", back_populates="request", uselist=False, cascade="all,delete-orphan")
    training_plan = relationship("TrainingPlan", back_populates="request", uselist=False, cascade="all,delete-orphan")

    @property
    def organization_name(self) -> str | None:
        return self.organization.name if self.organization else None

    @property
    def organization_sector(self) -> str | None:
        return self.organization.sector if self.organization else None

    @property
    def organization_contact_person(self) -> str | None:
        return self.organization.contact_person if self.organization else None

    @property
    def organization_contact_email(self) -> str | None:
        return self.organization.contact_email if self.organization else None

    @property
    def organization_phone(self) -> str | None:
        return self.organization.phone if self.organization else None
