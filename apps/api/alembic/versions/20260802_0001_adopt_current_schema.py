"""Adopt the current ChoreFlow schema.

Revision ID: 20260802_0001
Revises:
Create Date: 2026-08-02
"""

from alembic import op
from sqlalchemy import inspect
from sqlmodel import SQLModel

from app import models  # noqa: F401


revision = "20260802_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    inspector = inspect(
        bind,
    )

    # Existing ChoreFlow databases already contain
    # the application schema. For a new database,
    # create the current baseline from SQLModel
    # metadata. Future revisions should use normal
    # Alembic operations/autogeneration.
    if (
        "users"
        not in inspector.get_table_names()
    ):
        SQLModel.metadata.create_all(
            bind=bind,
        )


def downgrade() -> None:
    # This is an adoption baseline. Downgrading it
    # must not destroy an existing ChoreFlow database.
    pass
