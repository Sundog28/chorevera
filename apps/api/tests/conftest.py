import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import (
    Session,
    SQLModel,
    create_engine,
)


os.environ[
    "JWT_SECRET_KEY"
] = (
    "test-secret-key-that-is-"
    "at-least-thirty-two-characters"
)

# Keep tests isolated from values in a developer .env file.
os.environ[
    "ENVIRONMENT"
] = "development"

os.environ[
    "FRONTEND_URL"
] = "http://localhost:5173"

os.environ[
    "SMTP_HOST"
] = ""

# Rate limiting is covered by isolated middleware tests.
os.environ[
    "RATE_LIMIT_ENABLED"
] = "false"





from app.database import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app import models  # noqa: E402,F401


test_engine = create_engine(
    "sqlite://",
    connect_args={
        "check_same_thread": False,
    },
    poolclass=StaticPool,
)


def override_get_session() -> Generator[
    Session,
    None,
    None,
]:
    with Session(
        test_engine,
    ) as session:
        yield session


app.dependency_overrides[
    get_session
] = override_get_session


@pytest.fixture(
    autouse=True,
)
def reset_database() -> Generator[
    None,
    None,
    None,
]:
    SQLModel.metadata.drop_all(
        test_engine,
    )

    SQLModel.metadata.create_all(
        test_engine,
    )

    yield


@pytest.fixture
def client() -> Generator[
    TestClient,
    None,
    None,
]:
    with TestClient(
        app,
    ) as test_client:
        yield test_client
