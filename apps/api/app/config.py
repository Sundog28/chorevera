import os

from pydantic import Field
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    app_name: str = "ChoreFlow API"
    environment: str = "development"
    database_url: str = (
        "sqlite:///./choreflow.db"
    )
    frontend_url: str = (
        "http://localhost:5173"
    )

    # Database pool settings.
    db_pool_size: int = Field(
        default=5,
        ge=1,
        le=50,
    )
    db_max_overflow: int = Field(
        default=5,
        ge=0,
        le=100,
    )
    db_pool_timeout_seconds: int = Field(
        default=30,
        ge=1,
        le=300,
    )
    db_pool_recycle_seconds: int = Field(
        default=300,
        ge=30,
        le=86_400,
    )

    jwt_secret_key: str = Field(
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "choreflow-api"
    jwt_audience: str = "choreflow-web"

    access_token_expire_minutes: int = Field(
        default=60,
        ge=1,
        le=10_080,
    )

    email_verification_expire_minutes: int = Field(
        default=1_440,
        ge=5,
        le=10_080,
    )

    password_reset_expire_minutes: int = Field(
        default=30,
        ge=5,
        le=1_440,
    )

    smtp_host: str = ""
    smtp_port: int = Field(
        default=587,
        ge=1,
        le=65_535,
    )
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = (
        "ChoreFlow <noreply@choreflow.local>"
    )
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_family_price_id: str = ""
    stripe_checkout_success_url: str = (
        "http://localhost:5173/"
        "?checkout=success"
    )
    stripe_checkout_cancel_url: str = (
        "http://localhost:5173/"
        "?checkout=cancelled"
    )
    stripe_portal_return_url: str = (
        "http://localhost:5173/"
    )

    trusted_hosts_csv: str = (
        "localhost,127.0.0.1,testserver"
    )
    cors_allowed_origins_csv: str = ""
    force_https: bool = False
    docs_enabled: bool = True
    rate_limit_enabled: bool = True
    trust_proxy_headers: bool = False

    auth_login_rate_limit: int = Field(
        default=10,
        ge=1,
        le=10_000,
    )
    auth_login_rate_window_seconds: int = Field(
        default=60,
        ge=1,
        le=86_400,
    )
    auth_sensitive_rate_limit: int = Field(
        default=5,
        ge=1,
        le=10_000,
    )
    auth_sensitive_rate_window_seconds: int = Field(
        default=300,
        ge=1,
        le=86_400,
    )

    @property
    def trusted_hosts(self) -> list[str]:
        configured = [
            item.strip()
            for item
            in self.trusted_hosts_csv.split(
                ",",
            )
            if item.strip()
        ]

        # Render supplies the service's exact public
        # hostname at runtime. Add it automatically so
        # TrustedHostMiddleware remains strict without
        # requiring the hostname before first deploy.
        render_hostname = os.getenv(
            "RENDER_EXTERNAL_HOSTNAME",
            "",
        ).strip()

        if (
            render_hostname
            and render_hostname
            not in configured
        ):
            configured.append(
                render_hostname,
            )

        return configured

    @property
    def cors_allowed_origins(
        self,
    ) -> list[str]:
        configured = [
            item.strip().rstrip("/")
            for item
            in self.cors_allowed_origins_csv.split(
                ",",
            )
            if item.strip()
        ]

        frontend_origin = (
            self.frontend_url.rstrip("/")
        )

        if (
            frontend_origin
            and frontend_origin
            not in configured
        ):
            configured.append(
                frontend_origin,
            )

        return configured

    @property
    def is_production(self) -> bool:
        return (
            self.environment.lower()
            == "production"
        )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
