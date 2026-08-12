from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


HouseholdRole = Literal[
    "owner",
    "member",
]


class HouseholdCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )


class HouseholdUpdate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )


class HouseholdMemberResponse(BaseModel):
    membership_id: int
    user_id: int
    name: str
    email: str
    role: HouseholdRole
    joined_at: datetime


class HouseholdSummaryResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    current_user_role: HouseholdRole
    member_count: int
    created_at: datetime
    updated_at: datetime


class HouseholdDetailResponse(
    HouseholdSummaryResponse,
):
    members: list[HouseholdMemberResponse]


class HouseholdDeleteResponse(BaseModel):
    deleted: bool