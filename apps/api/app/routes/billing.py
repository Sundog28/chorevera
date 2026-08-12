from datetime import datetime, timezone
from typing import Any

import stripe
from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import Session, select

from app.config import settings
from app.database import engine
from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.billing import (
    BillingPortalResponse,
    BillingStatusResponse,
    CheckoutSessionCreate,
    CheckoutSessionResponse,
)


router = APIRouter(
    prefix="/api/v1/billing",
    tags=["Billing"],
)

stripe.api_key = settings.stripe_secret_key


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def unix_timestamp_to_datetime(
    value: int | None,
) -> datetime | None:
    if value is None:
        return None

    return datetime.fromtimestamp(
        value,
        tz=timezone.utc,
    )


def get_price_id_for_plan(plan: str) -> str:
    if plan == "pro":
        price_id = settings.stripe_pro_price_id
    elif plan == "family":
        price_id = settings.stripe_family_price_id
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported subscription plan.",
        )

    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Stripe price ID is not configured "
                f"for the {plan} plan."
            ),
        )

    return price_id


def get_plan_for_price_id(
    price_id: str | None,
) -> str:
    if price_id == settings.stripe_pro_price_id:
        return "pro"

    if price_id == settings.stripe_family_price_id:
        return "family"

    return "free"


def get_user_subscription(
    user_id: int,
    session: Session,
) -> Subscription | None:
    return session.exec(
        select(Subscription).where(
            Subscription.user_id == user_id,
        ),
    ).first()


def get_subscription_by_customer(
    customer_id: str,
    session: Session,
) -> Subscription | None:
    return session.exec(
        select(Subscription).where(
            Subscription.stripe_customer_id
            == customer_id,
        ),
    ).first()


def ensure_subscription_record(
    user: User,
    session: Session,
) -> Subscription:
    if user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User account has no database ID.",
        )

    subscription = get_user_subscription(
        user.id,
        session,
    )

    if subscription is not None:
        return subscription

    subscription = Subscription(
        user_id=user.id,
        plan_name="free",
        subscription_status="inactive",
    )

    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return subscription


def ensure_stripe_customer(
    user: User,
    subscription: Subscription,
    session: Session,
) -> str:
    if subscription.stripe_customer_id:
        return subscription.stripe_customer_id

    try:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={
                "choreflow_user_id": str(user.id),
            },
        )
    except stripe.StripeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                getattr(error, "user_message", None)
                or "Stripe could not create the customer."
            ),
        ) from error

    customer_id = customer.id

    if not isinstance(customer_id, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a customer ID.",
        )

    subscription.stripe_customer_id = customer_id
    subscription.updated_at = utc_now()

    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return customer_id


def extract_subscription_price_id(
    stripe_subscription: dict[str, Any],
) -> str | None:
    items = stripe_subscription.get(
        "items",
        {},
    )

    data = items.get(
        "data",
        [],
    )

    if not data:
        return None

    first_item = data[0]

    if not isinstance(first_item, dict):
        return None

    price = first_item.get(
        "price",
        {},
    )

    if not isinstance(price, dict):
        return None

    price_id = price.get("id")

    return (
        price_id
        if isinstance(price_id, str)
        else None
    )


def synchronize_stripe_subscription(
    stripe_subscription: dict[str, Any],
    session: Session,
) -> None:
    customer_id = stripe_subscription.get(
        "customer",
    )

    if not isinstance(customer_id, str):
        return

    local_subscription = (
        get_subscription_by_customer(
            customer_id,
            session,
        )
    )

    if local_subscription is None:
        return

    stripe_subscription_id = (
        stripe_subscription.get("id")
    )

    subscription_status = (
        stripe_subscription.get(
            "status",
            "inactive",
        )
    )

    price_id = extract_subscription_price_id(
        stripe_subscription,
    )

    paid_statuses = {
        "active",
        "trialing",
    }

    local_subscription.stripe_subscription_id = (
        stripe_subscription_id
        if isinstance(
            stripe_subscription_id,
            str,
        )
        else None
    )

    local_subscription.stripe_price_id = (
        price_id
    )

    local_subscription.subscription_status = (
        str(subscription_status)
    )

    local_subscription.plan_name = (
        get_plan_for_price_id(price_id)
        if subscription_status in paid_statuses
        else "free"
    )

    current_period_end = stripe_subscription.get(
        "current_period_end",
    )

    local_subscription.current_period_end = (
        unix_timestamp_to_datetime(
            current_period_end
            if isinstance(current_period_end, int)
            else None,
        )
    )

    local_subscription.cancel_at_period_end = bool(
        stripe_subscription.get(
            "cancel_at_period_end",
            False,
        ),
    )

    local_subscription.updated_at = utc_now()

    session.add(local_subscription)
    session.commit()
    session.refresh(local_subscription)


