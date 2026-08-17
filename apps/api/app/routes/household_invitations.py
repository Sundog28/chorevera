from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    HTTPException,
    status,
)
from sqlmodel import Session, select

from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.models.household import (
    Household,
    HouseholdMember,
)
from app.models.household_invitation import (
    HouseholdInvitation,
)
from app.models.user import User
from app.schemas.household_invitation import (
    HouseholdInvitationActionResponse,
    HouseholdInvitationCreate,
    HouseholdInvitationDeleteResponse,
    HouseholdInvitationResponse,
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
    prefix="/api/v1/household-invitations",
    tags=["Household Invitations"],
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
            detail="User account has no database ID.",
        )

    return current_user.id


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
                "Inviting household members requires "
                "the Chorevera Family plan."
            ),
        )


def get_user_by_email(
    email: str,
    session: Session,
) -> User | None:
    normalized_email = email.strip().lower()

    return session.exec(
        select(User).where(
            User.email == normalized_email,
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


def get_membership_for_user(
    user_id: int,
    session: Session,
) -> HouseholdMember | None:
    return session.exec(
        select(HouseholdMember).where(
            HouseholdMember.user_id == user_id,
        ),
    ).first()


def get_owner_membership(
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

    if (
        membership is None
        or membership.role != "owner"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the household owner can "
                "manage invitations."
            ),
        )

    return membership


def get_invitation_or_404(
    invitation_id: int,
    session: Session,
) -> HouseholdInvitation:
    invitation = session.get(
        HouseholdInvitation,
        invitation_id,
    )

    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found.",
        )

    return invitation


def require_pending_invitation(
    invitation: HouseholdInvitation,
) -> None:
    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This invitation is no longer pending."
            ),
        )


def build_invitation_response(
    invitation: HouseholdInvitation,
    session: Session,
) -> HouseholdInvitationResponse:
    if invitation.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Invitation has no database ID."
            ),
        )

    household = get_household_or_404(
        invitation.household_id,
        session,
    )

    inviter = session.get(
        User,
        invitation.invited_by_user_id,
    )

    invited_user = session.get(
        User,
        invitation.invited_user_id,
    )

    if inviter is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Inviting user no longer exists.",
        )

    if invited_user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Invited user no longer exists.",
        )

    if invitation.status not in {
        "pending",
        "accepted",
        "declined",
        "cancelled",
    }:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Invitation status is invalid.",
        )

    return HouseholdInvitationResponse(
        id=invitation.id,
        household_id=household.id,
        household_name=household.name,
        invited_by_user_id=inviter.id,
        invited_by_name=inviter.name,
        invited_user_id=invited_user.id,
        invited_name=invited_user.name,
        invited_email=invitation.invited_email,
        status=invitation.status,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
    )


@router.post(
    "",
    response_model=HouseholdInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_household_invitation(
    invitation_data: HouseholdInvitationCreate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdInvitationResponse:
    current_user_id = require_user_id(
        current_user,
    )

    require_family_plan(
        current_user_id,
        session,
    )

    owner_membership = get_membership_for_user(
        current_user_id,
        session,
    )

    if (
        owner_membership is None
        or owner_membership.role != "owner"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Create a household as its owner "
                "before inviting members."
            ),
        )

    household = get_household_or_404(
        owner_membership.household_id,
        session,
    )

    get_owner_membership(
        household.id,
        current_user_id,
        session,
    )

    invited_user = get_user_by_email(
        str(invitation_data.email),
        session,
    )

    if invited_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No Chorevera account exists with "
                "that email address."
            ),
        )

    if invited_user.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Invited user has no database ID."
            ),
        )

    if invited_user.id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot invite yourself.",
        )

    existing_membership = get_membership_for_user(
        invited_user.id,
        session,
    )

    if existing_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "That user already belongs to "
                "a household."
            ),
        )

    existing_invitation = session.exec(
        select(HouseholdInvitation).where(
            HouseholdInvitation.household_id
            == household.id,
            HouseholdInvitation.invited_user_id
            == invited_user.id,
            HouseholdInvitation.status
            == "pending",
        ),
    ).first()

    if existing_invitation is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A pending invitation already exists "
                "for that user."
            ),
        )

    invitation = HouseholdInvitation(
        household_id=household.id,
        invited_by_user_id=current_user_id,
        invited_user_id=invited_user.id,
        invited_email=invited_user.email,
        status="pending",
    )

    session.add(invitation)
    session.flush()

    record_household_activity(
        session,
        household_id=household.id,
        actor_user_id=current_user_id,
        target_user_id=invited_user.id,
        action_type="invitation_sent",
        message=(
            f"{current_user.name} invited "
            f"{invited_user.name} to join "
            f"'{household.name}'."
        ),
    )

    create_notification(
        session,
        user_id=invited_user.id,
        notification_type="household_invitation",
        title="Household invitation",
        message=f"{current_user.name} invited you to join '{household.name}'.",
        related_household_id=household.id,
    )

    session.commit()
    session.refresh(invitation)

    return build_invitation_response(
        invitation,
        session,
    )


