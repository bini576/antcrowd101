import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import InvoiceStatus, PaymentVerificationStatus


class TrainingInvoice(Base):
    __tablename__ = "training_invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("training_quotes.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    amount_etb: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus, name="invoice_status_enum"), nullable=False, default=InvoiceStatus.unpaid)
    payment_verification_status: Mapped[PaymentVerificationStatus] = mapped_column(
        Enum(PaymentVerificationStatus, name="payment_verification_status_enum"),
        nullable=False,
        default=PaymentVerificationStatus.none,
    )
    receipt_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)
    receipt_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_verification_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    quote = relationship("TrainingQuote", back_populates="invoice")
