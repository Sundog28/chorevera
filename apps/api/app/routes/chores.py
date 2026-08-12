from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    Response,
    status,
)
from sqlalchemy import or_
from sqlmodel import func, select

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
from app.schemas.chore import (
    ChoreAutoAssignment,
    ChoreAutoAssignRequest,
    ChoreAutoAssignResponse,
    ChoreCreate,
    ChoreResponse,
    ChoreUpdate,
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
    prefix="/api/v1/chores",
    tags=["Chores"],
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


def get_household_or_404(
    household_id: int,
    session: SessionDependency,
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


def get_household_membership(
    household_id: int,
    user_id: int,
    session: SessionDependency,
) -> HouseholdMember | None:
    return session.exec(
        select(HouseholdMember).where(
            HouseholdMember.household_id
            == household_id,
            HouseholdMember.user_id
            == user_id,
        ),
    ).first()


def require_household_member(
    household_id: int,
    user_id: int,
    session: SessionDependency,
) -> Household:
    household = get_household_or_404(
        household_id,
        session,
    )

    # The owner is always treated as a household
    # member, even if no membership row exists.
    if household.owner_id == user_id:
        return household

    membership = get_household_membership(
        household_id,
        user_id,
        session,
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You are not a member of "
                "this household."
            ),
        )

    return household


def require_household_owner(
    household_id: int,
    user_id: int,
    session: SessionDependency,
) -> Household:
    household = get_household_or_404(
        household_id,
        session,
    )

    if household.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the household owner can "
                "perform this action."
            ),
        )

    return household


def require_valid_assignee(
    household_id: int,
    assigned_user_id: int,
    session: SessionDependency,
) -> None:
    household = get_household_or_404(
        household_id,
        session,
    )

    if household.owner_id == assigned_user_id:
        return

    membership = get_household_membership(
        household_id,
        assigned_user_id,
        session,
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The assigned user is not a member "
                "of this household."
            ),
        )


def get_accessible_chore_or_404(
    chore_id: int,
    user_id: int,
    session: SessionDependency,
) -> Chore:
    chore = session.get(
        Chore,
        chore_id,
    )

    if chore is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chore not found.",
        )

    # Personal chores are accessible only
    # by their owner.
    if chore.household_id is None:
        if chore.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chore not found.",
            )

        return chore

    # Household chores are accessible to
    # every household member.
    require_household_member(
        chore.household_id,
        user_id,
        session,
    )

    return chore


def require_chore_editor(
    chore: Chore,
    user_id: int,
    session: SessionDependency,
) -> None:
    # Personal chores may only be edited
    # by their owner.
    if chore.household_id is None:
        if chore.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You cannot edit this chore."
                ),
            )

        return

    # Household chore details and assignments
    # are controlled by the household owner.
    require_household_owner(
        chore.household_id,
        user_id,
        session,
    )


def require_chore_completion_permission(
    chore: Chore,
    user_id: int,
    session: SessionDependency,
) -> None:
    if chore.household_id is None:
        if chore.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You cannot complete this chore."
                ),
            )

        return

    household = require_household_member(
        chore.household_id,
        user_id,
        session,
    )

    # Household owners can toggle any chore.
    if household.owner_id == user_id:
        return

    # Members can toggle only chores
    # assigned to them.
    if chore.assigned_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You can only complete chores "
                "assigned to you."
            ),
        )


def enforce_chore_limit(
    owner_id: int,
    session: SessionDependency,
) -> None:
    entitlements = get_user_entitlements(
        owner_id,
        session,
    )

    if entitlements.max_chores is None:
        return

    chore_count = session.exec(
        select(func.count(Chore.id)).where(
            Chore.owner_id == owner_id,
        ),
    ).one()

    if chore_count >= entitlements.max_chores:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your Free plan allows a maximum "
                f"of {entitlements.max_chores} chores. "
                "Upgrade to Pro or Family to create "
                "unlimited chores."
            ),
        )


def require_household_feature(
    user_id: int,
    session: SessionDependency,
) -> None:
    entitlements = get_user_entitlements(
        user_id,
        session,
    )

    if not entitlements.household_sharing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Household chores require the "
                "ChoreFlow Family plan."
            ),
        )


