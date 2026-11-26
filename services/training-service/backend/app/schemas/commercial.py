import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import InvoiceStatus, PackageType, PaymentVerificationStatus, QuoteStatus


class TrainingPackageCreate(BaseModel):
    package_type: PackageType
    display_name: str
    description: str
    duration_days: int = Field(..., ge=1)
    base_price_etb: int = Field(..., ge=0)
    per_participant_etb: int = Field(..., ge=0)


class TrainingPackageRead(BaseModel):
    id: uuid.UUID
    package_type: PackageType
    display_name: str
    description: str
    duration_days: int
    base_price_etb: int
    per_participant_etb: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrainingQuoteCreate(BaseModel):
    request_id: uuid.UUID
    notes: str | None = None


class TrainingQuoteStatusUpdate(BaseModel):
    status: QuoteStatus


class TrainingQuoteRead(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    package_type: PackageType
    number_of_participants: int
    base_price_etb: int
    per_participant_etb: int
    total_price_etb: int
    status: QuoteStatus
    notes: str | None = None
    approved_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrainingInvoiceRead(BaseModel):
    id: uuid.UUID
    quote_id: uuid.UUID
    invoice_number: str
    amount_etb: int
    status: InvoiceStatus
    payment_verification_status: PaymentVerificationStatus
    receipt_reference: str | None = None
    receipt_note: str | None = None
    receipt_uploaded_at: datetime | None = None
    payment_verified_at: datetime | None = None
    payment_verification_note: str | None = None
    issued_at: datetime
    paid_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TrainingInvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus


class TrainingInvoiceReceiptUpload(BaseModel):
    receipt_reference: str = Field(..., min_length=3, max_length=500)
    receipt_note: str | None = Field(default=None, max_length=2000)


class TrainingInvoiceVerificationUpdate(BaseModel):
    payment_verification_status: PaymentVerificationStatus
    payment_verification_note: str | None = Field(default=None, max_length=2000)
