from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class AiRedTeamProgram(Base):
    __tablename__ = "ai_redteam_programs"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    owner_username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    access_method: Mapped[str] = mapped_column(String(80), nullable=False)
    access_url: Mapped[str] = mapped_column(String(240), nullable=False)
    model_type_version: Mapped[str] = mapped_column(String(120), nullable=False)
    scope_of_testing: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    testing_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    testing_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    budget_reward: Mapped[str] = mapped_column(String(80), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    reward_value: Mapped[int] = mapped_column(Integer, nullable=False, default=2100)
    automation_status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    automation_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    participants: Mapped[list["AiRedTeamParticipant"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    submissions: Mapped[list["AiRedTeamSubmission"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    automation_results: Mapped[list["AiAutomationResult"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class AiRedTeamParticipant(Base):
    __tablename__ = "ai_redteam_participants"
    __table_args__ = (UniqueConstraint("program_id", "username", name="uq_ai_redteam_participant_program_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("ai_redteam_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    program: Mapped["AiRedTeamProgram"] = relationship(back_populates="participants")


class AiRedTeamSubmission(Base):
    __tablename__ = "ai_redteam_submissions"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("ai_redteam_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    program_title: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str] = mapped_column(String(240), nullable=False)
    impact: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="submitted")
    value_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assigned_developer: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    developer_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    program: Mapped["AiRedTeamProgram"] = relationship(back_populates="submissions")


class AiAutomationResult(Base):
    __tablename__ = "ai_redteam_automation_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("ai_redteam_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    test_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    program: Mapped["AiRedTeamProgram"] = relationship(back_populates="automation_results")


class AiRedTeamNotification(Base):
    __tablename__ = "ai_redteam_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