def get_household_member_user_ids(
    household: Household,
    session: SessionDependency,
) -> list[int]:
    member_user_ids = list(
        session.exec(
            select(
                HouseholdMember.user_id,
            ).where(
                HouseholdMember.household_id
                == household.id,
            ),
        ).all(),
    )

    unique_user_ids = {
        household.owner_id,
        *member_user_ids,
    }

    return sorted(unique_user_ids)


def build_fair_assignments(
    household: Household,
    mode: str,
    session: SessionDependency,
) -> list[ChoreAutoAssignment]:
    if household.id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Household has no database ID."
            ),
        )

    member_user_ids = (
        get_household_member_user_ids(
            household,
            session,
        )
    )

    if not member_user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This household has no members "
                "available for assignment."
            ),
        )

    incomplete_chores = list(
        session.exec(
            select(Chore).where(
                Chore.household_id
                == household.id,
                Chore.completed.is_(False),
            ).order_by(
                Chore.created_at.asc(),
                Chore.id.asc(),
            ),
        ).all(),
    )

    if mode == "unassigned_only":
        eligible_chores = [
            chore
            for chore in incomplete_chores
            if chore.assigned_user_id is None
        ]

        eligible_ids = {
            chore.id
            for chore in eligible_chores
            if chore.id is not None
        }

        workload = {
            user_id: 0
            for user_id in member_user_ids
        }

        for chore in incomplete_chores:
            if (
                chore.id in eligible_ids
                or chore.assigned_user_id
                not in workload
            ):
                continue

            workload[
                chore.assigned_user_id
            ] += 1

    elif mode == "rebalance_incomplete":
        eligible_chores = incomplete_chores

        workload = {
            user_id: 0
            for user_id in member_user_ids
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported auto-assignment mode."
            ),
        )

    member_names = {
        user_id: get_user_name(
            user_id,
            session,
        )
        for user_id in member_user_ids
    }

    assignments: list[ChoreAutoAssignment] = []

    for chore in eligible_chores:
        if chore.id is None:
            continue

        assigned_user_id = min(
            member_user_ids,
            key=lambda candidate_id: (
                workload[candidate_id],
                candidate_id,
            ),
        )

        workload[
            assigned_user_id
        ] += 1

        assignments.append(
            ChoreAutoAssignment(
                chore_id=chore.id,
                chore_title=chore.title,
                previous_assigned_user_id=(
                    chore.assigned_user_id
                ),
                assigned_user_id=(
                    assigned_user_id
                ),
                assigned_user_name=(
                    member_names[
                        assigned_user_id
                    ]
                ),
                changed=(
                    chore.assigned_user_id
                    != assigned_user_id
                ),
            ),
        )

    return assignments


