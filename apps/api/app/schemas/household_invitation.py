from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


InvitationStatus = Literal[
    "pending",
    "accepted",
    "declined",
    "cancelled",
]


class HouseholdInvitationCreate(
    BaseModel,
):
    email: EmailStr


class HouseholdInvitationResponse(
    BaseModel,
):
    id: int
    household_id: int
    household_name: str

    invited_by_user_id: int
    invited_by_name: str

    invited_user_id: int
    invited_name: str
    invited_email: str

    status: InvitationStatus
    created_at: datetime
    responded_at: datetime | None


class HouseholdInvitationActionResponse(
    BaseModel,
):
    invitation: HouseholdInvitationResponse
    joined_household: bool


class HouseholdInvitationDeleteResponse(
    BaseModel,
):
    cancelled: bool