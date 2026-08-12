from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuthToken(SQLModel, table=True):
    __tablename__ = "auth_tokens"

    __table_args__ = (
        UniqueConstraint(
            "token_hash",
            name="uq_auth_tokens_token_hash",
        ),
    )

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    user_id: int = Field(
        foreign_key="users.id",
        index=True,
    )

    purpose: str = Field(
        index=True,
        max_length=32,
    )

    token_hash: str = Field(
        index=True,
        max_length=64,
    )

    expires_at: datetime

    used_at: datetime | None = Field(
        default=None,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )
