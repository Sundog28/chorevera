from dataclasses import dataclass
from typing import Literal

from sqlmodel import Session, select

from app.models.subscription import Subscription


PlanName = Literal[
    "free",
    "pro",
    "family",
]


@dataclass(frozen=True)
class PlanEntitlements:
    plan_name: PlanName
    max_chores: int | None
    advanced_reminders: bool
    analytics: bool
    household_sharing: bool
    ai_planning: bool


PLAN_ENTITLEMENTS: dict[
    PlanName,
    PlanEntitlements,
] = {
    "free": PlanEntitlements(
        plan_name="free",
        max_chores=5,
        advanced_reminders=False,
        analytics=False,
        household_sharing=False,
        ai_planning=False,
    ),
    "pro": PlanEntitlements(
        plan_name="pro",
        max_chores=None,
        advanced_reminders=True,
        analytics=True,
        household_sharing=False,
        ai_planning=False,
    ),
    "family": PlanEntitlements(
        plan_name="family",
        max_chores=None,
        advanced_reminders=True,
        analytics=True,
        household_sharing=True,
        ai_planning=False,
    ),
}


ACTIVE_SUBSCRIPTION_STATUSES = {
    "active",
    "trialing",
}


def get_effective_plan(
    user_id: int,
    session: Session,
) -> PlanName:
    subscription = session.exec(
        select(Subscription).where(
            Subscription.user_id == user_id,
        ),
    ).first()

    if subscription is None:
        return "free"

    if (
        subscription.subscription_status
        not in ACTIVE_SUBSCRIPTION_STATUSES
    ):
        return "free"

    if subscription.plan_name == "pro":
        return "pro"

    if subscription.plan_name == "family":
        return "family"

    return "free"


def get_user_entitlements(
    user_id: int,
    session: Session,
) -> PlanEntitlements:
    plan_name = get_effective_plan(
        user_id,
        session,
    )

    return PLAN_ENTITLEMENTS[plan_name]