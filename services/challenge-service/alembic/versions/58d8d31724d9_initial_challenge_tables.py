"""initial challenge tables

Revision ID: 58d8d31724d9
Revises:
Create Date: 2026-03-30 10:45:40.699519
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "58d8d31724d9"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "challenge_programs",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("owner_username", sa.String(length=40), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("reward", sa.String(length=160), nullable=False),
        sa.Column("reward_value", sa.Integer(), nullable=False),
        sa.Column("rules", sa.Text(), nullable=False),
        sa.Column("track", sa.String(length=120), nullable=False),
        sa.Column("priority", sa.String(length=120), nullable=False),
        sa.Column("challenge_categories", sa.JSON(), nullable=False),
        sa.Column("prize_pool_etb", sa.String(length=80), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("flag_format", sa.String(length=80), nullable=False),
        sa.Column("correct_flag", sa.String(length=180), nullable=True),
        sa.Column("auto_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenge_programs_status", "challenge_programs", ["status"], unique=False)
    op.create_index("ix_challenge_programs_owner_username", "challenge_programs", ["owner_username"], unique=False)
    op.create_index("ix_challenge_programs_created_at", "challenge_programs", ["created_at"], unique=False)

    op.create_table(
        "challenge_participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["challenge_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("program_id", "username", name="uq_challenge_participant_program_user"),
    )
    op.create_index("ix_challenge_participants_program_id", "challenge_participants", ["program_id"], unique=False)
    op.create_index("ix_challenge_participants_username", "challenge_participants", ["username"], unique=False)

    op.create_table(
        "challenge_submissions",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("program_title", sa.String(length=120), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("impact", sa.String(length=40), nullable=False),
        sa.Column("evidence", sa.String(length=240), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("value_awarded", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["challenge_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenge_submissions_program_id", "challenge_submissions", ["program_id"], unique=False)
    op.create_index("ix_challenge_submissions_username", "challenge_submissions", ["username"], unique=False)
    op.create_index("ix_challenge_submissions_created_at", "challenge_submissions", ["created_at"], unique=False)

    op.create_table(
        "challenge_notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=140), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenge_notifications_username", "challenge_notifications", ["username"], unique=False)
    op.create_index("ix_challenge_notifications_is_read", "challenge_notifications", ["is_read"], unique=False)
    op.create_index("ix_challenge_notifications_created_at", "challenge_notifications", ["created_at"], unique=False)

    op.create_table(
        "challenge_ctf_levels",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("difficulty", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("starting_point", sa.Text(), nullable=False),
        sa.Column("flag", sa.String(length=180), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["challenge_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenge_ctf_levels_program_id", "challenge_ctf_levels", ["program_id"], unique=False)

    op.create_table(
        "challenge_ctf_flag_submissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("challenge_id", sa.String(length=80), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("submitted_flag", sa.String(length=180), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("points_awarded", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["challenge_programs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["challenge_id"], ["challenge_ctf_levels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenge_ctf_flag_submissions_program_id", "challenge_ctf_flag_submissions", ["program_id"], unique=False)
    op.create_index("ix_challenge_ctf_flag_submissions_challenge_id", "challenge_ctf_flag_submissions", ["challenge_id"], unique=False)
    op.create_index("ix_challenge_ctf_flag_submissions_username", "challenge_ctf_flag_submissions", ["username"], unique=False)
    op.create_index("ix_challenge_ctf_flag_submissions_created_at", "challenge_ctf_flag_submissions", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_challenge_ctf_flag_submissions_created_at", table_name="challenge_ctf_flag_submissions")
    op.drop_index("ix_challenge_ctf_flag_submissions_username", table_name="challenge_ctf_flag_submissions")
    op.drop_index("ix_challenge_ctf_flag_submissions_challenge_id", table_name="challenge_ctf_flag_submissions")
    op.drop_index("ix_challenge_ctf_flag_submissions_program_id", table_name="challenge_ctf_flag_submissions")
    op.drop_table("challenge_ctf_flag_submissions")
    op.drop_index("ix_challenge_ctf_levels_program_id", table_name="challenge_ctf_levels")
    op.drop_table("challenge_ctf_levels")
    op.drop_index("ix_challenge_notifications_created_at", table_name="challenge_notifications")
    op.drop_index("ix_challenge_notifications_is_read", table_name="challenge_notifications")
    op.drop_index("ix_challenge_notifications_username", table_name="challenge_notifications")
    op.drop_table("challenge_notifications")
    op.drop_index("ix_challenge_submissions_created_at", table_name="challenge_submissions")
    op.drop_index("ix_challenge_submissions_username", table_name="challenge_submissions")
    op.drop_index("ix_challenge_submissions_program_id", table_name="challenge_submissions")
    op.drop_table("challenge_submissions")
    op.drop_index("ix_challenge_participants_username", table_name="challenge_participants")
    op.drop_index("ix_challenge_participants_program_id", table_name="challenge_participants")
    op.drop_table("challenge_participants")
    op.drop_index("ix_challenge_programs_created_at", table_name="challenge_programs")
    op.drop_index("ix_challenge_programs_owner_username", table_name="challenge_programs")
    op.drop_index("ix_challenge_programs_status", table_name="challenge_programs")
    op.drop_table("challenge_programs")
