from datetime import datetime, timezone

from sqlmodel import Session

from app.models.notification import AppNotification


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_notification(
    session: Session,
    *,
    user_id: int | None,
    notification_type: str,
    title: str,
    message: str,
    related_chore_id: int | None = None,
    related_household_id: int | None = None,
) -> AppNotification | None:
    if user_id is None:
        return None

    notification = AppNotification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_chore_id=related_chore_id,
        related_household_id=related_household_id,
    )
    session.add(notification)
    return notification


def mark_notification_read(notification: AppNotification) -> None:
    if notification.is_read:
        return
    notification.is_read = True
    notification.read_at = utc_now()
