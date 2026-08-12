from datetime import date, datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DailyProgress(SQLModel, table=True):
    __tablename__ = "daily_progress"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "progress_date",
            name=(
                "uq_daily_progress_"
                "user_date"
            ),
        ),
    )

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    user_id: int = Field(
        foreign_key="users.id",
        index=True,
        ondelete="CASCADE",
    )

    progress_date: date = Field(
        index=True,
    )

    total_count: int = Field(
        default=0,
        ge=0,
    )

    completed_count: int = Field(
        default=0,
        ge=0,
    )

    all_completed: bool = Field(
        default=False,
        index=True,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )

    updated_at: datetime = Field(
        default_factory=utc_now,
    )
