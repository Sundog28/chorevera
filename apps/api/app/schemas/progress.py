from datetime import date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class ProgressSnapshotUpsert(
    BaseModel,
):
    progress_date: date

    total_count: int = Field(
        ge=0,
        le=100_000,
    )

    completed_count: int = Field(
        ge=0,
        le=100_000,
    )

    @model_validator(
        mode="after",
    )
    def validate_counts(
        self,
    ) -> "ProgressSnapshotUpsert":
        if (
            self.completed_count
            > self.total_count
        ):
            raise ValueError(
                "Completed count cannot exceed "
                "total count.",
            )

        return self


class ProgressImportRequest(
    BaseModel,
):
    snapshots: list[
        ProgressSnapshotUpsert
    ] = Field(
        max_length=1_000,
    )


class ProgressDayResponse(
    BaseModel,
):
    model_config = ConfigDict(
        from_attributes=True,
    )

    progress_date: date
    total_count: int
    completed_count: int
    all_completed: bool
    updated_at: datetime


class ProgressHistoryResponse(
    BaseModel,
):
    history: list[
        ProgressDayResponse
    ]

    current_streak: int
    longest_streak: int
    perfect_days: int
    average_completion: int
    recorded_days: int
