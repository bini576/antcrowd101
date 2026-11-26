"""add training outcome metrics to reports

Revision ID: 0005_training_outcome_metrics
Revises: 0004_payment_receipts_feedback
Create Date: 2026-03-22 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0005_training_outcome_metrics"
down_revision: Union[str, Sequence[str], None] = "0004_payment_receipts_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_reports",
        sa.Column("pre_assessment_score", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "training_reports",
        sa.Column("post_assessment_score", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "training_reports",
        sa.Column("attendance_rate", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_check_constraint(
        "ck_pre_assessment_score_range",
        "training_reports",
        "pre_assessment_score BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_post_assessment_score_range",
        "training_reports",
        "post_assessment_score BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "ck_attendance_rate_range",
        "training_reports",
        "attendance_rate BETWEEN 0 AND 100",
    )


def downgrade() -> None:
    op.drop_constraint("ck_attendance_rate_range", "training_reports", type_="check")
    op.drop_constraint("ck_post_assessment_score_range", "training_reports", type_="check")
    op.drop_constraint("ck_pre_assessment_score_range", "training_reports", type_="check")

    op.drop_column("training_reports", "attendance_rate")
    op.drop_column("training_reports", "post_assessment_score")
    op.drop_column("training_reports", "pre_assessment_score")
