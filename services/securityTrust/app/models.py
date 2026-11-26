import uuid
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    Integer,
    ForeignKey,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from app.db import Base


# ----------------------------
# Organization
# ----------------------------
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    trust_center_published = Column(Boolean, default=False, nullable=False, server_default="false")


# ----------------------------
# Trust Overview
# ----------------------------
class TrustOverview(Base):
    __tablename__ = "trust_overview"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    summary = Column(Text, nullable=False)
    security_commitment = Column(Text, nullable=True)
    contact_email = Column(String, nullable=True)

    published = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# ----------------------------
# Trust Resources
# ----------------------------
class TrustResource(Base):
    __tablename__ = "trust_resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)  # policy, whitepaper, link
    url = Column(String, nullable=True)

    published = Column(Boolean, default=False, nullable=False)


# ----------------------------
# Trust Controls / Compliance
# ----------------------------
class TrustCompliance(Base):
    __tablename__ = "trust_compliance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    framework = Column(String, nullable=False)  # ISO27001, SOC2, GDPR
    status = Column(String, nullable=True)  # compliant, in-progress
    evidence_url = Column(String, nullable=True)

    published = Column(Boolean, default=False, nullable=False)


# ----------------------------
# Trust Subprocessors
# ----------------------------
class TrustSubprocessor(Base):
    __tablename__ = "trust_subprocessors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    purpose = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    data_categories = Column(Text, nullable=True)

    published = Column(Boolean, default=False, nullable=False)


# ----------------------------
# Trust FAQs
# ----------------------------
class TrustFAQ(Base):
    __tablename__ = "trust_faq"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)

    published = Column(Boolean, default=False, nullable=False)


# ----------------------------
# Trust Updates
# ----------------------------
class TrustUpdate(Base):
    __tablename__ = "trust_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)

    published = Column(Boolean, default=False, nullable=False)


# ----------------------------
# Trust Badge
# ----------------------------
class TrustBadge(Base):
    __tablename__ = "trust_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    level = Column(String, nullable=True)  # bronze, silver, gold
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ----------------------------
# Access Requests
# ----------------------------
class TrustAccessRequest(Base):
    __tablename__ = "trust_access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ----------------------------
# Subscriptions
# ----------------------------
class TrustSubscription(Base):
    __tablename__ = "trust_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    email = Column(String, nullable=False)
    unsubscribe_token = Column(String, unique=True, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ----------------------------
# GRC Frameworks / Controls
# ----------------------------
class GRCFramework(Base):
    __tablename__ = "grc_frameworks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True, index=True)
    jurisdiction = Column(String, nullable=True)  # Ethiopia, ISO, etc.
    sector = Column(String, nullable=True)  # fintech, healthcare, education, general_saas
    version = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    published = Column(Boolean, default=True, nullable=False)


class GRCControl(Base):
    __tablename__ = "grc_controls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    framework_id = Column(
        UUID(as_uuid=True),
        ForeignKey("grc_frameworks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    control_type = Column(String, nullable=True)  # administrative/technical/physical
    requirement = Column(Text, nullable=True)
    evidence_type = Column(String, nullable=True)
    check_type = Column(String, nullable=True)  # evidence_present, evidence_equals
    expected_value = Column(String, nullable=True)
    severity = Column(String, nullable=True)  # low/medium/high
    published = Column(Boolean, default=True, nullable=False)


class GRCEvidence(Base):
    __tablename__ = "grc_evidence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    evidence_type = Column(String, nullable=False)
    source = Column(String, nullable=True)
    value = Column(String, nullable=True)
    data = Column(Text, nullable=True)
    extra_metadata = Column(Text, nullable=True)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    published = Column(Boolean, default=True, nullable=False)


class GRCIntegration(Base):
    __tablename__ = "grc_integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider = Column(String, nullable=False)  # github, aws, gcp, okta, google_workspace, jira
    status = Column(String, nullable=False, default="disconnected")  # connected/disconnected/error
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    config = Column(Text, nullable=True)
    last_error = Column(Text, nullable=True)
    published = Column(Boolean, default=True, nullable=False)


class GRCControlStatus(Base):
    __tablename__ = "grc_control_status"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    control_id = Column(
        UUID(as_uuid=True),
        ForeignKey("grc_controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    framework_id = Column(
        UUID(as_uuid=True),
        ForeignKey("grc_frameworks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String, nullable=False, default="unknown")  # pass/fail/partial/na/unknown
    details = Column(Text, nullable=True)
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ----------------------------
# Trust Requests (org-submitted trust center requests)
# ----------------------------
class TrustRequest(Base):
    __tablename__ = "trust_requests"

    id                           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id              = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_name            = Column(String, nullable=False)
    organization_slug            = Column(String, nullable=False)
    status                       = Column(String, nullable=False, default="pending")
    overview_summary             = Column(Text, nullable=True)
    overview_security_commitment = Column(Text, nullable=True)
    overview_contact_email       = Column(String, nullable=True)
    compliance_json              = Column(Text, nullable=True)
    subprocessors_json           = Column(Text, nullable=True)
    faq_json                     = Column(Text, nullable=True)
    updates_json                 = Column(Text, nullable=True)
    reviewer_notes               = Column(Text, nullable=True)
    created_at                   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at                   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    # Extra nullable columns added post-initial-migration
    org_id                       = Column(String, nullable=True, index=True)   # varchar alias for quick lookup
    org_email                    = Column(String, nullable=True)
    content                      = Column(Text, nullable=True)                 # raw JSON blob fallback
    submitted_at                 = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    reviewed_at                  = Column(DateTime(timezone=True), nullable=True)
    reviewed_by                  = Column(String, nullable=True)


# ----------------------------
# Org Notifications (for trust request status updates)
# ----------------------------
class TrustOrgNotification(Base):
    __tablename__ = "trust_org_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    kind = Column(String, nullable=False, default="info")  # info / success / warning
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
