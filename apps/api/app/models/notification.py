from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AppNotification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    notification_type: str = Field(max_length=50, index=True)
    title: str = Field(max_length=160)
    message: str = Field(max_length=2000)
    related_chore_id: int | None = Field(default=None, index=True)
    related_household_id: int | None = Field(default=None, index=True)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    read_at: datetime | None = Field(default=None)
