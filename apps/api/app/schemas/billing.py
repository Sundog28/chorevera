from datetime import datetime
from typing import Literal

from pydantic import BaseModel


PlanName = Literal["free", "pro", "family"]


class CheckoutSessionCreate(BaseModel):
    plan: Literal["pro", "family"]


class CheckoutSessionResponse(BaseModel):
    checkout_url: str


class BillingPortalResponse(BaseModel):
    portal_url: str


class BillingStatusResponse(BaseModel):
    plan_name: PlanName
    subscription_status: str
    is_paid: bool
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    current_period_end: datetime | None
    cancel_at_period_end: bool