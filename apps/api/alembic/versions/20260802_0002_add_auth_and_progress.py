"""Add authentication fields and synced daily progress.

Revision ID: 20260802_0002
Revises: 20260802_0001
Create Date: 2026-08-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260802_0002"
down_revision = "20260802_0001"
branch_labels = None
depends_on = None


def table_names() -> set[str]:
    return set(
        inspect(
            op.get_bind(),
        ).get_table_names(),
    )


def column_names(
    table_name: str,
) -> set[str]:
    return {
        column["name"]
        for column in inspect(
            op.get_bind(),
        ).get_columns(
            table_name,
        )
    }


def upgrade() -> None:
    tables = table_names()

    if "users" in tables:
        user_columns = column_names(
            "users",
        )

        if (
            "is_email_verified"
            not in user_columns
        ):
            op.add_column(
                "users",
                sa.Column(
                    "is_email_verified",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.true(),
                ),
            )

        if (
            "email_verified_at"
            not in user_columns
        ):
            op.add_column(
                "users",
                sa.Column(
                    "email_verified_at",
                    sa.DateTime(
                        timezone=True,
                    ),
                    nullable=True,
                ),
            )

        if (
            "token_version"
            not in user_columns
        ):
            op.add_column(
                "users",
                sa.Column(
                    "token_version",
                    sa.Integer(),
                    nullable=False,
                    server_default="0",
                ),
            )

        op.execute(
            sa.text(
                "UPDATE users "
                "SET is_email_verified = TRUE "
                "WHERE is_email_verified IS NULL"
            ),
        )

        op.execute(
            sa.text(
                "UPDATE users "
                "SET token_version = 0 "
                "WHERE token_version IS NULL"
            ),
        )

        op.execute(
            sa.text(
                "UPDATE users "
                "SET email_verified_at = "
                "COALESCE("
                "email_verified_at, created_at"
                ") "
                "WHERE is_email_verified = TRUE"
            ),
        )

    tables = table_names()

    if "auth_tokens" not in tables:
        op.create_table(
            "auth_tokens",
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
                    ondelete="CASCADE",
                ),
                nullable=False,
            ),
            sa.Column(
                "purpose",
                sa.String(
                    length=32,
                ),
                nullable=False,
            ),
            sa.Column(
                "token_hash",
                sa.String(
                    length=64,
                ),
                nullable=False,
            ),
            sa.Column(
                "expires_at",
                sa.DateTime(
                    timezone=True,
                ),
                nullable=False,
            ),
            sa.Column(
                "used_at",
                sa.DateTime(
                    timezone=True,
                ),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(
                    timezone=True,
                ),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "token_hash",
                name=(
                    "uq_auth_tokens_"
                    "token_hash"
                ),
            ),
        )

        op.create_index(
            "ix_auth_tokens_user_id",
            "auth_tokens",
            ["user_id"],
        )

        op.create_index(
            "ix_auth_tokens_purpose",
            "auth_tokens",
            ["purpose"],
        )

        op.create_index(
            "ix_auth_tokens_token_hash",
            "auth_tokens",
            ["token_hash"],
        )

    tables = table_names()

    if "daily_progress" not in tables:
        op.create_table(
            "daily_progress",
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
                    ondelete="CASCADE",
                ),
                nullable=False,
            ),
            sa.Column(
                "progress_date",
                sa.Date(),
                nullable=False,
            ),
            sa.Column(
                "total_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "completed_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "all_completed",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(
                    timezone=True,
                ),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(
                    timezone=True,
                ),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "user_id",
                "progress_date",
                name=(
                    "uq_daily_progress_"
                    "user_date"
                ),
            ),
        )

        op.create_index(
            "ix_daily_progress_user_id",
            "daily_progress",
            ["user_id"],
        )

        op.create_index(
            "ix_daily_progress_progress_date",
            "daily_progress",
            ["progress_date"],
        )

        op.create_index(
            "ix_daily_progress_all_completed",
            "daily_progress",
            ["all_completed"],
        )


def downgrade() -> None:
    tables = table_names()

    if "daily_progress" in tables:
        op.drop_index(
            "ix_daily_progress_all_completed",
            table_name="daily_progress",
        )

        op.drop_index(
            "ix_daily_progress_progress_date",
            table_name="daily_progress",
        )

        op.drop_index(
            "ix_daily_progress_user_id",
            table_name="daily_progress",
        )

        op.drop_table(
            "daily_progress",
        )

    # Authentication columns/tables may have existed
    # before this Alembic adoption. Leave them intact.
