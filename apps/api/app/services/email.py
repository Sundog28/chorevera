from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings


logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> None:
    if not settings.smtp_host:
        logger.warning(
            "\n"
            "================ CHOREFLOW EMAIL ================\n"
            "To: %s\n"
            "Subject: %s\n\n"
            "%s\n"
            "=================================================\n",
            to_email,
            subject,
            text_body,
        )

        return

    if (
        settings.smtp_use_tls
        and settings.smtp_use_ssl
    ):
        raise RuntimeError(
            "SMTP_USE_TLS and SMTP_USE_SSL "
            "cannot both be enabled.",
        )

    message = EmailMessage()
    message["From"] = (
        settings.smtp_from_email
    )
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(
        text_body,
    )

    if html_body:
        message.add_alternative(
            html_body,
            subtype="html",
        )

    context = (
        ssl.create_default_context()
    )

    if settings.smtp_use_ssl:
        smtp_client: (
            smtplib.SMTP_SSL
            | smtplib.SMTP
        ) = smtplib.SMTP_SSL(
            settings.smtp_host,
            settings.smtp_port,
            timeout=20,
            context=context,
        )
    else:
        smtp_client = smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=20,
        )

    with smtp_client as smtp:
        if (
            settings.smtp_use_tls
            and not settings.smtp_use_ssl
        ):
            smtp.starttls(
                context=context,
            )

        if settings.smtp_username:
            smtp.login(
                settings.smtp_username,
                settings.smtp_password,
            )

        smtp.send_message(
            message,
        )
