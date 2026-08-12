from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Chore(SQLModel, table=True):
    __tablename__ = "chores"

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    title: str = Field(
        min_length=1,
        max_length=100,
        index=True,
    )

    reminder_time: str | None = Field(
        default=None,
        max_length=5,
    )

    completed: bool = Field(
        default=False,
        index=True,
    )

    # The user who originally created the chore.
    owner_id: int = Field(
        foreign_key="users.id",
        index=True,
        ondelete="CASCADE",
    )

    # Null means this is a personal chore.
    # A value means the chore belongs to a household.
    household_id: int | None = Field(
        default=None,
        foreign_key="households.id",
        index=True,
        ondelete="CASCADE",
    )

    # The household member responsible for completing it.
    # Personal chores are automatically assigned to their owner.
    assigned_user_id: int | None = Field(
        default=None,
        foreign_key="users.id",
        index=True,
        ondelete="SET NULL",
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )

    updated_at: datetime = Field(
        default_factory=utc_now,
    )
