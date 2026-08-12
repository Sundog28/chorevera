from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.config import settings
from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.models.auth_token import AuthToken
from app.models.user import User
from app.schemas.user import (
    AuthMessageResponse,
    EmailRequest,
    PasswordResetConfirm,
    RegistrationResponse,
    TokenConfirm,
    TokenResponse,
    UserRegister,
    UserResponse,
)
from app.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_one_time_token,
    hash_one_time_token,
    hash_password,
    verify_password,
)
from app.services.email import send_email
from app.services.security_audit import (
    record_security_event,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

VERIFY_EMAIL_PURPOSE = "verify_email"
RESET_PASSWORD_PURPOSE = "reset_password"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_datetime(
    value: datetime,
) -> datetime:
    if value.tzinfo is None:
        return value.replace(
            tzinfo=timezone.utc,
        )

    return value.astimezone(
        timezone.utc,
    )


def build_frontend_url(
    parameter: str,
    token: str,
) -> str:
    query = urlencode({
        parameter: token,
    })

    return (
        f"{settings.frontend_url.rstrip('/')}/"
        f"?{query}"
    )


def revoke_open_tokens(
    session: Session,
    user_id: int,
    purpose: str,
) -> None:
    now = utc_now()

    open_tokens = session.exec(
        select(AuthToken).where(
            AuthToken.user_id == user_id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        ),
    ).all()

    for token_record in open_tokens:
        token_record.used_at = now
        session.add(token_record)


def issue_one_time_token(
    session: Session,
    user: User,
    purpose: str,
    expires_in_minutes: int,
) -> str:
    if user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User account has no database ID.",
        )

    revoke_open_tokens(
        session,
        user.id,
        purpose,
    )

    raw_token = generate_one_time_token()

    token_record = AuthToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=hash_one_time_token(
            raw_token,
        ),
        expires_at=(
            utc_now() +
            timedelta(
                minutes=expires_in_minutes,
            )
        ),
    )

    session.add(token_record)
    session.commit()

    return raw_token


def get_valid_token_record(
    session: Session,
    raw_token: str,
    purpose: str,
) -> AuthToken:
    token_hash = hash_one_time_token(
        raw_token,
    )

    token_record = session.exec(
        select(AuthToken).where(
            AuthToken.token_hash == token_hash,
            AuthToken.purpose == purpose,
        ),
    ).first()

    if (
        token_record is None
        or token_record.used_at is not None
        or normalize_datetime(
            token_record.expires_at,
        ) <= utc_now()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This link is invalid or has expired. "
                "Request a new one."
            ),
        )

    return token_record


def send_verification_message(
    session: Session,
    user: User,
) -> str:
    raw_token = issue_one_time_token(
        session,
        user,
        VERIFY_EMAIL_PURPOSE,
        settings.email_verification_expire_minutes,
    )

    verification_url = build_frontend_url(
        "verify_token",
        raw_token,
    )

    send_email(
        to_email=user.email,
        subject="Verify your ChoreFlow email",
        text_body=(
            f"Hello {user.name},\n\n"
            "Verify your ChoreFlow email by opening this link:\n"
            f"{verification_url}\n\n"
            "If you did not create this account, you can ignore this email."
        ),
        html_body=(
            f"<p>Hello {user.name},</p>"
            "<p>Verify your ChoreFlow email by opening the link below:</p>"
            f'<p><a href="{verification_url}">Verify email address</a></p>'
            "<p>If you did not create this account, you can ignore this email.</p>"
        ),
    )

    return verification_url


def send_password_reset_message(
    session: Session,
    user: User,
) -> str:
    raw_token = issue_one_time_token(
        session,
        user,
        RESET_PASSWORD_PURPOSE,
        settings.password_reset_expire_minutes,
    )

    reset_url = build_frontend_url(
        "reset_token",
        raw_token,
    )

    send_email(
        to_email=user.email,
        subject="Reset your ChoreFlow password",
        text_body=(
            f"Hello {user.name},\n\n"
            "Reset your ChoreFlow password by opening this link:\n"
            f"{reset_url}\n\n"
            "If you did not request this reset, you can ignore this email."
        ),
        html_body=(
            f"<p>Hello {user.name},</p>"
            "<p>Reset your ChoreFlow password by opening the link below:</p>"
            f'<p><a href="{reset_url}">Reset password</a></p>'
            "<p>If you did not request this reset, you can ignore this email.</p>"
        ),
    )

    return reset_url


