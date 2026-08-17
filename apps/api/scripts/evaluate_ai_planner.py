from __future__ import annotations

import statistics

from app.schemas.ai_planner import (
    AIPlannerModelOutput,
)
from app.services.ai_planner import (
    PlannerChoreContext,
    PlannerHouseholdContext,
    PlannerMemberContext,
    call_openai_planner,
    validate_model_plan,
)


CASES = [
    "We have guests coming Saturday. Make sure the kitchen, bathrooms, laundry, and living room are handled beforehand and divide the work fairly.",
    "Rebalance the unfinished chores so nobody has way more work than everyone else.",
    "Plan a quick Friday evening reset: trash, dishes, counters, and vacuuming.",
    "Prepare the apartment for inspection tomorrow morning without overloading one person.",
]


def build_context() -> PlannerHouseholdContext:
    return PlannerHouseholdContext(
        household_id=999,
        household_name="Evaluation Household",
        members=[
            PlannerMemberContext(
                user_id=101,
                name="Alex",
                role="owner",
                current_incomplete=3,
                recent_completed=4,
                recent_reopened=0,
            ),
            PlannerMemberContext(
                user_id=102,
                name="Jordan",
                role="member",
                current_incomplete=1,
                recent_completed=2,
                recent_reopened=0,
            ),
            PlannerMemberContext(
                user_id=103,
                name="Taylor",
                role="member",
                current_incomplete=2,
                recent_completed=6,
                recent_reopened=1,
            ),
        ],
        incomplete_chores=[
            PlannerChoreContext(
                chore_id=201,
                title="Wash dishes",
                assigned_user_id=101,
                reminder_time="19:00",
            ),
            PlannerChoreContext(
                chore_id=202,
                title="Vacuum living room",
                assigned_user_id=101,
                reminder_time=None,
            ),
            PlannerChoreContext(
                chore_id=203,
                title="Take out trash",
                assigned_user_id=103,
                reminder_time=None,
            ),
        ],
    )


def workload_gap(values: list[int]) -> int:
    if not values:
        return 0
    return max(values) - min(values)


def main() -> None:
    context = build_context()
    successes = 0
    action_counts: list[int] = []
    workload_gaps: list[int] = []

    print("Chorevera AI Planner evaluation")
    print("================================")

    for index, request_text in enumerate(
        CASES,
        start=1,
    ):
        print(f"\nCase {index}: {request_text}")

        try:
            raw: AIPlannerModelOutput = (
                call_openai_planner(
                    context,
                    request_text,
                    max_actions=8,
                )
            )
            validated = validate_model_plan(
                raw,
                context,
                max_actions=8,
            )
        except Exception as exc:
            print("  FAIL:", type(exc).__name__, str(exc))
            continue

        successes += 1
        action_counts.append(
            len(validated.output.actions),
        )
        gap = workload_gap([
            item.projected_incomplete
            for item in validated.workloads
        ])
        workload_gaps.append(gap)

        print("  PASS")
        print("  actions:", len(validated.output.actions))
        print("  projected workload gap:", gap)
        print("  confidence:", validated.output.confidence)

    total = len(CASES)
    print("\nSummary")
    print("-------")
    print(
        "structured + semantic validity rate:",
        f"{successes}/{total} ({(successes / total) * 100:.0f}%)",
    )

    if action_counts:
        print(
            "average actions:",
            f"{statistics.mean(action_counts):.2f}",
        )

    if workload_gaps:
        print(
            "average projected workload gap:",
            f"{statistics.mean(workload_gaps):.2f}",
        )


if __name__ == "__main__":
    main()