@router.post(
    "/auto-assign/preview",
    response_model=ChoreAutoAssignResponse,
)
def preview_auto_assign_chores(
    request: ChoreAutoAssignRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ChoreAutoAssignResponse:
    user_id = require_user_id(
        current_user,
    )

    require_household_feature(
        user_id,
        session,
    )

    household = require_household_owner(
        request.household_id,
        user_id,
        session,
    )

    assignments = build_fair_assignments(
        household,
        request.mode,
        session,
    )

    return ChoreAutoAssignResponse(
        household_id=request.household_id,
        mode=request.mode,
        applied=False,
        eligible_chore_count=len(
            assignments,
        ),
        changed_chore_count=sum(
            assignment.changed
            for assignment in assignments
        ),
        assignments=assignments,
    )


@router.post(
    "/auto-assign",
    response_model=ChoreAutoAssignResponse,
)
def auto_assign_chores(
    request: ChoreAutoAssignRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ChoreAutoAssignResponse:
    user_id = require_user_id(
        current_user,
    )

    require_household_feature(
        user_id,
        session,
    )

    household = require_household_owner(
        request.household_id,
        user_id,
        session,
    )

    assignments = build_fair_assignments(
        household,
        request.mode,
        session,
    )

    actor_name = get_user_name(
        user_id,
        session,
    )

    changed_count = 0

    for assignment in assignments:
        if not assignment.changed:
            continue

        chore = session.get(
            Chore,
            assignment.chore_id,
        )

        if chore is None:
            continue

        chore.assigned_user_id = (
            assignment.assigned_user_id
        )
        chore.updated_at = utc_now()

        session.add(chore)

        record_household_activity(
            session,
            household_id=(
                request.household_id
            ),
            actor_user_id=user_id,
            target_user_id=(
                assignment.assigned_user_id
            ),
            chore_id=chore.id,
            action_type=(
                "chore_auto_assigned"
            ),
            message=(
                f"{actor_name} automatically "
                f"assigned '{chore.title}' to "
                f"{assignment.assigned_user_name}."
            ),
        )

        if assignment.assigned_user_id != user_id:
            create_notification(
                session,
                user_id=assignment.assigned_user_id,
                notification_type="chore_assigned",
                title="New chore assigned",
                message=f"{actor_name} assigned '{chore.title}' to you.",
                related_chore_id=chore.id,
                related_household_id=request.household_id,
            )

        changed_count += 1

    session.commit()

    return ChoreAutoAssignResponse(
        household_id=request.household_id,
        mode=request.mode,
        applied=True,
        eligible_chore_count=len(
            assignments,
        ),
        changed_chore_count=(
            changed_count
        ),
        assignments=assignments,
    )


@router.post(
    "",
    response_model=ChoreResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_chore(
    chore_data: ChoreCreate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> Chore:
    user_id = require_user_id(
        current_user,
    )

    enforce_chore_limit(
        user_id,
        session,
    )

    # Personal chore
    if chore_data.household_id is None:
        if (
            chore_data.assigned_user_id is not None
            and chore_data.assigned_user_id != user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Personal chores can only be "
                    "assigned to their owner."
                ),
            )

        chore = Chore(
            title=chore_data.title,
            reminder_time=(
                chore_data.reminder_time
            ),
            completed=False,
            owner_id=user_id,
            household_id=None,
            assigned_user_id=user_id,
        )

    # Household chore
    else:
        require_household_feature(
            user_id,
            session,
        )

        household = require_household_member(
            chore_data.household_id,
            user_id,
            session,
        )

        assigned_user_id = (
            chore_data.assigned_user_id
            if chore_data.assigned_user_id
            is not None
            else user_id
        )

        require_valid_assignee(
            chore_data.household_id,
            assigned_user_id,
            session,
        )

        # Members can create chores for
        # themselves. Only the owner may
        # assign chores to other people.
        if (
            household.owner_id != user_id
            and assigned_user_id != user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only the household owner can "
                    "assign chores to another member."
                ),
            )

        chore = Chore(
            title=chore_data.title,
            reminder_time=(
                chore_data.reminder_time
            ),
            completed=False,
            owner_id=user_id,
            household_id=(
                chore_data.household_id
            ),
            assigned_user_id=(
                assigned_user_id
            ),
        )

    session.add(chore)

    # Flush assigns the database ID without
    # committing the transaction yet.
    session.flush()

    if (
        chore.household_id is not None
        and chore.id is not None
    ):
        actor_name = get_user_name(
            user_id,
            session,
        )

        assignee_name = get_user_name(
            chore.assigned_user_id,
            session,
        )

        record_household_activity(
            session,
            household_id=chore.household_id,
            actor_user_id=user_id,
            target_user_id=(
                chore.assigned_user_id
            ),
            chore_id=chore.id,
            action_type="chore_created",
            message=(
                f"{actor_name} created "
                f"'{chore.title}' and assigned it "
                f"to {assignee_name}."
            ),
        )

        if chore.assigned_user_id is not None and chore.assigned_user_id != user_id:
            create_notification(
                session,
                user_id=chore.assigned_user_id,
                notification_type="chore_assigned",
                title="New chore assigned",
                message=f"{actor_name} assigned '{chore.title}' to you.",
                related_chore_id=chore.id,
                related_household_id=chore.household_id,
            )

    session.commit()
    session.refresh(chore)

    return chore


@router.get(
    "",
    response_model=list[ChoreResponse],
)
def get_my_chores(
    current_user: CurrentUserDependency,
    session: SessionDependency,
    scope: str = Query(
        default="all",
        pattern=(
            "^(all|mine|personal|household)$"
        ),
    ),
    household_id: int | None = Query(
        default=None,
        ge=1,
    ),
    assigned_user_id: int | None = Query(
        default=None,
        ge=1,
    ),
) -> list[Chore]:
    user_id = require_user_id(
        current_user,
    )

    membership_household_ids = list(
        session.exec(
            select(
                HouseholdMember.household_id,
            ).where(
                HouseholdMember.user_id
                == user_id,
            ),
        ).all(),
    )

    owned_household_ids = list(
        session.exec(
            select(Household.id).where(
                Household.owner_id == user_id,
            ),
        ).all(),
    )

    accessible_household_ids = list(
        set(
            membership_household_ids
            + owned_household_ids
        ),
    )

    access_conditions = [
        Chore.owner_id == user_id,
    ]

    if accessible_household_ids:
        access_conditions.append(
            Chore.household_id.in_(
                accessible_household_ids,
            ),
        )

    statement = select(Chore).where(
        or_(*access_conditions),
    )

    if scope == "mine":
        statement = statement.where(
            Chore.assigned_user_id == user_id,
        )

    elif scope == "personal":
        statement = statement.where(
            Chore.household_id.is_(None),
            Chore.owner_id == user_id,
        )

    elif scope == "household":
        statement = statement.where(
            Chore.household_id.is_not(None),
        )

    if household_id is not None:
        if (
            household_id
            not in accessible_household_ids
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You are not a member of "
                    "this household."
                ),
            )

        statement = statement.where(
            Chore.household_id
            == household_id,
        )

    if assigned_user_id is not None:
        statement = statement.where(
            Chore.assigned_user_id
            == assigned_user_id,
        )

    statement = statement.order_by(
        Chore.created_at.desc(),
    )

    return list(
        session.exec(statement).all(),
    )


@router.get(
    "/{chore_id}",
    response_model=ChoreResponse,
)
def get_chore(
    chore_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> Chore:
    user_id = require_user_id(
        current_user,
    )

    return get_accessible_chore_or_404(
        chore_id=chore_id,
        user_id=user_id,
        session=session,
    )


@router.patch(
    "/{chore_id}",
    response_model=ChoreResponse,
)
def update_chore(
    chore_id: int,
    chore_data: ChoreUpdate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> Chore:
    user_id = require_user_id(
        current_user,
    )

    chore = get_accessible_chore_or_404(
        chore_id=chore_id,
        user_id=user_id,
        session=session,
    )

    require_chore_editor(
        chore,
        user_id,
        session,
    )

    previous_title = chore.title
    previous_assigned_user_id = (
        chore.assigned_user_id
    )

    update_data = chore_data.model_dump(
        exclude_unset=True,
    )

    if "assigned_user_id" in update_data:
        new_assigned_user_id = update_data[
            "assigned_user_id"
        ]

        if chore.household_id is None:
            if (
                new_assigned_user_id is not None
                and new_assigned_user_id
                != chore.owner_id
            ):
                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "Personal chores can only "
                        "be assigned to their owner."
                    ),
                )

            update_data[
                "assigned_user_id"
            ] = chore.owner_id

        else:
            if new_assigned_user_id is None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail=(
                        "Household chores must be "
                        "assigned to a member."
                    ),
                )

            require_valid_assignee(
                chore.household_id,
                new_assigned_user_id,
                session,
            )

    for field_name, value in update_data.items():
        setattr(
            chore,
            field_name,
            value,
        )

    chore.updated_at = utc_now()

    session.add(chore)

    if (
        chore.household_id is not None
        and chore.id is not None
    ):
        actor_name = get_user_name(
            user_id,
            session,
        )

        assignment_changed = (
            previous_assigned_user_id
            != chore.assigned_user_id
        )

        title_changed = (
            previous_title != chore.title
        )

        if assignment_changed:
            assignee_name = get_user_name(
                chore.assigned_user_id,
                session,
            )

            action_type = "chore_reassigned"
            message = (
                f"{actor_name} reassigned "
                f"'{chore.title}' to "
                f"{assignee_name}."
            )

        elif title_changed:
            action_type = "chore_renamed"
            message = (
                f"{actor_name} renamed "
                f"'{previous_title}' to "
                f"'{chore.title}'."
            )

        else:
            action_type = "chore_updated"
            message = (
                f"{actor_name} updated "
                f"'{chore.title}'."
            )

        record_household_activity(
            session,
            household_id=chore.household_id,
            actor_user_id=user_id,
            target_user_id=(
                chore.assigned_user_id
            ),
            chore_id=chore.id,
            action_type=action_type,
            message=message,
        )

        if (
            assignment_changed
            and chore.assigned_user_id is not None
            and chore.assigned_user_id != user_id
        ):
            create_notification(
                session,
                user_id=chore.assigned_user_id,
                notification_type="chore_reassigned",
                title="Chore reassigned",
                message=f"{actor_name} reassigned '{chore.title}' to you.",
                related_chore_id=chore.id,
                related_household_id=chore.household_id,
            )

    session.commit()
    session.refresh(chore)

    return chore


