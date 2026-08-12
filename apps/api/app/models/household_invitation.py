from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_invitation_token() -> str:
    return uuid4().hex


class HouseholdInvitation(
    SQLModel,
    table=True,
):
    __tablename__ = "household_invitations"

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    household_id: int = Field(
        foreign_key="households.id",
        index=True,
    )

    invited_by_user_id: int = Field(
        foreign_key="users.id",
        index=True,
    )

    invited_user_id: int = Field(
        foreign_key="users.id",
        index=True,
    )

    invited_email: str = Field(
        max_length=320,
        index=True,
    )

    token: str = Field(
        default_factory=create_invitation_token,
        max_length=64,
        index=True,
        unique=True,
    )

    status: str = Field(
        default="pending",
        max_length=30,
        index=True,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )

    responded_at: datetime | None = Field(
        default=None,
    )