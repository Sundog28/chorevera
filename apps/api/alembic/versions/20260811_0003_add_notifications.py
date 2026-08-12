"""Add persistent notification center.

Revision ID: 20260811_0003
Revises: 20260802_0002
Create Date: 2026-08-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20260811_0003"
down_revision = "20260802_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "notifications" in inspect(op.get_bind()).get_table_names():
        return

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.String(length=2000), nullable=False),
        sa.Column("related_chore_id", sa.Integer(), nullable=True),
        sa.Column("related_household_id", sa.Integer(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_notification_type", "notifications", ["notification_type"])
    op.create_index("ix_notifications_related_chore_id", "notifications", ["related_chore_id"])
    op.create_index("ix_notifications_related_household_id", "notifications", ["related_household_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index(
        "ix_notifications_user_read_created",
        "notifications",
        ["user_id", "is_read", "created_at"],
    )


def downgrade() -> None:
    if "notifications" not in inspect(op.get_bind()).get_table_names():
        return
    op.drop_index("ix_notifications_user_read_created", table_name="notifications")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_index("ix_notifications_related_household_id", table_name="notifications")
    op.drop_index("ix_notifications_related_chore_id", table_name="notifications")
    op.drop_index("ix_notifications_notification_type", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
