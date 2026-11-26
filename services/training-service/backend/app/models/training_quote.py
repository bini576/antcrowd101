import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import QuoteStatus


class TrainingQuote(Base):
    __tablename__ = "training_quotes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("training_requests.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    package_type: Mapped[str] = mapped_column(Text, nullable=False)
    number_of_participants: Mapped[int] = mapped_column(Integer, nullable=False)
    base_price_etb: Mapped[int] = mapped_column(Integer, nullable=False)
    per_participant_etb: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price_etb: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[QuoteStatus] = mapped_column(Enum(QuoteStatus, name="quote_status_enum"), nullable=False, default=QuoteStatus.sent)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request = relationship("TrainingRequest", back_populates="quote")
    invoice = relationship("TrainingInvoice", back_populates="quote", uselist=False, cascade="all,delete-orphan")
