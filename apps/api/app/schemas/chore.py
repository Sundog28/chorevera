import re
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


TIME_PATTERN = re.compile(
    r"^(?:[01]\d|2[0-3]):[0-5]\d$",
)


def normalize_title(
    value: str,
) -> str:
    normalized_title = value.strip()

    if not normalized_title:
        raise ValueError(
            "Chore title cannot be empty.",
        )

    return normalized_title


def normalize_reminder_time(
    value: str | None,
) -> str | None:
    if value is None or value == "":
        return None

    if not TIME_PATTERN.fullmatch(value):
        raise ValueError(
            "Reminder time must use HH:MM "
            "in 24-hour format.",
        )

    return value


class ChoreCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=100,
        examples=["Wash the dishes"],
    )

    reminder_time: str | None = Field(
        default=None,
        examples=["19:30"],
    )

    # Leave null to create a personal chore.
    household_id: int | None = Field(
        default=None,
        examples=[1],
    )

    # For household chores, the owner can assign
    # the chore to any household member.
    assigned_user_id: int | None = Field(
        default=None,
        examples=[2],
    )

    @field_validator("title")
    @classmethod
    def validate_title(
        cls,
        value: str,
    ) -> str:
        return normalize_title(value)

    @field_validator("reminder_time")
    @classmethod
    def validate_reminder_time(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_reminder_time(value)


class ChoreUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    reminder_time: str | None = None
    completed: bool | None = None

    # Household ownership is intentionally not editable.
    # A chore must be deleted and recreated to move it
    # between personal and household workspaces.
    assigned_user_id: int | None = Field(
        default=None,
    )

    @field_validator("title")
    @classmethod
    def validate_title(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        return normalize_title(value)

    @field_validator("reminder_time")
    @classmethod
    def validate_reminder_time(
        cls,
        value: str | None,
    ) -> str | None:
        return normalize_reminder_time(value)


class ChoreResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    title: str
    reminder_time: str | None
    completed: bool

    owner_id: int
    household_id: int | None
    assigned_user_id: int | None

    created_at: datetime
    updated_at: datetime


AutoAssignMode = Literal[
    "unassigned_only",
    "rebalance_incomplete",
]


class ChoreAutoAssignRequest(BaseModel):
    household_id: int = Field(
        ge=1,
    )

    mode: AutoAssignMode = Field(
        default="unassigned_only",
    )


class ChoreAutoAssignment(BaseModel):
    chore_id: int
    chore_title: str

    previous_assigned_user_id: int | None

    assigned_user_id: int
    assigned_user_name: str

    changed: bool


class ChoreAutoAssignResponse(BaseModel):
    household_id: int
    mode: AutoAssignMode

    applied: bool

    eligible_chore_count: int
    changed_chore_count: int

    assignments: list[ChoreAutoAssignment]