@router.get(
    "/sent",
    response_model=list[
        HouseholdInvitationResponse
    ],
)
def get_sent_invitations(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> list[HouseholdInvitationResponse]:
    current_user_id = require_user_id(
        current_user,
    )

    membership = get_membership_for_user(
        current_user_id,
        session,
    )

    if (
        membership is None
        or membership.role != "owner"
    ):
        return []

    invitations = session.exec(
        select(HouseholdInvitation)
        .where(
            HouseholdInvitation.household_id
            == membership.household_id,
        )
        .order_by(
            HouseholdInvitation.created_at.desc(),
        ),
    ).all()

    return [
        build_invitation_response(
            invitation,
            session,
        )
        for invitation in invitations
    ]


@router.get(
    "/mine",
    response_model=list[
        HouseholdInvitationResponse
    ],
)
def get_my_invitations(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> list[HouseholdInvitationResponse]:
    current_user_id = require_user_id(
        current_user,
    )

    invitations = session.exec(
        select(HouseholdInvitation)
        .where(
            HouseholdInvitation.invited_user_id
            == current_user_id,
        )
        .order_by(
            HouseholdInvitation.created_at.desc(),
        ),
    ).all()

    return [
        build_invitation_response(
            invitation,
            session,
        )
        for invitation in invitations
    ]


@router.post(
    "/{invitation_id}/accept",
    response_model=(
        HouseholdInvitationActionResponse
    ),
)
def accept_household_invitation(
    invitation_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdInvitationActionResponse:
    current_user_id = require_user_id(
        current_user,
    )

    invitation = get_invitation_or_404(
        invitation_id,
        session,
    )

    require_pending_invitation(
        invitation,
    )

    if (
        invitation.invited_user_id
        != current_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This invitation belongs to "
                "another user."
            ),
        )

    existing_membership = get_membership_for_user(
        current_user_id,
        session,
    )

    if existing_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "You already belong to a household."
            ),
        )

    household = get_household_or_404(
        invitation.household_id,
        session,
    )

    membership = HouseholdMember(
        household_id=household.id,
        user_id=current_user_id,
        role="member",
    )

    invitation.status = "accepted"
    invitation.responded_at = utc_now()

    session.add(membership)
    session.add(invitation)

    record_household_activity(
        session,
        household_id=household.id,
        actor_user_id=current_user_id,
        target_user_id=current_user_id,
        action_type="member_joined",
        message=(
            f"{current_user.name} joined "
            f"'{household.name}'."
        ),
    )

    if invitation.invited_by_user_id != current_user_id:
        create_notification(
            session,
            user_id=invitation.invited_by_user_id,
            notification_type="invitation_accepted",
            title="Invitation accepted",
            message=f"{current_user.name} joined '{household.name}'.",
            related_household_id=household.id,
        )

    session.commit()
    session.refresh(invitation)

    return HouseholdInvitationActionResponse(
        invitation=build_invitation_response(
            invitation,
            session,
        ),
        joined_household=True,
    )


@router.post(
    "/{invitation_id}/decline",
    response_model=(
        HouseholdInvitationActionResponse
    ),
)
def decline_household_invitation(
    invitation_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdInvitationActionResponse:
    current_user_id = require_user_id(
        current_user,
    )

    invitation = get_invitation_or_404(
        invitation_id,
        session,
    )

    require_pending_invitation(
        invitation,
    )

    if (
        invitation.invited_user_id
        != current_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This invitation belongs to "
                "another user."
            ),
        )

    household = get_household_or_404(
        invitation.household_id,
        session,
    )

    invitation.status = "declined"
    invitation.responded_at = utc_now()

    session.add(invitation)

    record_household_activity(
        session,
        household_id=household.id,
        actor_user_id=current_user_id,
        target_user_id=current_user_id,
        action_type="invitation_declined",
        message=(
            f"{current_user.name} declined the "
            f"invitation to join '{household.name}'."
        ),
    )

    if invitation.invited_by_user_id != current_user_id:
        create_notification(
            session,
            user_id=invitation.invited_by_user_id,
            notification_type="invitation_declined",
            title="Invitation declined",
            message=f"{current_user.name} declined the invitation to '{household.name}'.",
            related_household_id=household.id,
        )

    session.commit()
    session.refresh(invitation)

    return HouseholdInvitationActionResponse(
        invitation=build_invitation_response(
            invitation,
            session,
        ),
        joined_household=False,
    )


@router.delete(
    "/{invitation_id}",
    response_model=(
        HouseholdInvitationDeleteResponse
    ),
)
def cancel_household_invitation(
    invitation_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> HouseholdInvitationDeleteResponse:
    current_user_id = require_user_id(
        current_user,
    )

    invitation = get_invitation_or_404(
        invitation_id,
        session,
    )

    require_pending_invitation(
        invitation,
    )

    get_owner_membership(
        invitation.household_id,
        current_user_id,
        session,
    )

    household = get_household_or_404(
        invitation.household_id,
        session,
    )

    invited_user = session.get(
        User,
        invitation.invited_user_id,
    )

    invitation.status = "cancelled"
    invitation.responded_at = utc_now()

    session.add(invitation)

    invited_name = (
        invited_user.name
        if invited_user is not None
        else invitation.invited_email
    )

    record_household_activity(
        session,
        household_id=household.id,
        actor_user_id=current_user_id,
        target_user_id=invitation.invited_user_id,
        action_type="invitation_cancelled",
        message=(
            f"{current_user.name} cancelled "
            f"{invited_name}'s invitation to join "
            f"'{household.name}'."
        ),
    )

    if invitation.invited_user_id != current_user_id:
        create_notification(
            session,
            user_id=invitation.invited_user_id,
            notification_type="invitation_cancelled",
            title="Invitation cancelled",
            message=f"{current_user.name} cancelled your invitation to '{household.name}'.",
            related_household_id=household.id,
        )

    session.commit()

    return HouseholdInvitationDeleteResponse(
        cancelled=True,
    )

