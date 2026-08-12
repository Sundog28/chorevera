from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint(
            "email",
            name="uq_users_email",
        ),
    )

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    name: str = Field(
        min_length=1,
        max_length=100,
    )

    email: str = Field(
        index=True,
        max_length=320,
    )

    password_hash: str

    is_active: bool = Field(
        default=True,
    )

    is_email_verified: bool = Field(
        default=False,
    )

    email_verified_at: datetime | None = Field(
        default=None,
    )

    token_version: int = Field(
        default=0,
        ge=0,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )

    updated_at: datetime = Field(
        default_factory=utc_now,
    )
