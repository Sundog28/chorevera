from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    HTTPException,
    status,
)
from sqlmodel import Session, func, select

from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.models.household import (
    Household,
    HouseholdMember,
)
from app.models.user import User
from app.schemas.household import (
    HouseholdCreate,
    HouseholdDeleteResponse,
    HouseholdDetailResponse,
    HouseholdMemberResponse,
    HouseholdSummaryResponse,
    HouseholdUpdate,
)
from app.services.entitlements import (
    get_user_entitlements,
)
from app.services.household_activity import (
    record_household_activity,
)


router = APIRouter(
    prefix="/api/v1/households",
    tags=["Households"],
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


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


def get_user_name(
    user_id: int | None,
    session: Session,
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


def require_family_plan(
    user_id: int,
    session: Session,
) -> None:
    entitlements = get_user_entitlements(
        user_id,
        session,
    )

    if not entitlements.household_sharing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Household sharing requires "
                "the ChoreFlow Family plan."
            ),
        )


def get_membership_for_user(
    user_id: int,
    session: Session,
) -> HouseholdMember | None:
    return session.exec(
        select(HouseholdMember).where(
            HouseholdMember.user_id
            == user_id,
        ),
    ).first()


def get_household_or_404(
    household_id: int,
    session: Session,
) -> Household:
    household = session.get(
        Household,
        household_id,
    )

    if household is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found.",
        )

    return household


def get_membership_or_403(
    household_id: int,
    user_id: int,
    session: Session,
) -> HouseholdMember:
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
                "You are not a member of "
                "this household."
            ),
        )

    return membership


def require_owner(
    household_id: int,
    user_id: int,
    session: Session,
) -> HouseholdMember:
    membership = get_membership_or_403(
        household_id,
        user_id,
        session,
    )

    if membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the household owner "
                "can perform this action."
            ),
        )

    return membership


def get_member_count(
    household_id: int,
    session: Session,
) -> int:
    count = session.exec(
        select(
            func.count(
                HouseholdMember.id,
            ),
        ).where(
            HouseholdMember.household_id
            == household_id,
        ),
    ).one()

    return int(count)


def build_household_summary(
    household: Household,
    membership: HouseholdMember,
    session: Session,
) -> HouseholdSummaryResponse:
    if household.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Household has no database ID."
            ),
        )

    if membership.role not in {
        "owner",
        "member",
    }:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Household role is invalid.",
        )

    return HouseholdSummaryResponse(
        id=household.id,
        name=household.name,
        owner_id=household.owner_id,
        current_user_role=membership.role,
        member_count=get_member_count(
            household.id,
            session,
        ),
        created_at=household.created_at,
        updated_at=household.updated_at,
    )


def build_member_response(
    membership: HouseholdMember,
    user: User,
) -> HouseholdMemberResponse:
    if membership.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Membership has no database ID."
            ),
        )

    if user.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Member has no database ID."
            ),
        )

    if membership.role not in {
        "owner",
        "member",
    }:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Household role is invalid.",
        )

    return HouseholdMemberResponse(
        membership_id=membership.id,
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=membership.role,
        joined_at=membership.joined_at,
    )


def get_household_members(
    household_id: int,
    session: Session,
) -> list[HouseholdMemberResponse]:
    rows = session.exec(
        select(
            HouseholdMember,
            User,
        )
        .join(
            User,
            User.id
            == HouseholdMember.user_id,
        )
        .where(
            HouseholdMember.household_id
            == household_id,
        )
        .order_by(
            HouseholdMember.joined_at.asc(),
        ),
    ).all()

    return [
        build_member_response(
            membership,
            user,
        )
        for membership, user in rows
    ]


@router.post(
    "",
    response_model=HouseholdDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_household(
    household_data: HouseholdCreate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdDetailResponse:
    user_id = require_user_id(
        current_user,
    )

    require_family_plan(
        user_id,
        session,
    )

    existing_membership = (
        get_membership_for_user(
            user_id,
            session,
        )
    )

    if existing_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "You already belong to "
                "a household."
            ),
        )

    household_name = (
        household_data.name.strip()
    )

    household = Household(
        name=household_name,
        owner_id=user_id,
    )

    session.add(household)

    # Assign the household ID without
    # committing the transaction.
    session.flush()

    if household.id is None:
        session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Household creation failed."
            ),
        )

    membership = HouseholdMember(
        household_id=household.id,
        user_id=user_id,
        role="owner",
    )

    session.add(membership)
    session.flush()

    actor_name = get_user_name(
        user_id,
        session,
    )

    record_household_activity(
        session,
        household_id=household.id,
        actor_user_id=user_id,
        target_user_id=user_id,
        action_type="household_created",
        message=(
            f"{actor_name} created "
            f"'{household.name}'."
        ),
    )

    session.commit()
    session.refresh(household)
    session.refresh(membership)

    summary = build_household_summary(
        household,
        membership,
        session,
    )

    return HouseholdDetailResponse(
        **summary.model_dump(),
        members=get_household_members(
            household.id,
            session,
        ),
    )


