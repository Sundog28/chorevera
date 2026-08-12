from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.middleware.security import (
    RateLimitMiddleware,
    RateLimitRule,
    SecurityHeadersMiddleware,
)
from app.models.security_audit import SecurityAuditLog
from conftest import test_engine


def test_security_headers_are_present(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/health",
    )

    assert response.status_code == 200
    assert response.headers[
        "x-content-type-options"
    ] == "nosniff"
    assert response.headers[
        "x-frame-options"
    ] == "DENY"
    assert response.headers[
        "referrer-policy"
    ] == "no-referrer"
    assert "x-request-id" in response.headers
    assert "content-security-policy" in response.headers


def test_rate_limiter_returns_429_and_retry_after() -> None:
    limited_app = FastAPI()

    limited_app.add_middleware(
        RateLimitMiddleware,
        rules={
            "/limited": RateLimitRule(
                limit=2,
                window_seconds=60,
            ),
        },
        enabled=True,
        trust_proxy_headers=False,
    )

    limited_app.add_middleware(
        SecurityHeadersMiddleware,
        is_production=False,
    )

    @limited_app.post("/limited")
    def limited_endpoint() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(limited_app) as test_client:
        assert test_client.post("/limited").status_code == 200
        assert test_client.post("/limited").status_code == 200

        blocked = test_client.post("/limited")

        assert blocked.status_code == 429
        assert "retry-after" in blocked.headers
        assert blocked.json()["detail"].startswith(
            "Too many requests"
        )


def test_login_failure_is_audited(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "missing@example.com",
            "password": "NotTheRightPassword123!",
        },
        headers={
            "X-Request-ID": "security-test-request",
        },
    )

    assert response.status_code == 401

    with Session(test_engine) as session:
        event = session.exec(
            select(SecurityAuditLog).where(
                SecurityAuditLog.event_type
                == "login_failed",
            ),
        ).first()

        assert event is not None
        assert event.success is False
        assert event.identifier_hash is not None
        assert "missing@example.com" not in (
            event.identifier_hash or ""
        )


def test_new_tokens_include_issuer_audience_and_work(
    client: TestClient,
) -> None:
    email = "secure-token@example.com"
    password = "SecurePassword123!"

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Secure Token User",
            "email": email,
            "password": password,
        },
    )

    assert registration.status_code == 201

    token = parse_qs(
        urlparse(
            registration.json()[
                "development_url"
            ],
        ).query,
    )["verify_token"][0]

    verified = client.post(
        "/api/v1/auth/email-verification/confirm",
        json={"token": token},
    )

    assert verified.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert login.status_code == 200

    me = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": (
                "Bearer "
                + login.json()["access_token"]
            ),
        },
    )

    assert me.status_code == 200
    assert me.json()["email"] == email
