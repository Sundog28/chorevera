from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    status,
)
from sqlmodel import select

from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.models.household import (
    HouseholdMember,
)
from app.models.household_activity import (
    HouseholdActivity,
)
from app.models.user import User
from app.schemas.household_activity import (
    HouseholdActivityResponse,
)


router = APIRouter(
    prefix="/api/v1/household-activities",
    tags=["Household Activities"],
)


def require_user_id(
    current_user: CurrentUserDependency,
) -> int:
    if current_user.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "User account has no database ID."
            ),
        )

    return current_user.id


def get_membership_or_404(
    user_id: int,
    session: SessionDependency,
) -> HouseholdMember:
    membership = session.exec(
        select(HouseholdMember).where(
            HouseholdMember.user_id
            == user_id,
        ),
    ).first()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "You do not currently belong "
                "to a household."
            ),
        )

    return membership


def build_activity_response(
    activity: HouseholdActivity,
    session: SessionDependency,
) -> HouseholdActivityResponse:
    if activity.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Activity has no database ID."
            ),
        )

    actor = None

    if activity.actor_user_id is not None:
        actor = session.get(
            User,
            activity.actor_user_id,
        )

    target_user = None

    if activity.target_user_id is not None:
        target_user = session.get(
            User,
            activity.target_user_id,
        )

    return HouseholdActivityResponse(
        id=activity.id,
        household_id=activity.household_id,
        actor_user_id=activity.actor_user_id,
        actor_name=(
            actor.name
            if actor is not None
            else None
        ),
        target_user_id=activity.target_user_id,
        target_user_name=(
            target_user.name
            if target_user is not None
            else None
        ),
        chore_id=activity.chore_id,
        action_type=activity.action_type,
        message=activity.message,
        created_at=activity.created_at,
    )


@router.get(
    "",
    response_model=list[
        HouseholdActivityResponse
    ],
)
def get_household_activities(
    current_user: CurrentUserDependency,
    session: SessionDependency,
    limit: int = Query(
        default=30,
        ge=1,
        le=100,
    ),
) -> list[HouseholdActivityResponse]:
    user_id = require_user_id(
        current_user,
    )

    membership = get_membership_or_404(
        user_id,
        session,
    )

    statement = (
        select(HouseholdActivity)
        .where(
            HouseholdActivity.household_id
            == membership.household_id,
        )
        .order_by(
            HouseholdActivity.created_at.desc(),
            HouseholdActivity.id.desc(),
        )
        .limit(limit)
    )

    activities = session.exec(
        statement,
    ).all()

    return [
        build_activity_response(
            activity,
            session,
        )
        for activity in activities
    ]