@router.patch(
    "/{chore_id}/toggle",
    response_model=ChoreResponse,
)
def toggle_chore_completion(
    chore_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> Chore:
    user_id = require_user_id(
        current_user,
    )

    chore = get_accessible_chore_or_404(
        chore_id=chore_id,
        user_id=user_id,
        session=session,
    )

    require_chore_completion_permission(
        chore,
        user_id,
        session,
    )

    chore.completed = not chore.completed
    chore.updated_at = utc_now()

    session.add(chore)

    if (
        chore.household_id is not None
        and chore.id is not None
    ):
        actor_name = get_user_name(
            user_id,
            session,
        )

        if chore.completed:
            action_type = "chore_completed"
            message = (
                f"{actor_name} completed "
                f"'{chore.title}'."
            )
        else:
            action_type = "chore_reopened"
            message = (
                f"{actor_name} reopened "
                f"'{chore.title}'."
            )

        record_household_activity(
            session,
            household_id=chore.household_id,
            actor_user_id=user_id,
            target_user_id=(
                chore.assigned_user_id
            ),
            chore_id=chore.id,
            action_type=action_type,
            message=message,
        )

        household = get_household_or_404(chore.household_id, session)
        recipient_user_ids = {household.owner_id}
        if chore.assigned_user_id is not None:
            recipient_user_ids.add(chore.assigned_user_id)
        recipient_user_ids.discard(user_id)

        for recipient_user_id in recipient_user_ids:
            create_notification(
                session,
                user_id=recipient_user_id,
                notification_type=action_type,
                title="Chore completed" if chore.completed else "Chore reopened",
                message=message,
                related_chore_id=chore.id,
                related_household_id=chore.household_id,
            )

    session.commit()
    session.refresh(chore)

    return chore


@router.delete(
    "/{chore_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_chore(
    chore_id: int,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> Response:
    user_id = require_user_id(
        current_user,
    )

    chore = get_accessible_chore_or_404(
        chore_id=chore_id,
        user_id=user_id,
        session=session,
    )

    require_chore_editor(
        chore,
        user_id,
        session,
    )

    household_id = chore.household_id
    assigned_user_id = chore.assigned_user_id
    chore_title = chore.title

    if household_id is not None:
        actor_name = get_user_name(
            user_id,
            session,
        )

        record_household_activity(
            session,
            household_id=household_id,
            actor_user_id=user_id,
            target_user_id=assigned_user_id,

            # The chore is about to be deleted,
            # so the activity does not retain
            # a foreign key to it.
            chore_id=None,

            action_type="chore_deleted",
            message=(
                f"{actor_name} deleted "
                f"'{chore_title}'."
            ),
        )

        if assigned_user_id is not None and assigned_user_id != user_id:
            create_notification(
                session,
                user_id=assigned_user_id,
                notification_type="chore_deleted",
                title="Chore removed",
                message=f"{actor_name} removed '{chore_title}'.",
                related_household_id=household_id,
            )

    session.delete(chore)
    session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
