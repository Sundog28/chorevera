from typing import Annotated

from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.database import get_session
from app.models.user import User
from app.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
)


SessionDependency = Annotated[
    Session,
    Depends(get_session),
]


def get_current_user(
    token: Annotated[
        str,
        Depends(oauth2_scheme),
    ],
    session: SessionDependency,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "Could not validate authentication "
            "credentials."
        ),
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )

    try:
        payload = decode_access_token(
            token,
        )

        subject = payload.get(
            "sub",
        )

        token_version = payload.get(
            "ver",
            0,
        )

        if (
            not isinstance(
                subject,
                str,
            )
            or not isinstance(
                token_version,
                int,
            )
        ):
            raise credentials_exception

        user_id = int(
            subject,
        )
    except (
        ValueError,
        TypeError,
    ):
        raise credentials_exception

    user = session.get(
        User,
        user_id,
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This account is inactive."
            ),
        )

    if (
        user.token_version
        != token_version
    ):
        raise credentials_exception

    return user


CurrentUserDependency = Annotated[
    User,
    Depends(get_current_user),
]
