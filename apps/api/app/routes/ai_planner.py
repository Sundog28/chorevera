from __future__ import annotations

from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    HTTPException,
    status,
)
from sqlmodel import select

from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.models.chore import Chore
from app.models.household import (
    Household,
    HouseholdMember,
)
from app.models.user import User
from app.schemas.ai_planner import (
    AIPlannerApplyRequest,
    AIPlannerApplyResponse,
    AIPlannerRequest,
    AIPlannerResponse,
)
from app.services.ai_planner import (
    AIPlannerValidationError,
    build_household_context,
    generate_household_plan,
    validate_model_plan,
)
from app.services.entitlements import (
    get_user_entitlements,
)
from app.services.household_activity import (
    record_household_activity,
)
from app.services.notifications import (
    create_notification,
)


router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AI Planner"],
)


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc,
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


def require_ai_entitlement(
    user_id: int,
    session: SessionDependency,
) -> None:
    entitlements = get_user_entitlements(
        user_id,
        session,
    )

    if not entitlements.ai_planning:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "AI household planning requires the Family plan."
            ),
        )


def require_household_member(
    household_id: int,
    user_id: int,
    session: SessionDependency,
) -> tuple[Household, HouseholdMember]:
    household = session.get(
        Household,
        household_id,
    )

    if household is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found.",
        )

    membership = session.exec(
        select(HouseholdMember).where(
            HouseholdMember.household_id
            == household_id,
            HouseholdMember.user_id
            == user_id,
        ),
    ).first()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You are not a member of this household."
            ),
        )

    return household, membership


def require_household_owner(
    household_id: int,
    user_id: int,
    session: SessionDependency,
) -> Household:
    household, membership = (
        require_household_member(
            household_id,
            user_id,
            session,
        )
    )

    if membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the household owner can apply an AI plan."
            ),
        )

    return household


def get_user_name(
    user_id: int | None,
    session: SessionDependency,
    fallback: str = "A household member",
) -> str:
    if user_id is None:
        return fallback

    user = session.get(
        User,
        user_id,
    )

    if user is None:
        return fallback

    return user.name


@router.post(
    "/household-plan",
    response_model=AIPlannerResponse,
)
def generate_plan(
    request: AIPlannerRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> AIPlannerResponse:
    user_id = require_user_id(
        current_user,
    )

    require_ai_entitlement(
        user_id,
        session,
    )

    household, _ = (
        require_household_member(
            request.household_id,
            user_id,
            session,
        )
    )

    return generate_household_plan(
        household=household,
        request_text=request.request_text,
        max_actions=request.max_actions,
        session=session,
    )


@router.post(
    "/household-plan/apply",
    response_model=AIPlannerApplyResponse,
)
def apply_plan(
    request: AIPlannerApplyRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> AIPlannerApplyResponse:
    user_id = require_user_id(
        current_user,
    )

    require_ai_entitlement(
        user_id,
        session,
    )

    household = require_household_owner(
        request.household_id,
        user_id,
        session,
    )

    context = build_household_context(
        household,
        session,
    )

    from app.schemas.ai_planner import (
        AIPlannerModelOutput,
    )

    try:
        validated = validate_model_plan(
            AIPlannerModelOutput(
                summary="Approved AI plan",
                fairness_notes=(
                    "Owner-approved actions are revalidated before database changes."
                ),
                assumptions=[],
                confidence=100,
                actions=request.actions,
            ),
            context,
            max_actions=len(
                request.actions
            ),
        )
    except AIPlannerValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The household changed after this plan was generated or the plan no longer passes validation. Generate a fresh plan and try again."
            ),
        ) from exc

    actor_name = get_user_name(
        user_id,
        session,
    )

    created_count = 0
    reassigned_count = 0

    for action in (
        validated.output.actions
    ):
        if action.action == "create":
            chore = Chore(
                title=action.title,
                reminder_time=(
                    action.reminder_time
                ),
                completed=False,
                owner_id=user_id,
                household_id=(
                    request.household_id
                ),
                assigned_user_id=(
                    action.assigned_user_id
                ),
            )

            session.add(chore)
            session.flush()

            assignee_name = get_user_name(
                action.assigned_user_id,
                session,
            )

            record_household_activity(
                session,
                household_id=(
                    request.household_id
                ),
                actor_user_id=user_id,
                target_user_id=(
                    action.assigned_user_id
                ),
                chore_id=chore.id,
                action_type="chore_created",
                message=(
                    f"{actor_name} created '{chore.title}' from an approved AI plan and assigned it to {assignee_name}."
                ),
            )

            if (
                action.assigned_user_id
                != user_id
            ):
                create_notification(
                    session,
                    user_id=(
                        action.assigned_user_id
                    ),
                    notification_type=(
                        "chore_assigned"
                    ),
                    title=(
                        "New chore assigned"
                    ),
                    message=(
                        f"{actor_name} assigned '{chore.title}' to you from an approved household plan."
                    ),
                    related_chore_id=(
                        chore.id
                    ),
                    related_household_id=(
                        request.household_id
                    ),
                )

            created_count += 1
            continue

        chore_id = (
            action.existing_chore_id
        )

        if chore_id is None:
            continue

        chore = session.get(
            Chore,
            chore_id,
        )

        if (
            chore is None
            or chore.household_id
            != request.household_id
            or chore.completed
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A chore changed after the plan was generated. Generate a fresh plan and try again."
                ),
            )

        previous_assigned_user_id = (
            chore.assigned_user_id
        )

        if (
            previous_assigned_user_id
            == action.assigned_user_id
        ):
            continue

        chore.assigned_user_id = (
            action.assigned_user_id
        )
        chore.updated_at = utc_now()
        session.add(chore)

        assignee_name = get_user_name(
            action.assigned_user_id,
            session,
        )

        record_household_activity(
            session,
            household_id=(
                request.household_id
            ),
            actor_user_id=user_id,
            target_user_id=(
                action.assigned_user_id
            ),
            chore_id=chore.id,
            action_type="chore_updated",
            message=(
                f"{actor_name} applied an AI plan and reassigned '{chore.title}' to {assignee_name}."
            ),
        )

        if (
            action.assigned_user_id
            != user_id
        ):
            create_notification(
                session,
                user_id=(
                    action.assigned_user_id
                ),
                notification_type=(
                    "chore_reassigned"
                ),
                title="Chore reassigned",
                message=(
                    f"{actor_name} reassigned '{chore.title}' to you from an approved household plan."
                ),
                related_chore_id=chore.id,
                related_household_id=(
                    request.household_id
                ),
            )

        reassigned_count += 1

    session.commit()

    applied_action_count = (
        created_count
        + reassigned_count
    )

    return AIPlannerApplyResponse(
        household_id=(
            request.household_id
        ),
        applied_action_count=(
            applied_action_count
        ),
        created_count=created_count,
        reassigned_count=(
            reassigned_count
        ),
        message=(
            "AI plan applied successfully."
            if applied_action_count > 0
            else "The approved plan required no database changes."
        ),
    )