def development_url(
    url: str | None,
) -> str | None:
    if (
        settings.environment.lower()
        == "development"
    ):
        return url

    return None


@router.post(
    "/register",
    response_model=RegistrationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    registration: UserRegister,
    request: Request,
    session: SessionDependency,
) -> RegistrationResponse:
    normalized_email = (
        registration.email
        .lower()
        .strip()
    )

    normalized_name = (
        registration.name
        .strip()
    )

    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name cannot be empty.",
        )

    existing_user = session.exec(
        select(User).where(
            User.email == normalized_email,
        ),
    ).first()

    if existing_user:
        record_security_event(
            session,
            request,
            event_type="register_duplicate",
            success=False,
            user_id=existing_user.id,
            identifier=normalized_email,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An account with this email "
                "already exists."
            ),
        )

    user = User(
        name=normalized_name,
        email=normalized_email,
        password_hash=hash_password(
            registration.password,
        ),
        is_email_verified=False,
        email_verified_at=None,
    )

    session.add(user)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()

        record_security_event(
            session,
            request,
            event_type="register_conflict",
            success=False,
            identifier=normalized_email,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An account with this email "
                "already exists."
            ),
        )

    session.refresh(user)

    verification_url: str | None = None
    message = (
        "Account created. Check your email "
        "to verify your address before signing in."
    )

    try:
        verification_url = send_verification_message(
            session,
            user,
        )
    except Exception:
        logger.exception(
            "Unable to send verification email "
            "for user %s.",
            user.id,
        )

        message = (
            "Account created, but ChoreFlow could not "
            "send the verification email. Use the "
            "resend option on the verification screen."
        )

    record_security_event(
        session,
        request,
        event_type="register_success",
        success=True,
        user_id=user.id,
        identifier=normalized_email,
    )

    return RegistrationResponse(
        user=UserResponse.model_validate(
            user,
        ),
        message=message,
        development_url=development_url(
            verification_url,
        ),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login_user(
    request: Request,
    session: SessionDependency,
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    normalized_email = (
        form_data.username
        .lower()
        .strip()
    )

    user = session.exec(
        select(User).where(
            User.email == normalized_email,
        ),
    ).first()

    password_is_valid = verify_password(
        form_data.password,
        (
            user.password_hash
            if user is not None
            else DUMMY_PASSWORD_HASH
        ),
    )

    if (
        user is None
        or not password_is_valid
    ):
        record_security_event(
            session,
            request,
            event_type="login_failed",
            success=False,
            user_id=(
                user.id
                if user is not None
                else None
            ),
            identifier=normalized_email,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    if not user.is_active:
        record_security_event(
            session,
            request,
            event_type="login_inactive",
            success=False,
            user_id=user.id,
            identifier=normalized_email,
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    if not user.is_email_verified:
        record_security_event(
            session,
            request,
            event_type="login_unverified",
            success=False,
            user_id=user.id,
            identifier=normalized_email,
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Email address is not verified. "
                "Request a new verification email."
            ),
        )

    if user.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User account has no database ID.",
        )

    access_token = create_access_token(
        subject=str(user.id),
        token_version=user.token_version,
    )

    record_security_event(
        session,
        request,
        event_type="login_success",
        success=True,
        user_id=user.id,
        identifier=normalized_email,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=(
            settings.access_token_expire_minutes
            * 60
        ),
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_authenticated_user(
    current_user: CurrentUserDependency,
) -> User:
    return current_user


@router.post(
    "/email-verification/request",
    response_model=AuthMessageResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_email_verification(
    email_request: EmailRequest,
    request: Request,
    session: SessionDependency,
) -> AuthMessageResponse:
    normalized_email = (
        email_request.email
        .lower()
        .strip()
    )

    user = session.exec(
        select(User).where(
            User.email == normalized_email,
        ),
    ).first()

    verification_url: str | None = None

    if (
        user is not None
        and user.is_active
        and not user.is_email_verified
    ):
        try:
            verification_url = send_verification_message(
                session,
                user,
            )
        except Exception:
            logger.exception(
                "Unable to resend verification email "
                "for user %s.",
                user.id,
            )

    record_security_event(
        session,
        request,
        event_type="email_verification_requested",
        success=True,
        user_id=(
            user.id
            if user is not None
            else None
        ),
        identifier=normalized_email,
    )

    return AuthMessageResponse(
        message=(
            "If an unverified account exists for that "
            "email, a verification message has been sent."
        ),
        development_url=development_url(
            verification_url,
        ),
    )


@router.post(
    "/email-verification/confirm",
    response_model=AuthMessageResponse,
)
def confirm_email_verification(
    confirmation: TokenConfirm,
    request: Request,
    session: SessionDependency,
) -> AuthMessageResponse:
    token_record = get_valid_token_record(
        session,
        confirmation.token,
        VERIFY_EMAIL_PURPOSE,
    )

    user = session.get(
        User,
        token_record.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This verification link is invalid."
            ),
        )

    now = utc_now()

    user.is_email_verified = True
    user.email_verified_at = now
    user.updated_at = now

    token_record.used_at = now

    session.add(user)
    session.add(token_record)

    if user.id is not None:
        revoke_open_tokens(
            session,
            user.id,
            VERIFY_EMAIL_PURPOSE,
        )

    session.commit()

    record_security_event(
        session,
        request,
        event_type="email_verified",
        success=True,
        user_id=user.id,
        identifier=user.email,
    )

    return AuthMessageResponse(
        message=(
            "Your email is verified. "
            "You can now sign in."
        ),
    )


@router.post(
    "/password-reset/request",
    response_model=AuthMessageResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_password_reset(
    email_request: EmailRequest,
    request: Request,
    session: SessionDependency,
) -> AuthMessageResponse:
    normalized_email = (
        email_request.email
        .lower()
        .strip()
    )

    user = session.exec(
        select(User).where(
            User.email == normalized_email,
        ),
    ).first()

    reset_url: str | None = None

    if (
        user is not None
        and user.is_active
    ):
        try:
            reset_url = send_password_reset_message(
                session,
                user,
            )
        except Exception:
            logger.exception(
                "Unable to send password reset email "
                "for user %s.",
                user.id,
            )

    record_security_event(
        session,
        request,
        event_type="password_reset_requested",
        success=True,
        user_id=(
            user.id
            if user is not None
            else None
        ),
        identifier=normalized_email,
    )

    return AuthMessageResponse(
        message=(
            "If an active account exists for that "
            "email, a password reset message has been sent."
        ),
        development_url=development_url(
            reset_url,
        ),
    )


@router.post(
    "/password-reset/confirm",
    response_model=AuthMessageResponse,
)
def confirm_password_reset(
    confirmation: PasswordResetConfirm,
    request: Request,
    session: SessionDependency,
) -> AuthMessageResponse:
    token_record = get_valid_token_record(
        session,
        confirmation.token,
        RESET_PASSWORD_PURPOSE,
    )

    user = session.get(
        User,
        token_record.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This password reset link is invalid."
            ),
        )

    now = utc_now()

    user.password_hash = hash_password(
        confirmation.new_password,
    )

    user.token_version += 1
    user.updated_at = now

    token_record.used_at = now

    session.add(user)
    session.add(token_record)

    if user.id is not None:
        revoke_open_tokens(
            session,
            user.id,
            RESET_PASSWORD_PURPOSE,
        )

    session.commit()

    record_security_event(
        session,
        request,
        event_type="password_reset_completed",
        success=True,
        user_id=user.id,
        identifier=user.email,
    )

    return AuthMessageResponse(
        message=(
            "Your password has been reset. "
            "Sign in with your new password."
        ),
    )
