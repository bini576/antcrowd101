from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class BugBountyProgram(Base):
    __tablename__ = "bug_bounty_programs"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    owner_username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    program_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_assets: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    in_scope_targets: Mapped[str] = mapped_column(Text, nullable=False)
    out_of_scope: Mapped[str] = mapped_column(Text, nullable=False)
    reward_range: Mapped[str] = mapped_column(String(120), nullable=False)
    rules_of_engagement: Mapped[str] = mapped_column(Text, nullable=False)
    testing_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    testing_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget: Mapped[str] = mapped_column(String(80), nullable=False)
    poc_target_url: Mapped[str] = mapped_column(String(240), nullable=False)
    default_test_payload: Mapped[str] = mapped_column(String(180), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    reward_value: Mapped[int] = mapped_column(Integer, nullable=False, default=2500)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    participants: Mapped[list["BugBountyParticipant"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    submissions: Mapped[list["BugBountySubmission"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class BugBountyParticipant(Base):
    __tablename__ = "bug_bounty_participants"
    __table_args__ = (UniqueConstraint("program_id", "username", name="uq_bug_bounty_participant_program_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("bug_bounty_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    program: Mapped["BugBountyProgram"] = relationship(back_populates="participants")


class BugBountySubmission(Base):
    __tablename__ = "bug_bounty_submissions"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("bug_bounty_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    program_title: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    vulnerable_url: Mapped[str] = mapped_column(String(320), nullable=False)
    evidence: Mapped[str] = mapped_column(String(240), nullable=False)
    finding_categories: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    severity: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="submitted")
    value_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dispute_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispute_resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    disputed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_developer: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    developer_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    program: Mapped["BugBountyProgram"] = relationship(back_populates="submissions")


class ResearcherEarning(Base):
    __tablename__ = "bug_bounty_researcher_earnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    submission_id: Mapped[str] = mapped_column(ForeignKey("bug_bounty_submissions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="confirmed", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class PayoutRequest(Base):
    __tablename__ = "bug_bounty_payout_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    account_details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BugBountyNotification(Base):
    __tablename__ = "bug_bounty_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
