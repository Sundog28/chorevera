from typing import Literal

from pydantic import BaseModel


class FeatureAccessResponse(BaseModel):
    plan_name: Literal[
        "free",
        "pro",
        "family",
    ]

    max_chores: int | None
    unlimited_chores: bool

    advanced_reminders: bool
    analytics: bool
    household_sharing: bool
    ai_planning: bool