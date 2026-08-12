from logging.config import (
    fileConfig,
)

from alembic import context
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlmodel import SQLModel

from app.config import settings

# Import all models so SQLModel metadata is complete.
from app import models  # noqa: F401


config = context.config


def normalize_database_url(
    database_url: str,
) -> str:
    """
    Use psycopg 3 explicitly for PostgreSQL.

    Render provides PostgreSQL connection strings in
    postgresql:// form. SQLAlchemy 2.0 interprets that
    form with the psycopg2 driver by default, while
    ChoreFlow installs psycopg 3.

    SQLite URLs are returned unchanged.
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


database_url = (
    config.attributes.get(
        "database_url",
    )
    or settings.database_url
)

database_url = normalize_database_url(
    database_url,
)

config.set_main_option(
    "sqlalchemy.url",
    database_url,
)

if (
    config.config_file_name
    is not None
):
    fileConfig(
        config.config_file_name,
    )


target_metadata = SQLModel.metadata


def run_migrations_offline():
    context.configure(
        url=(
            config.get_main_option(
                "sqlalchemy.url",
            )
        ),
        target_metadata=(
            target_metadata
        ),
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = (
        config.get_section(
            config.config_ini_section,
        )
        or {}
    )

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=(
                target_metadata
            ),
            compare_type=True,
            render_as_batch=(
                connection.dialect.name
                == "sqlite"
            ),
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
