from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class ChallengeProgram(Base):
    __tablename__ = "challenge_programs"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    owner_username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    reward: Mapped[str] = mapped_column(String(160), nullable=False)
    reward_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rules: Mapped[str] = mapped_column(Text, nullable=False)
    track: Mapped[str] = mapped_column(String(120), nullable=False)
    priority: Mapped[str] = mapped_column(String(120), nullable=False)
    challenge_categories: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    prize_pool_etb: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    flag_format: Mapped[str] = mapped_column(String(80), nullable=False, default="flag{example_*}")
    correct_flag: Mapped[str | None] = mapped_column(String(180), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    auto_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    participants: Mapped[list["ChallengeParticipant"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    submissions: Mapped[list["ChallengeSubmission"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    ctf_levels: Mapped[list["CtfLevel"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    ctf_flag_submissions: Mapped[list["CtfFlagSubmission"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"
    __table_args__ = (UniqueConstraint("program_id", "username", name="uq_challenge_participant_program_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("challenge_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    program: Mapped["ChallengeProgram"] = relationship(back_populates="participants")


class ChallengeSubmission(Base):
    __tablename__ = "challenge_submissions"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("challenge_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    program_title: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[str] = mapped_column(String(40), nullable=False)
    evidence: Mapped[str] = mapped_column(String(240), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="validated")
    value_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assigned_developer: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    developer_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    program: Mapped["ChallengeProgram"] = relationship(back_populates="submissions")


class ChallengeNotification(Base):
    __tablename__ = "challenge_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)


class CtfLevel(Base):
    __tablename__ = "challenge_ctf_levels"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("challenge_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    starting_point: Mapped[str] = mapped_column(Text, nullable=False)
    flag: Mapped[str] = mapped_column(String(180), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    program: Mapped["ChallengeProgram"] = relationship(back_populates="ctf_levels")
    submissions: Mapped[list["CtfFlagSubmission"]] = relationship(back_populates="level", cascade="all, delete-orphan")


class CtfFlagSubmission(Base):
    __tablename__ = "challenge_ctf_flag_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("challenge_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id: Mapped[str] = mapped_column(ForeignKey("challenge_ctf_levels.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    submitted_flag: Mapped[str] = mapped_column(String(180), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    program: Mapped["ChallengeProgram"] = relationship(back_populates="ctf_flag_submissions")
    level: Mapped["CtfLevel"] = relationship(back_populates="submissions")
