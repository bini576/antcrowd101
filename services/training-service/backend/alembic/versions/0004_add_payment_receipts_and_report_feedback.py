"""add payment receipt verification and organization report feedback

Revision ID: 0004_payment_receipts_feedback
Revises: 0003_add_commercial_models
Create Date: 2026-03-18 00:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0004_payment_receipts_feedback"
down_revision: Union[str, Sequence[str], None] = "0003_add_commercial_models"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

payment_verification_status_enum = sa.Enum(
    "none", "pending", "verified", "rejected", name="payment_verification_status_enum"
)


def upgrade() -> None:
    payment_verification_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "training_invoices",
        sa.Column(
            "payment_verification_status",
            payment_verification_status_enum,
            nullable=False,
            server_default="none",
        ),
    )
    op.add_column("training_invoices", sa.Column("receipt_reference", sa.String(length=500), nullable=True))
    op.add_column("training_invoices", sa.Column("receipt_note", sa.Text(), nullable=True))
    op.add_column("training_invoices", sa.Column("receipt_uploaded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("training_invoices", sa.Column("payment_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("training_invoices", sa.Column("payment_verification_note", sa.Text(), nullable=True))

    op.add_column("training_reports", sa.Column("organization_rating", sa.Integer(), nullable=True))
    op.add_column("training_reports", sa.Column("organization_feedback", sa.Text(), nullable=True))
    op.add_column("training_reports", sa.Column("organization_feedback_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("training_reports", "organization_feedback_at")
    op.drop_column("training_reports", "organization_feedback")
    op.drop_column("training_reports", "organization_rating")

    op.drop_column("training_invoices", "payment_verification_note")
    op.drop_column("training_invoices", "payment_verified_at")
    op.drop_column("training_invoices", "receipt_uploaded_at")
    op.drop_column("training_invoices", "receipt_note")
    op.drop_column("training_invoices", "receipt_reference")
    op.drop_column("training_invoices", "payment_verification_status")

    payment_verification_status_enum.drop(op.get_bind(), checkfirst=True)
