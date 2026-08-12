"""Add security audit logs.

Revision ID: 20260812_0004
Revises: 20260811_0003
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260812_0004"
down_revision = "20260811_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())

    if "security_audit_logs" in inspector.get_table_names():
        return

    op.create_table(
        "security_audit_logs",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "event_type",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "success",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "identifier_hash",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "client_ip",
            sa.String(length=64),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column(
            "user_agent",
            sa.String(length=255),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "request_id",
            sa.String(length=64),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    for index_name, columns in [
        ("ix_security_audit_logs_user_id", ["user_id"]),
        ("ix_security_audit_logs_event_type", ["event_type"]),
        ("ix_security_audit_logs_success", ["success"]),
        ("ix_security_audit_logs_identifier_hash", ["identifier_hash"]),
        ("ix_security_audit_logs_client_ip", ["client_ip"]),
        ("ix_security_audit_logs_request_id", ["request_id"]),
        ("ix_security_audit_logs_created_at", ["created_at"]),
    ]:
        op.create_index(
            index_name,
            "security_audit_logs",
            columns,
        )

    op.create_index(
        "ix_security_audit_event_created",
        "security_audit_logs",
        ["event_type", "created_at"],
    )


def downgrade() -> None:
    inspector = inspect(op.get_bind())

    if "security_audit_logs" not in inspector.get_table_names():
        return

    op.drop_index(
        "ix_security_audit_event_created",
        table_name="security_audit_logs",
    )

    for index_name in [
        "ix_security_audit_logs_created_at",
        "ix_security_audit_logs_request_id",
        "ix_security_audit_logs_client_ip",
        "ix_security_audit_logs_identifier_hash",
        "ix_security_audit_logs_success",
        "ix_security_audit_logs_event_type",
        "ix_security_audit_logs_user_id",
    ]:
        op.drop_index(
            index_name,
            table_name="security_audit_logs",
        )

    op.drop_table("security_audit_logs")
