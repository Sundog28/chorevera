from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class HouseholdActivity(SQLModel, table=True):
    __tablename__ = "household_activities"

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    household_id: int = Field(
        foreign_key="households.id",
        index=True,
        ondelete="CASCADE",
    )

    actor_user_id: int | None = Field(
        default=None,
        foreign_key="users.id",
        index=True,
        ondelete="SET NULL",
    )

    target_user_id: int | None = Field(
        default=None,
        foreign_key="users.id",
        index=True,
        ondelete="SET NULL",
    )

    chore_id: int | None = Field(
        default=None,
        foreign_key="chores.id",
        index=True,
        ondelete="SET NULL",
    )

    action_type: str = Field(
        max_length=60,
        index=True,
    )

    message: str = Field(
        max_length=300,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        index=True,
    )