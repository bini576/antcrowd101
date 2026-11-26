"""add scheduled_date and status_changed_at to training_requests

Revision ID: 0006_add_scheduled_date
Revises: 0005_training_outcome_metrics
Create Date: 2026-05-13 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0006_add_scheduled_date"
down_revision: Union[str, Sequence[str], None] = "0005_training_outcome_metrics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_requests",
        sa.Column("scheduled_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "training_requests",
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("training_requests", "status_changed_at")
    op.drop_column("training_requests", "scheduled_date")
