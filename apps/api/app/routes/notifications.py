from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import func, select

from app.dependencies import CurrentUserDependency, SessionDependency
from app.models.notification import AppNotification
from app.schemas.notification import (
    NotificationActionResponse,
    NotificationDeleteResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.notifications import mark_notification_read


router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


def require_user_id(current_user: CurrentUserDependency) -> int:
    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User account has no database ID.",
        )
    return current_user.id


def get_user_notification_or_404(
    notification_id: int,
    user_id: int,
    session: SessionDependency,
) -> AppNotification:
    notification = session.exec(
        select(AppNotification).where(
            AppNotification.id == notification_id,
            AppNotification.user_id == user_id,
        )
    ).first()
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return notification


def count_unread(user_id: int, session: SessionDependency) -> int:
    return int(
        session.exec(
            select(func.count(AppNotification.id)).where(
                AppNotification.user_id == user_id,
                AppNotification.is_read.is_(False),
            )
        ).one()
    )


@router.get("", response_model=NotificationListResponse)
def get_notifications(
    current_user: CurrentUserDependency,
    session: SessionDependency,
    limit: int = Query(default=50, ge=1, le=200),
    unread_only: bool = Query(default=False),
) -> NotificationListResponse:
    user_id = require_user_id(current_user)
    statement = select(AppNotification).where(AppNotification.user_id == user_id)
    if unread_only:
        statement = statement.where(AppNotification.is_read.is_(False))
    statement = statement.order_by(
        AppNotification.created_at.desc(),
        AppNotification.id.desc(),
    ).limit(limit)
    return NotificationListResponse(
        items=list(session.exec(statement).all()),
        unread_count=count_unread(user_id, session),
    )


@router.patch("/read-all", response_model=NotificationActionResponse)
def mark_all_notifications_read(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> NotificationActionResponse:
    user_id = require_user_id(current_user)
    notifications = list(
        session.exec(
            select(AppNotification).where(
                AppNotification.user_id == user_id,
                AppNotification.is_read.is_(False),
            )
        ).all()
    )
    for notification in notifications:
        mark_notification_read(notification)
        session.add(notification)
    session.commit()
    return NotificationActionResponse(updated_count=len(notifications))


@router.delete("/clear-read", response_model=NotificationDeleteResponse)
def clear_read_notifications(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> NotificationDeleteResponse:
    user_id = require_user_id(current_user)
    notifications = list(
        session.exec(
            select(AppNotification).where(
                AppNotification.user_id == user_id,
                AppNotification.is_read.is_(True),
            )
        ).all()
    )
    for notification in notifications:
        session.delete(notification)
    session.commit()
    return NotificationDeleteResponse(deleted_count=len(notifications))


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_one_notification_read(
    notification_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> NotificationResponse:
    user_id = require_user_id(current_user)
    notification = get_user_notification_or_404(notification_id, user_id, session)
    mark_notification_read(notification)
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return NotificationResponse.model_validate(notification)


@router.delete("/{notification_id}", response_model=NotificationDeleteResponse)
def delete_notification(
    notification_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> NotificationDeleteResponse:
    user_id = require_user_id(current_user)
    notification = get_user_notification_or_404(notification_id, user_id, session)
    session.delete(notification)
    session.commit()
    return NotificationDeleteResponse(deleted_count=1)
