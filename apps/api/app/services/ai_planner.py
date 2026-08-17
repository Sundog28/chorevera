from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, ValidationError
from sqlmodel import Session, select

from app.config import settings
from app.models.chore import Chore
from app.models.household import (
    Household,
    HouseholdMember,
)
from app.models.household_activity import (
    HouseholdActivity,
)
from app.models.user import User
from app.schemas.ai_planner import (
    AIPlanAction,
    AIPlannerModelOutput,
    AIPlannerResponse,
    AIPlannerWorkload,
)


logger = logging.getLogger(
    __name__,
)


class AIPlannerUnavailableError(
    RuntimeError,
):
    pass


class AIPlannerValidationError(
    ValueError,
):
    pass


class PlannerMemberContext(BaseModel):
    user_id: int
    name: str
    role: str
    current_incomplete: int
    recent_completed: int
    recent_reopened: int


class PlannerChoreContext(BaseModel):
    chore_id: int
    title: str
    assigned_user_id: int | None
    reminder_time: str | None


class PlannerHouseholdContext(BaseModel):
    household_id: int
    household_name: str
    members: list[PlannerMemberContext]
    incomplete_chores: list[PlannerChoreContext]


@dataclass(frozen=True)
class ValidatedPlan:
    output: AIPlannerModelOutput
    workloads: list[AIPlannerWorkload]


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc,
    )


def build_household_context(
    household: Household,
    session: Session,
) -> PlannerHouseholdContext:
    if household.id is None:
        raise AIPlannerValidationError(
            "Household has no database ID.",
        )

    memberships = list(
        session.exec(
            select(HouseholdMember).where(
                HouseholdMember.household_id
                == household.id,
            ),
        ).all(),
    )

    if not memberships:
        raise AIPlannerValidationError(
            "Household has no members.",
        )

    users_by_id: dict[int, User] = {}

    for membership in memberships:
        user = session.get(
            User,
            membership.user_id,
        )

        if user is not None:
            users_by_id[
                membership.user_id
            ] = user

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

    current_incomplete: dict[
        int,
        int,
    ] = {
        membership.user_id: 0
        for membership in memberships
    }

    for chore in incomplete_chores:
        if (
            chore.assigned_user_id
            in current_incomplete
        ):
            current_incomplete[
                chore.assigned_user_id
            ] += 1

    cutoff = utc_now() - timedelta(
        days=(
            settings.ai_planner_history_days
        ),
    )

    recent_activities = list(
        session.exec(
            select(HouseholdActivity).where(
                HouseholdActivity.household_id
                == household.id,
                HouseholdActivity.created_at
                >= cutoff,
                HouseholdActivity.action_type.in_(
                    [
                        "chore_completed",
                        "chore_reopened",
                    ],
                ),
            ),
        ).all(),
    )

    recent_completed: dict[int, int] = {
        membership.user_id: 0
        for membership in memberships
    }

    recent_reopened: dict[int, int] = {
        membership.user_id: 0
        for membership in memberships
    }

    for activity in recent_activities:
        target_user_id = (
            activity.target_user_id
        )

        if target_user_id not in (
            recent_completed
        ):
            continue

        if (
            activity.action_type
            == "chore_completed"
        ):
            recent_completed[
                target_user_id
            ] += 1

        elif (
            activity.action_type
            == "chore_reopened"
        ):
            recent_reopened[
                target_user_id
            ] += 1

    member_contexts: list[
        PlannerMemberContext
    ] = []

    for membership in memberships:
        user = users_by_id.get(
            membership.user_id,
        )

        if user is None:
            continue

        member_contexts.append(
            PlannerMemberContext(
                user_id=membership.user_id,
                name=user.name,
                role=membership.role,
                current_incomplete=(
                    current_incomplete[
                        membership.user_id
                    ]
                ),
                recent_completed=(
                    recent_completed[
                        membership.user_id
                    ]
                ),
                recent_reopened=(
                    recent_reopened[
                        membership.user_id
                    ]
                ),
            ),
        )

    if not member_contexts:
        raise AIPlannerValidationError(
            "Household has no active members.",
        )

    return PlannerHouseholdContext(
        household_id=household.id,
        household_name=household.name,
        members=member_contexts,
        incomplete_chores=[
            PlannerChoreContext(
                chore_id=chore.id,
                title=chore.title,
                assigned_user_id=(
                    chore.assigned_user_id
                ),
                reminder_time=(
                    chore.reminder_time
                ),
            )
            for chore in incomplete_chores
            if chore.id is not None
        ],
    )


