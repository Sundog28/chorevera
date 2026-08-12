from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SecurityAuditLog(SQLModel, table=True):
    __tablename__ = "security_audit_logs"

    id: int | None = Field(
        default=None,
        primary_key=True,
    )

    user_id: int | None = Field(
        default=None,
        foreign_key="users.id",
        index=True,
        ondelete="SET NULL",
    )

    event_type: str = Field(
        max_length=64,
        index=True,
    )

    success: bool = Field(
        default=True,
        index=True,
    )

    identifier_hash: str | None = Field(
        default=None,
        max_length=64,
        index=True,
    )

    client_ip: str = Field(
        default="unknown",
        max_length=64,
        index=True,
    )

    user_agent: str = Field(
        default="",
        max_length=255,
    )

    request_id: str = Field(
        default="",
        max_length=64,
        index=True,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        index=True,
    )
