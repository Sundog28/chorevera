from hashlib import sha256

from fastapi import Request
from sqlmodel import Session

from app.config import settings
from app.middleware.security import extract_client_ip
from app.models.security_audit import SecurityAuditLog


def hash_identifier(
    identifier: str | None,
) -> str | None:
    if not identifier:
        return None

    normalized = identifier.strip().lower()

    if not normalized:
        return None

    return sha256(
        normalized.encode("utf-8"),
    ).hexdigest()


def record_security_event(
    session: Session,
    request: Request,
    *,
    event_type: str,
    success: bool,
    user_id: int | None = None,
    identifier: str | None = None,
    commit: bool = True,
) -> SecurityAuditLog:
    audit_log = SecurityAuditLog(
        user_id=user_id,
        event_type=event_type,
        success=success,
        identifier_hash=hash_identifier(
            identifier,
        ),
        client_ip=extract_client_ip(
            request,
            trust_proxy_headers=(
                settings.trust_proxy_headers
            ),
        ),
        user_agent=request.headers.get(
            "user-agent",
            "",
        )[:255],
        request_id=(
            getattr(
                request.state,
                "request_id",
                "",
            )
            or request.headers.get(
                "x-request-id",
                "",
            )
        )[:64],
    )

    session.add(audit_log)

    if commit:
        session.commit()

    return audit_log
