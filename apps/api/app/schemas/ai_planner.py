from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)


TIME_PATTERN = re.compile(
    r"^(?:[01]\d|2[0-3]):[0-5]\d$",
)


AIPlanActionType = Literal[
    "create",
    "reassign",
]

AIPlanPriority = Literal[
    "low",
    "medium",
    "high",
]

AIPlanProvider = Literal[
    "openai",
    "fallback",
]


class AIPlannerRequest(BaseModel):
    household_id: int = Field(
        ge=1,
    )

    request_text: str = Field(
        min_length=5,
        max_length=1_000,
    )

    max_actions: int = Field(
        default=8,
        ge=1,
        le=12,
    )

    @field_validator("request_text")
    @classmethod
    def normalize_request_text(
        cls,
        value: str,
    ) -> str:
        normalized = " ".join(
            value.split(),
        )

        if len(normalized) < 5:
            raise ValueError(
                "Planning request is too short.",
            )

        return normalized


class AIPlanAction(BaseModel):
    action: AIPlanActionType

    existing_chore_id: int | None = Field(
        default=None,
        ge=1,
    )

    title: str = Field(
        min_length=1,
        max_length=100,
    )

    assigned_user_id: int = Field(
        ge=1,
    )

    reminder_time: str | None = Field(
        default=None,
    )

    priority: AIPlanPriority = Field(
        default="medium",
    )

    rationale: str = Field(
        min_length=1,
        max_length=240,
    )

    @field_validator("title")
    @classmethod
    def normalize_title(
        cls,
        value: str,
    ) -> str:
        normalized = " ".join(
            value.split(),
        )

        if not normalized:
            raise ValueError(
                "Chore title cannot be empty.",
            )

        return normalized

    @field_validator("reminder_time")
    @classmethod
    def validate_reminder_time(
        cls,
        value: str | None,
    ) -> str | None:
        if value in {
            None,
            "",
        }:
            return None

        if not TIME_PATTERN.fullmatch(
            value,
        ):
            raise ValueError(
                "Reminder time must use HH:MM in 24-hour format.",
            )

        return value

    @field_validator("rationale")
    @classmethod
    def normalize_rationale(
        cls,
        value: str,
    ) -> str:
        return " ".join(
            value.split(),
        )

    @model_validator(mode="after")
    def validate_action_shape(
        self,
    ) -> "AIPlanAction":
        if (
            self.action == "reassign"
            and self.existing_chore_id is None
        ):
            raise ValueError(
                "Reassign actions require an existing chore ID.",
            )

        if (
            self.action == "create"
            and self.existing_chore_id is not None
        ):
            raise ValueError(
                "Create actions cannot reference an existing chore ID.",
            )

        return self


class AIPlannerModelOutput(BaseModel):
    summary: str = Field(
        min_length=1,
        max_length=600,
    )

    fairness_notes: str = Field(
        min_length=1,
        max_length=600,
    )

    assumptions: list[str] = Field(
        default_factory=list,
        max_length=6,
    )

    confidence: int = Field(
        ge=0,
        le=100,
    )

    actions: list[AIPlanAction] = Field(
        default_factory=list,
        max_length=12,
    )

    @field_validator(
        "summary",
        "fairness_notes",
    )
    @classmethod
    def normalize_text(
        cls,
        value: str,
    ) -> str:
        return " ".join(
            value.split(),
        )

    @field_validator("assumptions")
    @classmethod
    def normalize_assumptions(
        cls,
        values: list[str],
    ) -> list[str]:
        normalized: list[str] = []

        for value in values:
            item = " ".join(
                value.split(),
            )

            if item:
                normalized.append(
                    item[:240],
                )

        return normalized[:6]


class AIPlannerWorkload(BaseModel):
    user_id: int
    name: str
    current_incomplete: int
    projected_incomplete: int
    recent_completed: int


class AIPlannerResponse(BaseModel):
    household_id: int
    provider: AIPlanProvider
    model: str | None
    fallback_reason: str | None

    summary: str
    fairness_notes: str
    assumptions: list[str]
    confidence: int

    actions: list[AIPlanAction]
    workloads: list[AIPlannerWorkload]

    generated_at: datetime


class AIPlannerApplyRequest(BaseModel):
    household_id: int = Field(
        ge=1,
    )

    actions: list[AIPlanAction] = Field(
        min_length=1,
        max_length=12,
    )


class AIPlannerApplyResponse(BaseModel):
    household_id: int
    applied_action_count: int
    created_count: int
    reassigned_count: int
    message: str