def build_planner_prompt(
    context: PlannerHouseholdContext,
    request_text: str,
    max_actions: int,
) -> list[dict[str, str]]:
    context_json = json.dumps(
        context.model_dump(),
        ensure_ascii=False,
        separators=(
            ",",
            ":",
        ),
    )

    system_prompt = (
        "You are a household planning engine. "
        "Create a practical, fair plan from the user's request and the supplied household context. "
        "Return only data matching the requested structured schema. "
        "Use only user_id values present in context.members. "
        "For a reassign action, use only chore_id values present in context.incomplete_chores. "
        "Never delete chores and never modify completed chores. "
        "Prefer reassigning an existing matching chore instead of creating a duplicate. "
        "Create new chores only when needed to satisfy the request. "
        "Balance projected incomplete workload while considering recent completed work. "
        "Do not infer sensitive traits or make assignments based on gender, age, health, race, religion, or other protected characteristics. "
        "Keep rationale concise and operational. "
        "Use reminder_time only when the user clearly requests timing; format it as HH:MM in 24-hour local time, otherwise null. "
        f"Return at most {max_actions} actions."
    )

    user_prompt = (
        "Household context JSON:\n"
        f"{context_json}\n\n"
        "Planning request:\n"
        f"{request_text}"
    )

    return [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": user_prompt,
        },
    ]


def call_openai_planner(
    context: PlannerHouseholdContext,
    request_text: str,
    max_actions: int,
) -> AIPlannerModelOutput:
    if not settings.openai_api_key:
        raise AIPlannerUnavailableError(
            "OPENAI_API_KEY is not configured.",
        )

    client = OpenAI(
        api_key=settings.openai_api_key,
        timeout=(
            settings.openai_timeout_seconds
        ),
        max_retries=1,
    )

    response = client.responses.parse(
        model=settings.openai_model,
        input=build_planner_prompt(
            context,
            request_text,
            max_actions,
        ),
        text_format=AIPlannerModelOutput,
    )

    parsed = response.output_parsed

    if parsed is None:
        raise AIPlannerUnavailableError(
            "The model returned no structured plan.",
        )

    return parsed


def validate_model_plan(
    output: AIPlannerModelOutput,
    context: PlannerHouseholdContext,
    max_actions: int,
) -> ValidatedPlan:
    member_ids = {
        member.user_id
        for member in context.members
    }

    chores_by_id = {
        chore.chore_id: chore
        for chore in context.incomplete_chores
    }

    seen_existing_chore_ids: set[int] = set()
    seen_create_titles: set[str] = set()
    existing_title_keys = {
        chore.title.strip().casefold()
        for chore in context.incomplete_chores
    }
    validated_actions: list[
        AIPlanAction
    ] = []

    for action in output.actions[
        :max_actions
    ]:
        if (
            action.assigned_user_id
            not in member_ids
        ):
            raise AIPlannerValidationError(
                "AI plan referenced a user outside the household.",
            )

        if action.action == "reassign":
            chore_id = (
                action.existing_chore_id
            )

            if (
                chore_id is None
                or chore_id not in chores_by_id
            ):
                raise AIPlannerValidationError(
                    "AI plan referenced a chore outside the current incomplete household chores.",
                )

            if (
                chore_id
                in seen_existing_chore_ids
            ):
                raise AIPlannerValidationError(
                    "AI plan attempted to modify the same chore more than once.",
                )

            seen_existing_chore_ids.add(
                chore_id,
            )

            existing = chores_by_id[
                chore_id
            ]

            validated_actions.append(
                AIPlanAction(
                    action="reassign",
                    existing_chore_id=(
                        chore_id
                    ),
                    title=existing.title,
                    assigned_user_id=(
                        action.assigned_user_id
                    ),
                    reminder_time=(
                        existing.reminder_time
                    ),
                    priority=action.priority,
                    rationale=(
                        action.rationale
                    ),
                ),
            )

            continue

        normalized_title_key = (
            action.title.strip().casefold()
        )

        if (
            normalized_title_key
            in seen_create_titles
        ):
            raise AIPlannerValidationError(
                "AI plan created duplicate chore titles.",
            )

        if (
            normalized_title_key
            in existing_title_keys
        ):
            raise AIPlannerValidationError(
                "AI plan attempted to create a chore that already exists in the current household workload.",
            )

        seen_create_titles.add(
            normalized_title_key,
        )

        validated_actions.append(
            action,
        )

    validated_output = (
        AIPlannerModelOutput(
            summary=output.summary,
            fairness_notes=(
                output.fairness_notes
            ),
            assumptions=(
                output.assumptions
            ),
            confidence=output.confidence,
            actions=validated_actions,
        )
    )

    workloads = project_workloads(
        context,
        validated_actions,
    )

    return ValidatedPlan(
        output=validated_output,
        workloads=workloads,
    )


