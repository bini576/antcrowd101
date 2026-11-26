"""initial bug bounty tables

Revision ID: 1afe8b060b96
Revises:
Create Date: 2026-04-06 11:14:30.436410
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1afe8b060b96"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bug_bounty_programs",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("owner_username", sa.String(length=40), nullable=False),
        sa.Column("program_type", sa.String(length=32), nullable=False),
        sa.Column("target_assets", sa.JSON(), nullable=False),
        sa.Column("in_scope_targets", sa.Text(), nullable=False),
        sa.Column("out_of_scope", sa.Text(), nullable=False),
        sa.Column("reward_range", sa.String(length=120), nullable=False),
        sa.Column("rules_of_engagement", sa.Text(), nullable=False),
        sa.Column("testing_start_date", sa.Date(), nullable=True),
        sa.Column("testing_end_date", sa.Date(), nullable=True),
        sa.Column("budget", sa.String(length=80), nullable=False),
        sa.Column("poc_target_url", sa.String(length=240), nullable=False),
        sa.Column("default_test_payload", sa.String(length=180), nullable=False),
        sa.Column("reward_value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bug_bounty_programs_status", "bug_bounty_programs", ["status"], unique=False)
    op.create_index("ix_bug_bounty_programs_owner_username", "bug_bounty_programs", ["owner_username"], unique=False)
    op.create_index("ix_bug_bounty_programs_created_at", "bug_bounty_programs", ["created_at"], unique=False)

    op.create_table(
        "bug_bounty_participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["bug_bounty_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("program_id", "username", name="uq_bug_bounty_participant_program_user"),
    )
    op.create_index("ix_bug_bounty_participants_program_id", "bug_bounty_participants", ["program_id"], unique=False)
    op.create_index("ix_bug_bounty_participants_username", "bug_bounty_participants", ["username"], unique=False)

    op.create_table(
        "bug_bounty_submissions",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("program_id", sa.String(length=80), nullable=False),
        sa.Column("program_title", sa.String(length=120), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("vulnerable_url", sa.String(length=320), nullable=False),
        sa.Column("evidence", sa.String(length=240), nullable=False),
        sa.Column("finding_categories", sa.JSON(), nullable=False),
        sa.Column("severity", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("value_awarded", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["program_id"], ["bug_bounty_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bug_bounty_submissions_program_id", "bug_bounty_submissions", ["program_id"], unique=False)
    op.create_index("ix_bug_bounty_submissions_username", "bug_bounty_submissions", ["username"], unique=False)
    op.create_index("ix_bug_bounty_submissions_severity", "bug_bounty_submissions", ["severity"], unique=False)
    op.create_index("ix_bug_bounty_submissions_created_at", "bug_bounty_submissions", ["created_at"], unique=False)

    op.create_table(
        "bug_bounty_notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=140), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bug_bounty_notifications_username", "bug_bounty_notifications", ["username"], unique=False)
    op.create_index("ix_bug_bounty_notifications_is_read", "bug_bounty_notifications", ["is_read"], unique=False)
    op.create_index("ix_bug_bounty_notifications_created_at", "bug_bounty_notifications", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bug_bounty_notifications_created_at", table_name="bug_bounty_notifications")
    op.drop_index("ix_bug_bounty_notifications_is_read", table_name="bug_bounty_notifications")
    op.drop_index("ix_bug_bounty_notifications_username", table_name="bug_bounty_notifications")
    op.drop_table("bug_bounty_notifications")
    op.drop_index("ix_bug_bounty_submissions_created_at", table_name="bug_bounty_submissions")
    op.drop_index("ix_bug_bounty_submissions_severity", table_name="bug_bounty_submissions")
    op.drop_index("ix_bug_bounty_submissions_username", table_name="bug_bounty_submissions")
    op.drop_index("ix_bug_bounty_submissions_program_id", table_name="bug_bounty_submissions")
    op.drop_table("bug_bounty_submissions")
    op.drop_index("ix_bug_bounty_participants_username", table_name="bug_bounty_participants")
    op.drop_index("ix_bug_bounty_participants_program_id", table_name="bug_bounty_participants")
    op.drop_table("bug_bounty_participants")
    op.drop_index("ix_bug_bounty_programs_created_at", table_name="bug_bounty_programs")
    op.drop_index("ix_bug_bounty_programs_owner_username", table_name="bug_bounty_programs")
    op.drop_index("ix_bug_bounty_programs_status", table_name="bug_bounty_programs")
    op.drop_table("bug_bounty_programs")
