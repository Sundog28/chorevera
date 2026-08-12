from urllib.parse import (
    parse_qs,
    urlparse,
)

from fastapi.testclient import TestClient


def extract_token(
    url: str,
    parameter: str,
) -> str:
    query = parse_qs(
        urlparse(
            url,
        ).query,
    )

    return query[
        parameter
    ][0]


def register_and_verify(
    client: TestClient,
    email: str,
    password: str,
) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "email": email,
            "password": password,
        },
    )

    assert (
        registration.status_code
        == 201
    )

    development_url = (
        registration.json()[
            "development_url"
        ]
    )

    verification_token = (
        extract_token(
            development_url,
            "verify_token",
        )
    )

    confirmation = client.post(
        (
            "/api/v1/auth/"
            "email-verification/confirm"
        ),
        json={
            "token": (
                verification_token
            ),
        },
    )

    assert (
        confirmation.status_code
        == 200
    )


def login(
    client: TestClient,
    email: str,
    password: str,
):
    return client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )


def test_registration_requires_verification(
    client: TestClient,
) -> None:
    email = "verify@example.com"
    password = "SecurePassword123!"

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Verify User",
            "email": email,
            "password": password,
        },
    )

    assert (
        registration.status_code
        == 201
    )

    unverified_login = login(
        client,
        email,
        password,
    )

    assert (
        unverified_login.status_code
        == 403
    )

    token = extract_token(
        registration.json()[
            "development_url"
        ],
        "verify_token",
    )

    verified = client.post(
        (
            "/api/v1/auth/"
            "email-verification/confirm"
        ),
        json={
            "token": token,
        },
    )

    assert verified.status_code == 200

    verified_login = login(
        client,
        email,
        password,
    )

    assert (
        verified_login.status_code
        == 200
    )

    reused = client.post(
        (
            "/api/v1/auth/"
            "email-verification/confirm"
        ),
        json={
            "token": token,
        },
    )

    assert reused.status_code == 400


def test_password_reset_invalidates_old_password(
    client: TestClient,
) -> None:
    email = "reset@example.com"
    old_password = "SecurePassword123!"
    new_password = "NewSecurePassword456!"

    register_and_verify(
        client,
        email,
        old_password,
    )

    reset_request = client.post(
        (
            "/api/v1/auth/"
            "password-reset/request"
        ),
        json={
            "email": email,
        },
    )

    assert (
        reset_request.status_code
        == 202
    )

    reset_token = extract_token(
        reset_request.json()[
            "development_url"
        ],
        "reset_token",
    )

    reset = client.post(
        (
            "/api/v1/auth/"
            "password-reset/confirm"
        ),
        json={
            "token": reset_token,
            "new_password": (
                new_password
            ),
        },
    )

    assert reset.status_code == 200

    assert (
        login(
            client,
            email,
            old_password,
        ).status_code
        == 401
    )

    assert (
        login(
            client,
            email,
            new_password,
        ).status_code
        == 200
    )

    reused = client.post(
        (
            "/api/v1/auth/"
            "password-reset/confirm"
        ),
        json={
            "token": reset_token,
            "new_password": (
                "AnotherPassword789!"
            ),
        },
    )

    assert reused.status_code == 400
