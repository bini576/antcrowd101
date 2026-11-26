import enum


class PackageType(str, enum.Enum):
    basic = "basic"
    premium = "premium"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    scheduled = "scheduled"
    completed = "completed"
    rejected = "rejected"


class UserRole(str, enum.Enum):
    admin = "admin"
    trainer = "trainer"
    organization = "organization"


class QuoteStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    approved = "approved"
    rejected = "rejected"


class InvoiceStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
    canceled = "canceled"


class PaymentVerificationStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"
