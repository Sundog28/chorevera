from sqlmodel import Session

from app.models.household_activity import (
    HouseholdActivity,
)


def record_household_activity(
    session: Session,
    *,
    household_id: int,
    actor_user_id: int | None,
    action_type: str,
    message: str,
    target_user_id: int | None = None,
    chore_id: int | None = None,
) -> HouseholdActivity:
    activity = HouseholdActivity(
        household_id=household_id,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        chore_id=chore_id,
        action_type=action_type,
        message=message,
    )

    session.add(activity)

    return activity