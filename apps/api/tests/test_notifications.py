from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.user import User
from app.services.notifications import create_notification
from conftest import test_engine


def register_and_login(client: TestClient) -> tuple[dict[str, str], int]:
    email = "notifications@example.com"
    password = "SecurePassword123!"
    registration = client.post(
        "/api/v1/auth/register",
        json={"name": "Notification User", "email": email, "password": password},
    )
    assert registration.status_code == 201
    token = parse_qs(urlparse(registration.json()["development_url"]).query)["verify_token"][0]
    assert client.post(
        "/api/v1/auth/email-verification/confirm", json={"token": token}
    ).status_code == 200
    login = client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    assert login.status_code == 200
    with Session(test_engine) as session:
        user = session.exec(select(User).where(User.email == email)).one()
        assert user.id is not None
        user_id = user.id
    return {"Authorization": "Bearer " + login.json()["access_token"]}, user_id


def seed_notifications(user_id: int) -> None:
    with Session(test_engine) as session:
        create_notification(
            session, user_id=user_id, notification_type="chore_assigned",
            title="New chore assigned", message="A chore was assigned to you.",
            related_chore_id=10,
        )
        create_notification(
            session, user_id=user_id, notification_type="household_invitation",
            title="Household invitation", message="You were invited to a household.",
            related_household_id=5,
        )
        session.commit()


def test_notification_read_and_clear_flow(client: TestClient) -> None:
    headers, user_id = register_and_login(client)
    seed_notifications(user_id)
    listing = client.get("/api/v1/notifications", headers=headers)
    assert listing.status_code == 200
    body = listing.json()
    assert body["unread_count"] == 2
    assert len(body["items"]) == 2

    notification_id = body["items"][0]["id"]
    marked = client.patch(
        f"/api/v1/notifications/{notification_id}/read", headers=headers
    )
    assert marked.status_code == 200
    assert marked.json()["is_read"] is True

    after_one = client.get("/api/v1/notifications", headers=headers)
    assert after_one.json()["unread_count"] == 1

    mark_all = client.patch("/api/v1/notifications/read-all", headers=headers)
    assert mark_all.status_code == 200
    assert mark_all.json()["updated_count"] == 1

    after_all = client.get("/api/v1/notifications", headers=headers)
    assert after_all.json()["unread_count"] == 0

    cleared = client.delete("/api/v1/notifications/clear-read", headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["deleted_count"] == 2
    assert client.get("/api/v1/notifications", headers=headers).json()["items"] == []
