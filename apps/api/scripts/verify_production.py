r"""
Quick production smoke test.

PowerShell:
  $env:CHORERFLOW_API_URL="https://your-api.onrender.com"
  python .\scripts\verify_production.py
"""

import os
import sys

import requests


def main() -> None:
    base_url = os.getenv(
        "CHORERFLOW_API_URL",
        "",
    ).rstrip("/")

    if not base_url:
        raise SystemExit(
            "CHORERFLOW_API_URL is required.",
        )

    checks = [
        "/",
        "/api/v1/health",
    ]

    for path in checks:
        url = base_url + path

        try:
            response = requests.get(
                url,
                timeout=20,
            )
        except requests.RequestException as error:
            print(
                f"FAIL {url}: {error}",
            )
            sys.exit(1)

        print(
            f"{response.status_code} {url}",
        )

        if response.status_code != 200:
            sys.exit(1)

    print(
        "Production API smoke test passed.",
    )


if __name__ == "__main__":
    main()