@router.get(
    "/mine",
    response_model=HouseholdDetailResponse | None,
)
def get_my_household(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdDetailResponse | None:
    user_id = require_user_id(
        current_user,
    )

    membership = get_membership_for_user(
        user_id,
        session,
    )

    if membership is None:
        return None

    household = get_household_or_404(
        membership.household_id,
        session,
    )

    summary = build_household_summary(
        household,
        membership,
        session,
    )

    return HouseholdDetailResponse(
        **summary.model_dump(),
        members=get_household_members(
            household.id,
            session,
        ),
    )


@router.get(
    "/{household_id}",
    response_model=HouseholdDetailResponse,
)
def get_household(
    household_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdDetailResponse:
    user_id = require_user_id(
        current_user,
    )

    membership = get_membership_or_403(
        household_id,
        user_id,
        session,
    )

    household = get_household_or_404(
        household_id,
        session,
    )

    summary = build_household_summary(
        household,
        membership,
        session,
    )

    return HouseholdDetailResponse(
        **summary.model_dump(),
        members=get_household_members(
            household_id,
            session,
        ),
    )


@router.patch(
    "/{household_id}",
    response_model=HouseholdDetailResponse,
)
def update_household(
    household_id: int,
    household_data: HouseholdUpdate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdDetailResponse:
    user_id = require_user_id(
        current_user,
    )

    membership = require_owner(
        household_id,
        user_id,
        session,
    )

    household = get_household_or_404(
        household_id,
        session,
    )

    previous_name = household.name
    new_name = household_data.name.strip()

    household.name = new_name
    household.updated_at = utc_now()

    session.add(household)

    if previous_name != new_name:
        actor_name = get_user_name(
            user_id,
            session,
        )

        record_household_activity(
            session,
            household_id=household_id,
            actor_user_id=user_id,
            action_type="household_renamed",
            message=(
                f"{actor_name} renamed "
                f"'{previous_name}' to "
                f"'{new_name}'."
            ),
        )

    session.commit()
    session.refresh(household)

    summary = build_household_summary(
        household,
        membership,
        session,
    )

    return HouseholdDetailResponse(
        **summary.model_dump(),
        members=get_household_members(
            household_id,
            session,
        ),
    )


@router.delete(
    "/{household_id}",
    response_model=HouseholdDeleteResponse,
)
def delete_household(
    household_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdDeleteResponse:
    user_id = require_user_id(
        current_user,
    )

    require_owner(
        household_id,
        user_id,
        session,
    )

    household = get_household_or_404(
        household_id,
        session,
    )

    memberships = session.exec(
        select(HouseholdMember).where(
            HouseholdMember.household_id
            == household_id,
        ),
    ).all()

    for membership in memberships:
        session.delete(membership)

    # Activity rows belonging to this household
    # are removed by the household foreign-key
    # cascade when supported by the database.
    session.delete(household)
    session.commit()

    return HouseholdDeleteResponse(
        deleted=True,
    )


@router.post(
    "/{household_id}/leave",
    response_model=HouseholdDeleteResponse,
)
def leave_household(
    household_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdDeleteResponse:
    user_id = require_user_id(
        current_user,
    )

    membership = get_membership_or_403(
        household_id,
        user_id,
        session,
    )

    if membership.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The household owner cannot leave. "
                "Delete the household or transfer "
                "ownership first."
            ),
        )

    household = get_household_or_404(
        household_id,
        session,
    )

    actor_name = get_user_name(
        user_id,
        session,
    )

    record_household_activity(
        session,
        household_id=household_id,
        actor_user_id=user_id,
        target_user_id=user_id,
        action_type="member_left",
        message=(
            f"{actor_name} left "
            f"'{household.name}'."
        ),
    )

    session.delete(membership)
    session.commit()

    return HouseholdDeleteResponse(
        deleted=True,
    )