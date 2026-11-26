"""add unsubscribe_token and is_active to trust_subscriptions

Revision ID: 0001_add_unsubscribe_token
Revises: None
Create Date: 2026-05-13 18:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_add_unsubscribe_token"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trust_subscriptions",
        sa.Column("unsubscribe_token", sa.String(), nullable=True),
    )
    op.create_unique_constraint(
        "uq_trust_subscriptions_unsubscribe_token",
        "trust_subscriptions",
        ["unsubscribe_token"],
    )
    op.add_column(
        "trust_subscriptions",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("trust_subscriptions", "is_active")
    op.drop_constraint(
        "uq_trust_subscriptions_unsubscribe_token",
        "trust_subscriptions",
        type_="unique",
    )
    op.drop_column("trust_subscriptions", "unsubscribe_token")
