from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any
from uuid import uuid4

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from app.config import settings


password_hash = PasswordHash.recommended()

# Used only to make unknown-user login attempts perform a real password
# verification too, reducing the timing difference between known and unknown
# email addresses. It is never used as an account password.
DUMMY_PASSWORD_HASH = password_hash.hash(
    "choreflow-dummy-password-not-for-login",
)


def hash_password(
    password: str,
) -> str:
    return password_hash.hash(
        password,
    )


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(
    subject: str,
    token_version: int = 0,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(
        timezone.utc,
    )

    expiration = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(
            minutes=(
                settings
                .access_token_expire_minutes
            ),
        )
    )

    payload: dict[str, Any] = {
        "sub": subject,
        "ver": token_version,
        "iat": now,
        "nbf": now,
        "exp": expiration,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": str(uuid4()),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(
    token: str,
) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[
                settings.jwt_algorithm,
            ],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={
                "require": [
                    "sub",
                    "iat",
                    "nbf",
                    "exp",
                    "iss",
                    "aud",
                    "jti",
                ],
            },
        )
    except InvalidTokenError as error:
        raise ValueError(
            "Invalid or expired access token.",
        ) from error

    return payload


def generate_one_time_token() -> str:
    return token_urlsafe(48)


def hash_one_time_token(
    token: str,
) -> str:
    return sha256(
        token.encode("utf-8"),
    ).hexdigest()
