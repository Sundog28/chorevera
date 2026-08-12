from urllib.parse import (
    parse_qs,
    urlparse,
)

from fastapi.testclient import TestClient


def authenticated_headers(
    client: TestClient,
) -> dict[str, str]:
    email = "progress@example.com"
    password = "SecurePassword123!"

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Progress User",
            "email": email,
            "password": password,
        },
    )

    token = parse_qs(
        urlparse(
            registration.json()[
                "development_url"
            ],
        ).query,
    )["verify_token"][0]

    client.post(
        (
            "/api/v1/auth/"
            "email-verification/confirm"
        ),
        json={
            "token": token,
        },
    )

    login = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    access_token = login.json()[
        "access_token"
    ]

    return {
        "Authorization": (
            f"Bearer {access_token}"
        ),
    }


def test_progress_snapshot_and_history(
    client: TestClient,
) -> None:
    headers = authenticated_headers(
        client,
    )

    first = client.put(
        "/api/v1/progress/snapshot",
        headers=headers,
        json={
            "progress_date": (
                "2026-07-30"
            ),
            "total_count": 4,
            "completed_count": 4,
        },
    )

    assert first.status_code == 200
    assert (
        first.json()[
            "all_completed"
        ]
        is True
    )

    second = client.put(
        "/api/v1/progress/snapshot",
        headers=headers,
        json={
            "progress_date": (
                "2026-07-31"
            ),
            "total_count": 5,
            "completed_count": 3,
        },
    )

    assert second.status_code == 200

    history = client.get(
        (
            "/api/v1/progress/"
            "history?days=3650"
        ),
        headers=headers,
    )

    assert history.status_code == 200

    body = history.json()

    assert body["recorded_days"] == 2
    assert body["perfect_days"] == 1
    assert len(body["history"]) == 2


def test_progress_import_upserts_dates(
    client: TestClient,
) -> None:
    headers = authenticated_headers(
        client,
    )

    imported = client.post(
        "/api/v1/progress/import",
        headers=headers,
        json={
            "snapshots": [
                {
                    "progress_date": (
                        "2026-07-29"
                    ),
                    "total_count": 2,
                    "completed_count": 2,
                },
                {
                    "progress_date": (
                        "2026-07-30"
                    ),
                    "total_count": 4,
                    "completed_count": 1,
                },
            ],
        },
    )

    assert imported.status_code == 200
    assert (
        imported.json()[
            "recorded_days"
        ]
        == 2
    )

    updated = client.post(
        "/api/v1/progress/import",
        headers=headers,
        json={
            "snapshots": [
                {
                    "progress_date": (
                        "2026-07-30"
                    ),
                    "total_count": 4,
                    "completed_count": 4,
                },
            ],
        },
    )

    assert updated.status_code == 200

    july_30 = next(
        item
        for item in updated.json()[
            "history"
        ]
        if item["progress_date"]
        == "2026-07-30"
    )

    assert (
        july_30[
            "all_completed"
        ]
        is True
    )
