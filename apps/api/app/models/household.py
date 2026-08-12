from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Household(SQLModel, table=True):
    __tablename__ = "households"

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    name: str = Field(
        min_length=1,
        max_length=100,
        index=True,
    )

    owner_id: int = Field(
        foreign_key="users.id",
        index=True,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )

    updated_at: datetime = Field(
        default_factory=utc_now,
    )


class HouseholdMember(SQLModel, table=True):
    __tablename__ = "household_members"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            name="uq_household_members_user_id",
        ),
        UniqueConstraint(
            "household_id",
            "user_id",
            name="uq_household_members_household_user",
        ),
    )

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    household_id: int = Field(
        foreign_key="households.id",
        index=True,
    )

    user_id: int = Field(
        foreign_key="users.id",
        index=True,
    )

    role: str = Field(
        default="member",
        max_length=30,
        index=True,
    )

    joined_at: datetime = Field(
        default_factory=utc_now,
    )