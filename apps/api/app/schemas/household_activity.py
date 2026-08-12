from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
)


class HouseholdActivityResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    household_id: int

    actor_user_id: int | None
    actor_name: str | None

    target_user_id: int | None
    target_user_name: str | None

    chore_id: int | None

    action_type: str
    message: str

    created_at: datetime