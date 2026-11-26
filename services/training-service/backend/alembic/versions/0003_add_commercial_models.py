"""add commercial models for pricing, quotes, and invoices

Revision ID: 0003_add_commercial_models
Revises: 0002_add_researcher_assignment
Create Date: 2026-03-18 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_add_commercial_models"
down_revision: Union[str, Sequence[str], None] = "0002_add_researcher_assignment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

quote_status_enum = sa.Enum("draft", "sent", "approved", "rejected", name="quote_status_enum")
invoice_status_enum = sa.Enum("unpaid", "paid", "canceled", name="invoice_status_enum")


def upgrade() -> None:
    op.create_table(
        "training_packages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_type", postgresql.ENUM("basic", "premium", name="package_type_enum", create_type=False), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("base_price_etb", sa.Integer(), nullable=False),
        sa.Column("per_participant_etb", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("package_type"),
    )

    op.create_table(
        "training_quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_type", sa.Text(), nullable=False),
        sa.Column("number_of_participants", sa.Integer(), nullable=False),
        sa.Column("base_price_etb", sa.Integer(), nullable=False),
        sa.Column("per_participant_etb", sa.Integer(), nullable=False),
        sa.Column("total_price_etb", sa.Integer(), nullable=False),
        sa.Column("status", quote_status_enum, nullable=False, server_default=sa.text("'sent'")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["request_id"], ["training_requests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_id"),
    )

    op.create_table(
        "training_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=False),
        sa.Column("amount_etb", sa.Integer(), nullable=False),
        sa.Column("status", invoice_status_enum, nullable=False, server_default=sa.text("'unpaid'")),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["quote_id"], ["training_quotes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quote_id"),
        sa.UniqueConstraint("invoice_number"),
    )

    op.execute(
        """
        INSERT INTO training_packages (id, package_type, display_name, description, duration_days, base_price_etb, per_participant_etb)
        VALUES
            ('00000000-0000-0000-0000-000000000001', 'basic', 'Basic Security Awareness', 'Foundational in-person training on phishing, password hygiene, and incident reporting.', 2, 45000, 1200),
            ('00000000-0000-0000-0000-000000000002', 'premium', 'Premium Role-Based Security Program', 'Advanced in-person training with tabletop simulations and role-specific secure workflow coaching.', 4, 120000, 2200)
        ON CONFLICT (package_type) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("training_invoices")
    op.drop_table("training_quotes")
    op.drop_table("training_packages")

    invoice_status_enum.drop(op.get_bind(), checkfirst=True)
    quote_status_enum.drop(op.get_bind(), checkfirst=True)
