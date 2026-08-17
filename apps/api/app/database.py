from collections.abc import Generator

from sqlmodel import (
    Session,
    create_engine,
)

from app.config import settings


def normalize_database_url(
    database_url: str,
) -> str:
    """
    Render supplies PostgreSQL URLs in the standard
    postgresql:// form. Chorevera uses psycopg 3, so
    normalize PostgreSQL URLs to SQLAlchemy's explicit
    psycopg dialect.
    """
    if database_url.startswith(
        "postgres://",
    ):
        return (
            "postgresql+psycopg://"
            + database_url[
                len("postgres://"):
            ]
        )

    if database_url.startswith(
        "postgresql://",
    ):
        return (
            "postgresql+psycopg://"
            + database_url[
                len("postgresql://"):
            ]
        )

    return database_url


database_url = normalize_database_url(
    settings.database_url,
)


engine_options: dict[
    str,
    object,
] = {
    "echo": (
        settings.environment
        == "development"
    ),
    "pool_pre_ping": True,
}


if database_url.startswith(
    "sqlite",
):
    engine_options[
        "connect_args"
    ] = {
        "check_same_thread": False,
    }
else:
    engine_options.update(
        {
            "pool_size":
                settings.db_pool_size,
            "max_overflow":
                settings.db_max_overflow,
            "pool_timeout":
                settings.db_pool_timeout_seconds,
            "pool_recycle":
                settings.db_pool_recycle_seconds,
        },
    )


engine = create_engine(
    database_url,
    **engine_options,
)


def get_session() -> Generator[
    Session,
    None,
    None,
]:
    with Session(
        engine,
    ) as session:
        yield session

