from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notification_type: str
    title: str
    message: str
    related_chore_id: int | None
    related_household_id: int | None
    is_read: bool
    created_at: datetime
    read_at: datetime | None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int


class NotificationActionResponse(BaseModel):
    updated_count: int


class NotificationDeleteResponse(BaseModel):
    deleted_count: int
