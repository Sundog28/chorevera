import pytest

from app.schemas.ai_planner import (
    AIPlanAction,
    AIPlannerModelOutput,
)
from app.services.ai_planner import (
    AIPlannerValidationError,
    PlannerChoreContext,
    PlannerHouseholdContext,
    PlannerMemberContext,
    build_fallback_plan,
    validate_model_plan,
)


def sample_context() -> PlannerHouseholdContext:
    return PlannerHouseholdContext(
        household_id=1,
        household_name="Demo Household",
        members=[
            PlannerMemberContext(
                user_id=1,
                name="Alex",
                role="owner",
                current_incomplete=3,
                recent_completed=2,
                recent_reopened=0,
            ),
            PlannerMemberContext(
                user_id=2,
                name="Jordan",
                role="member",
                current_incomplete=1,
                recent_completed=5,
                recent_reopened=0,
            ),
        ],
        incomplete_chores=[
            PlannerChoreContext(
                chore_id=10,
                title="Clean kitchen",
                assigned_user_id=1,
                reminder_time=None,
            ),
            PlannerChoreContext(
                chore_id=11,
                title="Vacuum living room",
                assigned_user_id=1,
                reminder_time=None,
            ),
        ],
    )


def output_with(
    actions: list[AIPlanAction],
) -> AIPlannerModelOutput:
    return AIPlannerModelOutput(
        summary="A balanced plan.",
        fairness_notes="Work is distributed across household members.",
        assumptions=[],
        confidence=90,
        actions=actions,
    )


def test_rejects_unknown_member_id() -> None:
    with pytest.raises(
        AIPlannerValidationError,
    ):
        validate_model_plan(
            output_with([
                AIPlanAction(
                    action="create",
                    title="Take out trash",
                    assigned_user_id=999,
                    priority="medium",
                    rationale="Balance workload.",
                ),
            ]),
            sample_context(),
            8,
        )


def test_rejects_unknown_existing_chore_id() -> None:
    with pytest.raises(
        AIPlannerValidationError,
    ):
        validate_model_plan(
            output_with([
                AIPlanAction(
                    action="reassign",
                    existing_chore_id=999,
                    title="Imaginary chore",
                    assigned_user_id=2,
                    priority="medium",
                    rationale="Balance workload.",
                ),
            ]),
            sample_context(),
            8,
        )


def test_reassignment_uses_canonical_chore_data() -> None:
    validated = validate_model_plan(
        output_with([
            AIPlanAction(
                action="reassign",
                existing_chore_id=10,
                title="Hallucinated title",
                assigned_user_id=2,
                reminder_time="23:59",
                priority="high",
                rationale="Jordan has less current work.",
            ),
        ]),
        sample_context(),
        8,
    )

    action = validated.output.actions[0]
    assert action.title == "Clean kitchen"
    assert action.reminder_time is None
    assert action.assigned_user_id == 2



def test_rejects_create_that_duplicates_existing_chore() -> None:
    with pytest.raises(
        AIPlannerValidationError,
    ):
        validate_model_plan(
            output_with([
                AIPlanAction(
                    action="create",
                    title="  clean KITCHEN  ",
                    assigned_user_id=2,
                    priority="medium",
                    rationale="Do not duplicate existing work.",
                ),
            ]),
            sample_context(),
            8,
        )

def test_fallback_only_rebalances_existing_chores() -> None:
    fallback = build_fallback_plan(
        sample_context(),
        max_actions=8,
        reason="provider unavailable",
    )

    assert all(
        action.action == "reassign"
        for action in fallback.output.actions
    )
    assert all(
        action.existing_chore_id in {10, 11}
        for action in fallback.output.actions
    )