@router.get(
    "/status",
    response_model=BillingStatusResponse,
)
def get_billing_status(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> BillingStatusResponse:
    subscription = ensure_subscription_record(
        current_user,
        session,
    )

    is_paid = (
        subscription.plan_name
        in {"pro", "family"}
        and subscription.subscription_status
        in {"active", "trialing"}
    )

    return BillingStatusResponse(
        plan_name=subscription.plan_name,
        subscription_status=(
            subscription.subscription_status
        ),
        is_paid=is_paid,
        stripe_customer_id=(
            subscription.stripe_customer_id
        ),
        stripe_subscription_id=(
            subscription.stripe_subscription_id
        ),
        current_period_end=(
            subscription.current_period_end
        ),
        cancel_at_period_end=(
            subscription.cancel_at_period_end
        ),
    )


@router.post(
    "/checkout",
    response_model=CheckoutSessionResponse,
)
def create_checkout_session(
    checkout_data: CheckoutSessionCreate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> CheckoutSessionResponse:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe is not configured.",
        )

    subscription = ensure_subscription_record(
        current_user,
        session,
    )

    customer_id = ensure_stripe_customer(
        current_user,
        subscription,
        session,
    )

    price_id = get_price_id_for_plan(
        checkout_data.plan,
    )

    try:
        checkout_session = (
            stripe.checkout.Session.create(
                mode="subscription",
                customer=customer_id,
                line_items=[
                    {
                        "price": price_id,
                        "quantity": 1,
                    },
                ],
                success_url=(
                    settings.stripe_checkout_success_url
                ),
                cancel_url=(
                    settings.stripe_checkout_cancel_url
                ),
                allow_promotion_codes=True,
                client_reference_id=str(
                    current_user.id,
                ),
                metadata={
                    "choreflow_user_id": str(
                        current_user.id,
                    ),
                    "choreflow_plan": (
                        checkout_data.plan
                    ),
                },
                subscription_data={
                    "metadata": {
                        "choreflow_user_id": str(
                            current_user.id,
                        ),
                        "choreflow_plan": (
                            checkout_data.plan
                        ),
                    },
                },
            )
        )
    except stripe.StripeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                getattr(
                    error,
                    "user_message",
                    None,
                )
                or "Stripe could not create checkout."
            ),
        ) from error

    checkout_url = checkout_session.url

    if not isinstance(checkout_url, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Stripe did not return a "
                "Checkout URL."
            ),
        )

    return CheckoutSessionResponse(
        checkout_url=checkout_url,
    )


@router.post(
    "/portal",
    response_model=BillingPortalResponse,
)
def create_billing_portal(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> BillingPortalResponse:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe is not configured.",
        )

    subscription = ensure_subscription_record(
        current_user,
        session,
    )

    customer_id = ensure_stripe_customer(
        current_user,
        subscription,
        session,
    )

    try:
        portal_session = (
            stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=(
                    settings.stripe_portal_return_url
                ),
            )
        )
    except stripe.StripeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                getattr(
                    error,
                    "user_message",
                    None,
                )
                or (
                    "Stripe could not open "
                    "billing management."
                )
            ),
        ) from error

    portal_url = portal_session.url

    if not isinstance(portal_url, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Stripe did not return a "
                "billing portal URL."
            ),
        )

    return BillingPortalResponse(
        portal_url=portal_url,
    )


@router.post(
    "/webhook",
    include_in_schema=False,
)
async def stripe_webhook(
    request: Request,
) -> dict[str, bool]:
    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Stripe webhook secret "
                "is not configured."
            ),
        )

    payload = await request.body()

    signature = request.headers.get(
        "stripe-signature",
    )

    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature.",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid Stripe webhook payload."
            ),
        ) from error
    except stripe.SignatureVerificationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid Stripe webhook signature."
            ),
        ) from error

    event_type = event.type
    event_object = event.data.object

    with Session(engine) as session:
        if event_type in {
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        }:
            synchronize_stripe_subscription(
                event_object.to_dict(),
                session,
            )

        elif event_type == (
            "checkout.session.completed"
        ):
            stripe_subscription_id = (
                event_object.subscription
            )

            if isinstance(
                stripe_subscription_id,
                str,
            ):
                try:
                    retrieved_subscription = (
                        stripe.Subscription.retrieve(
                            stripe_subscription_id,
                        )
                    )
                except stripe.StripeError as error:
                    raise HTTPException(
                        status_code=(
                            status.HTTP_502_BAD_GATEWAY
                        ),
                        detail=(
                            "Stripe could not retrieve "
                            "the subscription."
                        ),
                    ) from error

                synchronize_stripe_subscription(
                    retrieved_subscription.to_dict(),
                    session,
                )

    return {
        "received": True,
    }