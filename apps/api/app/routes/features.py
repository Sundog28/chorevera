from fastapi import (
    APIRouter,
    HTTPException,
    status,
)

from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.schemas.features import (
    FeatureAccessResponse,
)
from app.services.entitlements import (
    get_user_entitlements,
)


router = APIRouter(
    prefix="/api/v1/features",
    tags=["Features"],
)


@router.get(
    "",
    response_model=FeatureAccessResponse,
)
def get_feature_access(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> FeatureAccessResponse:
    if current_user.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="User account has no database ID.",
        )

    entitlements = get_user_entitlements(
        current_user.id,
        session,
    )

    return FeatureAccessResponse(
        plan_name=entitlements.plan_name,
        max_chores=entitlements.max_chores,
        unlimited_chores=(
            entitlements.max_chores is None
        ),
        advanced_reminders=(
            entitlements.advanced_reminders
        ),
        analytics=entitlements.analytics,
        household_sharing=(
            entitlements.household_sharing
        ),
        ai_planning=entitlements.ai_planning,
    )