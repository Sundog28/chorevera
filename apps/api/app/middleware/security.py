from __future__ import annotations

import asyncio
import math
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Awaitable, Callable
from uuid import uuid4
import re

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int


def extract_client_ip(
    request: Request,
    *,
    trust_proxy_headers: bool,
) -> str:
    if trust_proxy_headers:
        forwarded_for = request.headers.get(
            "x-forwarded-for",
            "",
        )

        if forwarded_for:
            candidate = forwarded_for.split(",", 1)[0].strip()

            if candidate:
                return candidate[:64]

    if request.client is not None:
        return request.client.host[:64]

    return "unknown"


REQUEST_ID_PATTERN = re.compile(
    r"^[A-Za-z0-9._:-]{1,64}$"
)


def safe_request_id(
    request: Request,
) -> str:
    supplied = request.headers.get(
        "x-request-id",
        "",
    ).strip()

    if REQUEST_ID_PATTERN.fullmatch(
        supplied,
    ):
        return supplied

    return str(uuid4())


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        is_production: bool,
    ) -> None:
        super().__init__(app)
        self.is_production = is_production

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = safe_request_id(
            request,
        )
        request.state.request_id = request_id

        response = await call_next(request)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"

        # Swagger/ReDoc load browser assets. Keep the API's strict CSP away
        # from those development documentation pages.
        if request.url.path not in {
            "/docs",
            "/redoc",
            "/openapi.json",
        }:
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "frame-ancestors 'none'; "
                "base-uri 'none'"
            )

        if request.url.path.startswith("/api/v1/auth"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"

        if self.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        rules: dict[str, RateLimitRule],
        enabled: bool,
        trust_proxy_headers: bool,
    ) -> None:
        super().__init__(app)
        self.rules = rules
        self.enabled = enabled
        self.trust_proxy_headers = trust_proxy_headers
        self._buckets: dict[
            tuple[str, str],
            deque[float],
        ] = defaultdict(deque)
        self._lock = asyncio.Lock()
        self._last_cleanup = time.monotonic()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not self.enabled:
            return await call_next(request)

        rule = self.rules.get(request.url.path)

        if rule is None:
            return await call_next(request)

        client_ip = extract_client_ip(
            request,
            trust_proxy_headers=self.trust_proxy_headers,
        )
        key = (
            client_ip,
            request.url.path,
        )
        now = time.monotonic()

        async with self._lock:
            bucket = self._buckets[key]
            cutoff = now - rule.window_seconds

            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= rule.limit:
                retry_after = max(
                    1,
                    math.ceil(
                        rule.window_seconds
                        - (now - bucket[0])
                    ),
                )

                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": (
                            "Too many requests. "
                            "Please try again later."
                        ),
                    },
                    headers={
                        "Retry-After": str(retry_after),
                    },
                )

            bucket.append(now)

            # Periodically remove empty/stale buckets so a long-running
            # single-process server does not accumulate unbounded keys.
            if now - self._last_cleanup >= 300:
                stale_keys: list[
                    tuple[str, str]
                ] = []

                for bucket_key, timestamps in self._buckets.items():
                    bucket_rule = self.rules.get(
                        bucket_key[1],
                    )

                    if bucket_rule is None:
                        stale_keys.append(bucket_key)
                        continue

                    bucket_cutoff = (
                        now
                        - bucket_rule.window_seconds
                    )

                    while (
                        timestamps
                        and timestamps[0] <= bucket_cutoff
                    ):
                        timestamps.popleft()

                    if not timestamps:
                        stale_keys.append(bucket_key)

                for stale_key in stale_keys:
                    self._buckets.pop(stale_key, None)

                self._last_cleanup = now

        return await call_next(request)
