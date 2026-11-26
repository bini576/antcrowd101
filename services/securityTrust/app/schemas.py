import re
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from uuid import UUID
from typing import Optional, List
from datetime import datetime


# ----------------------------
# Organization
# ----------------------------
class OrganizationCreate(BaseModel):
    name: str
    slug: str


class OrganizationOut(OrganizationCreate):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Trust Overview
# ----------------------------
class TrustOverviewCreate(BaseModel):
    summary: str
    security_commitment: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    published: bool = False


class TrustOverviewOut(TrustOverviewCreate):
    id: UUID
    organization_id: UUID
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Resources
# ----------------------------
class TrustResourceCreate(BaseModel):
    title: str
    resource_type: Optional[str] = None
    url: Optional[str] = None
    published: bool = False


class TrustResourceOut(TrustResourceCreate):
    id: UUID
    organization_id: UUID
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Compliance
# ----------------------------
class TrustComplianceCreate(BaseModel):
    framework: str
    status: Optional[str] = None
    evidence_url: Optional[str] = None
    published: bool = False


class TrustComplianceOut(TrustComplianceCreate):
    id: UUID
    organization_id: UUID
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Subprocessors
# ----------------------------
class TrustSubprocessorCreate(BaseModel):
    name: str
    purpose: Optional[str] = None
    location: Optional[str] = None
    data_categories: Optional[str] = None
    published: bool = False


class TrustSubprocessorOut(TrustSubprocessorCreate):
    id: UUID
    organization_id: UUID
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# FAQ
# ----------------------------
class TrustFAQCreate(BaseModel):
    question: str
    answer: str
    order_index: int = 0
    published: bool = False


class TrustFAQOut(TrustFAQCreate):
    id: UUID
    organization_id: UUID
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Updates
# ----------------------------
class TrustUpdateCreate(BaseModel):
    title: str
    content: str
    published_at: Optional[datetime] = None
    published: bool = False


class TrustUpdateOut(TrustUpdateCreate):
    id: UUID
    organization_id: UUID
    model_config = ConfigDict(from_attributes=True)


# Badge
# ----------------------------
class TrustBadgeOut(BaseModel):
    id: UUID
    organization_id: UUID
    level: Optional[str]
    issued_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Access Requests
# ----------------------------
class TrustAccessRequestCreate(BaseModel):
    full_name: str
    email: EmailStr
    company_name: Optional[str] = None
    reason: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        normalized = " ".join(value.split()).strip()
        if not normalized:
            raise ValueError("Full name is required")

        parts = normalized.split(" ")
        letter_pattern = re.compile(r"^[A-Za-z]{3,}$")
        if not all(letter_pattern.fullmatch(part) for part in parts):
            raise ValueError("Use at least 3 letters")
        return normalized


class TrustAccessRequestOut(TrustAccessRequestCreate):
    id: UUID
    organization_id: UUID
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Subscriptions
# ----------------------------
class TrustSubscriptionCreate(BaseModel):
    email: EmailStr


class TrustSubscriptionOut(TrustSubscriptionCreate):
    id: UUID
    organization_id: UUID
    unsubscribe_token: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----------------------------
# Trust Center Aggregate
# ----------------------------
class TrustCenterOut(BaseModel):
    organization: OrganizationOut
    overview: Optional[TrustOverviewOut] = None
    resources: List[TrustResourceOut]
    compliance: List[TrustComplianceOut]
    subprocessors: List[TrustSubprocessorOut]
    faq: List[TrustFAQOut]
    updates: List[TrustUpdateOut]
    badge: Optional[TrustBadgeOut] = None
    grc_overview: Optional["GRCOverviewOut"] = None


# ----------------------------
# GRC Frameworks / Controls
# ----------------------------
class GRCFrameworkCreate(BaseModel):
    name: str
    code: Optional[str] = None
    jurisdiction: Optional[str] = None
    sector: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    published: bool = True


class GRCFrameworkOut(GRCFrameworkCreate):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class GRCControlCreate(BaseModel):
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    control_type: Optional[str] = None
    requirement: Optional[str] = None
    evidence_type: Optional[str] = None
    check_type: Optional[str] = None
    expected_value: Optional[str] = None
    severity: Optional[str] = None
    published: bool = True


class GRCControlOut(GRCControlCreate):
    id: UUID
    framework_id: UUID
    model_config = ConfigDict(from_attributes=True)


class GRCEvidenceCreate(BaseModel):
    evidence_type: str
    source: Optional[str] = None
    value: Optional[str] = None
    data: Optional[str] = None
    extra_metadata: Optional[str] = None
    published: bool = True


class GRCEvidenceOut(GRCEvidenceCreate):
    id: UUID
    organization_id: UUID
    collected_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GRCIntegrationCreate(BaseModel):
    provider: str
    status: str = "connected"
    config: Optional[str] = None
    published: bool = True


class GRCIntegrationOut(GRCIntegrationCreate):
    id: UUID
    organization_id: UUID
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class GRCControlStatusOut(BaseModel):
    id: UUID
    organization_id: UUID
    control_id: UUID
    framework_id: UUID
    status: str
    details: Optional[str] = None
    evaluated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GRCFrameworkSummary(BaseModel):
    framework_id: UUID
    name: str
    code: Optional[str] = None
    pass_count: int
    fail_count: int
    partial_count: int
    na_count: int
    unknown_count: int


class GRCOverviewOut(BaseModel):
    organization_id: UUID
    total_controls: int
    pass_count: int
    fail_count: int
    partial_count: int
    na_count: int
    unknown_count: int
    frameworks: List[GRCFrameworkSummary]


# Resolve forward references
TrustCenterOut.model_rebuild()
