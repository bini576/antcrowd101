"""add trust_center_published to organizations

Revision ID: 0002_add_trust_center_published
Revises: 0001_add_unsubscribe_token
Create Date: 2026-05-23 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_add_trust_center_published"
down_revision: Union[str, Sequence[str], None] = "0001_add_unsubscribe_token"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "
        "trust_center_published BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.drop_column("organizations", "trust_center_published")
