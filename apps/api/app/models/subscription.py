from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Subscription(SQLModel, table=True):
    __tablename__ = "subscriptions"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            name="uq_subscriptions_user_id",
        ),
        UniqueConstraint(
            "stripe_customer_id",
            name="uq_subscriptions_stripe_customer_id",
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

    plan_name: str = Field(
        default="free",
        max_length=30,
        index=True,
    )

    subscription_status: str = Field(
        default="inactive",
        max_length=40,
        index=True,
    )

    stripe_customer_id: str | None = Field(
        default=None,
        max_length=255,
        index=True,
    )

    stripe_subscription_id: str | None = Field(
        default=None,
        max_length=255,
        index=True,
    )

    stripe_price_id: str | None = Field(
        default=None,
        max_length=255,
    )

    current_period_end: datetime | None = Field(
        default=None,
    )

    cancel_at_period_end: bool = Field(
        default=False,
    )

    created_at: datetime = Field(
        default_factory=utc_now,
    )

    updated_at: datetime = Field(
        default_factory=utc_now,
    )