def project_workloads(
    context: PlannerHouseholdContext,
    actions: list[AIPlanAction],
) -> list[AIPlannerWorkload]:
    member_by_id = {
        member.user_id: member
        for member in context.members
    }

    projected = {
        member.user_id:
        member.current_incomplete
        for member in context.members
    }

    current_assignment = {
        chore.chore_id:
        chore.assigned_user_id
        for chore in context.incomplete_chores
    }

    for action in actions:
        if action.action == "create":
            projected[
                action.assigned_user_id
            ] += 1
            continue

        chore_id = action.existing_chore_id

        if chore_id is None:
            continue

        previous_user_id = (
            current_assignment.get(
                chore_id,
            )
        )

        if (
            previous_user_id
            in projected
            and previous_user_id
            != action.assigned_user_id
        ):
            projected[
                previous_user_id
            ] = max(
                0,
                projected[
                    previous_user_id
                ] - 1,
            )

        if (
            previous_user_id
            != action.assigned_user_id
        ):
            projected[
                action.assigned_user_id
            ] += 1

        current_assignment[
            chore_id
        ] = action.assigned_user_id

    return [
        AIPlannerWorkload(
            user_id=member.user_id,
            name=member.name,
            current_incomplete=(
                member.current_incomplete
            ),
            projected_incomplete=(
                projected[
                    member.user_id
                ]
            ),
            recent_completed=(
                member.recent_completed
            ),
        )
        for member in context.members
    ]


def build_fallback_plan(
    context: PlannerHouseholdContext,
    max_actions: int,
    reason: str,
) -> ValidatedPlan:
    members = sorted(
        context.members,
        key=lambda member: (
            member.current_incomplete,
            member.recent_completed,
            member.user_id,
        ),
    )

    if not members:
        raise AIPlannerValidationError(
            "Household has no members.",
        )

    projected = {
        member.user_id: 0
        for member in members
    }

    actions: list[AIPlanAction] = []

    for chore in (
        context.incomplete_chores
    ):
        selected = min(
            members,
            key=lambda member: (
                projected[
                    member.user_id
                ],
                member.recent_completed,
                member.user_id,
            ),
        )

        projected[
            selected.user_id
        ] += 1

        if (
            chore.assigned_user_id
            == selected.user_id
        ):
            continue

        if len(actions) >= max_actions:
            break

        actions.append(
            AIPlanAction(
                action="reassign",
                existing_chore_id=(
                    chore.chore_id
                ),
                title=chore.title,
                assigned_user_id=(
                    selected.user_id
                ),
                reminder_time=(
                    chore.reminder_time
                ),
                priority="medium",
                rationale=(
                    "Fallback balancing reduces the difference in current incomplete chores."
                ),
            ),
        )

    if actions:
        summary = (
            "The AI provider was unavailable, so a safe workload-balancing fallback was generated for existing incomplete chores."
        )
    else:
        summary = (
            "The AI provider was unavailable. No safe automatic fallback actions were needed or available; your existing chores were left unchanged."
        )

    output = AIPlannerModelOutput(
        summary=summary,
        fairness_notes=(
            "Fallback mode only rebalances existing incomplete chores and never creates new chores from the natural-language request."
        ),
        assumptions=[
            "The requested AI plan could not be generated, so only existing incomplete chores were considered for safe fallback balancing."
        ],
        confidence=50,
        actions=actions,
    )

    return ValidatedPlan(
        output=output,
        workloads=project_workloads(
            context,
            actions,
        ),
    )


def generate_household_plan(
    household: Household,
    request_text: str,
    max_actions: int,
    session: Session,
) -> AIPlannerResponse:
    context = build_household_context(
        household,
        session,
    )

    provider = "openai"
    model: str | None = (
        settings.openai_model
    )
    fallback_reason: str | None = None

    try:
        raw_output = call_openai_planner(
            context,
            request_text,
            max_actions,
        )

        validated = validate_model_plan(
            raw_output,
            context,
            max_actions,
        )

    except (
        AIPlannerUnavailableError,
        AIPlannerValidationError,
        OpenAIError,
        ValidationError,
    ) as exc:
        provider = "fallback"
        model = None
        fallback_reason = (
            "The AI planning provider was unavailable or returned a plan that did not pass server validation."
        )

        logger.warning(
            "AI planner fallback household_id=%s reason=%s",
            household.id,
            type(exc).__name__,
        )

        validated = build_fallback_plan(
            context,
            max_actions,
            fallback_reason,
        )

    logger.info(
        "AI planner generated household_id=%s provider=%s actions=%s members=%s existing_chores=%s",
        household.id,
        provider,
        len(validated.output.actions),
        len(context.members),
        len(context.incomplete_chores),
    )

    return AIPlannerResponse(
        household_id=(
            context.household_id
        ),
        provider=provider,
        model=model,
        fallback_reason=(
            fallback_reason
        ),
        summary=validated.output.summary,
        fairness_notes=(
            validated.output.fairness_notes
        ),
        assumptions=(
            validated.output.assumptions
        ),
        confidence=(
            validated.output.confidence
        ),
        actions=(
            validated.output.actions
        ),
        workloads=validated.workloads,
        generated_at=utc_now(),
    )
