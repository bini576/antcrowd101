"""Initial migration for AI Red Team

Revision ID: 5b902667973e
Revises:
Create Date: 2026-03-20 11:19:06.078595
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5b902667973e"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_redteam_programs",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("owner_username", sa.String(length=40), nullable=False),
        sa.Column("access_method", sa.String(length=80), nullable=False),
        sa.Column("access_url", sa.String(length=240), nullable=False),
        sa.Column("model_type_version", sa.String(length=120), nullable=False),
        sa.Column("scope_of_testing", sa.JSON(), nullable=False),
        sa.Column("testing_duration", sa.String(length=80), nullable=True),
        sa.Column("budget_reward", sa.String(length=80), nullable=False),
        sa.Column("reward_value", sa.Integer(), nullable=False),
        sa.Column("automation_status", sa.String(length=24), nullable=False),
        sa.Column("automation_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_redteam_programs_status", "ai_redteam_programs", ["status"], unique=False)
    op.create_index("ix_ai_redteam_programs_owner_username", "ai_redteam_programs", ["owner_username"], unique=False)
    op.create_index("ix_ai_redteam_programs_created_at", "ai_redteam_programs", ["created_at"], unique=False)

    op.create_table(
        "ai_redteam_participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["ai_redteam_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("program_id", "username", name="uq_ai_redteam_participant_program_user"),
    )
    op.create_index("ix_ai_redteam_participants_program_id", "ai_redteam_participants", ["program_id"], unique=False)
    op.create_index("ix_ai_redteam_participants_username", "ai_redteam_participants", ["username"], unique=False)

    op.create_table(
        "ai_redteam_submissions",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("program_title", sa.String(length=120), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("evidence", sa.String(length=240), nullable=False),
        sa.Column("impact", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("value_awarded", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["ai_redteam_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_redteam_submissions_program_id", "ai_redteam_submissions", ["program_id"], unique=False)
    op.create_index("ix_ai_redteam_submissions_username", "ai_redteam_submissions", ["username"], unique=False)
    op.create_index("ix_ai_redteam_submissions_created_at", "ai_redteam_submissions", ["created_at"], unique=False)

    op.create_table(
        "ai_redteam_automation_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("test_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("is_sensitive", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["ai_redteam_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_redteam_automation_results_program_id", "ai_redteam_automation_results", ["program_id"], unique=False)
    op.create_index("ix_ai_redteam_automation_results_created_at", "ai_redteam_automation_results", ["created_at"], unique=False)

    op.create_table(
        "ai_redteam_notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=140), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_redteam_notifications_username", "ai_redteam_notifications", ["username"], unique=False)
    op.create_index("ix_ai_redteam_notifications_is_read", "ai_redteam_notifications", ["is_read"], unique=False)
    op.create_index("ix_ai_redteam_notifications_created_at", "ai_redteam_notifications", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_redteam_notifications_created_at", table_name="ai_redteam_notifications")
    op.drop_index("ix_ai_redteam_notifications_is_read", table_name="ai_redteam_notifications")
    op.drop_index("ix_ai_redteam_notifications_username", table_name="ai_redteam_notifications")
    op.drop_table("ai_redteam_notifications")
    op.drop_index("ix_ai_redteam_automation_results_created_at", table_name="ai_redteam_automation_results")
    op.drop_index("ix_ai_redteam_automation_results_program_id", table_name="ai_redteam_automation_results")
    op.drop_table("ai_redteam_automation_results")
    op.drop_index("ix_ai_redteam_submissions_created_at", table_name="ai_redteam_submissions")
    op.drop_index("ix_ai_redteam_submissions_username", table_name="ai_redteam_submissions")
    op.drop_index("ix_ai_redteam_submissions_program_id", table_name="ai_redteam_submissions")
    op.drop_table("ai_redteam_submissions")
    op.drop_index("ix_ai_redteam_participants_username", table_name="ai_redteam_participants")
    op.drop_index("ix_ai_redteam_participants_program_id", table_name="ai_redteam_participants")
    op.drop_table("ai_redteam_participants")
    op.drop_index("ix_ai_redteam_programs_created_at", table_name="ai_redteam_programs")
    op.drop_index("ix_ai_redteam_programs_owner_username", table_name="ai_redteam_programs")
    op.drop_index("ix_ai_redteam_programs_status", table_name="ai_redteam_programs")
    op.drop_table("ai_redteam_programs")
