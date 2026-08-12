from datetime import date, datetime, timedelta, timezone

from sqlmodel import Session, select

from app.models.daily_progress import (
    DailyProgress,
)
from app.schemas.progress import (
    ProgressHistoryResponse,
    ProgressSnapshotUpsert,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def upsert_progress_snapshot(
    session: Session,
    user_id: int,
    snapshot: ProgressSnapshotUpsert,
) -> DailyProgress:
    progress = session.exec(
        select(
            DailyProgress,
        ).where(
            DailyProgress.user_id
            == user_id,
            DailyProgress.progress_date
            == snapshot.progress_date,
        ),
    ).first()

    all_completed = (
        snapshot.total_count > 0
        and snapshot.completed_count
        == snapshot.total_count
    )

    if progress is None:
        progress = DailyProgress(
            user_id=user_id,
            progress_date=(
                snapshot.progress_date
            ),
            total_count=(
                snapshot.total_count
            ),
            completed_count=(
                snapshot.completed_count
            ),
            all_completed=all_completed,
        )
    else:
        progress.total_count = (
            snapshot.total_count
        )

        progress.completed_count = (
            snapshot.completed_count
        )

        progress.all_completed = (
            all_completed
        )

        progress.updated_at = utc_now()

    session.add(
        progress,
    )

    return progress


def calculate_streaks(
    history: list[
        DailyProgress
    ],
) -> tuple[int, int]:
    completed_dates = {
        progress.progress_date
        for progress in history
        if progress.all_completed
    }

    today = date.today()

    current_cursor = today

    # A streak should not disappear during an
    # unfinished current day. Start from yesterday
    # unless today is already perfect.
    if today not in completed_dates:
        current_cursor -= timedelta(
            days=1,
        )

    current_streak = 0

    while (
        current_cursor
        in completed_dates
    ):
        current_streak += 1

        current_cursor -= timedelta(
            days=1,
        )

    longest_streak = 0
    running_streak = 0
    previous_date: date | None = None

    for progress_date in sorted(
        completed_dates,
    ):
        if (
            previous_date is not None
            and progress_date
            == (
                previous_date
                + timedelta(days=1)
            )
        ):
            running_streak += 1
        else:
            running_streak = 1

        longest_streak = max(
            longest_streak,
            running_streak,
        )

        previous_date = progress_date

    return (
        current_streak,
        longest_streak,
    )


def build_progress_history(
    session: Session,
    user_id: int,
    days: int,
) -> ProgressHistoryResponse:
    start_date = (
        date.today()
        - timedelta(
            days=days - 1,
        )
    )

    history = list(
        session.exec(
            select(
                DailyProgress,
            )
            .where(
                DailyProgress.user_id
                == user_id,
                DailyProgress.progress_date
                >= start_date,
            )
            .order_by(
                DailyProgress
                .progress_date
                .asc(),
            ),
        ).all(),
    )

    measurable_days = [
        progress
        for progress in history
        if progress.total_count > 0
    ]

    perfect_days = sum(
        progress.all_completed
        for progress in measurable_days
    )

    if measurable_days:
        average_completion = round(
            sum(
                (
                    progress.completed_count
                    / progress.total_count
                )
                * 100
                for progress
                in measurable_days
            )
            / len(
                measurable_days,
            ),
        )
    else:
        average_completion = 0

    (
        current_streak,
        longest_streak,
    ) = calculate_streaks(
        history,
    )

    return ProgressHistoryResponse(
        history=history,
        current_streak=current_streak,
        longest_streak=longest_streak,
        perfect_days=perfect_days,
        average_completion=(
            average_completion
        ),
        recorded_days=len(
            measurable_days,
        ),
    )
