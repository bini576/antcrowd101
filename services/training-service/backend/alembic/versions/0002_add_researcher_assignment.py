"""add researcher assignment to training requests

Revision ID: 0002_add_researcher_assignment
Revises: 0001_initial_schema
Create Date: 2026-02-23 00:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002_add_researcher_assignment"
down_revision: Union[str, Sequence[str], None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_requests",
        sa.Column("researcher_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_training_requests_researcher_id",
        "training_requests",
        "trainers",
        ["researcher_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_training_requests_researcher_id", "training_requests", type_="foreignkey")
    op.drop_column("training_requests", "researcher_id")
