r"""
Copy an existing ChoreFlow SQLite database into an EMPTY
PostgreSQL database whose schema has already been created
with Alembic.

Usage from apps/api:

PowerShell:
  $env:TARGET_DATABASE_URL="postgresql://..."
  python .\scripts\migrate_sqlite_to_postgres.py

Optional:
  $env:SOURCE_SQLITE_PATH=".\choreflow.db"

Safety behavior:
- refuses to run if the target contains application rows
- skips alembic_version
- preserves primary-key IDs
- resets PostgreSQL sequences after inserts
- prints per-table source/target counts
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import (
    MetaData,
    create_engine,
    func,
    select,
    text,
)


SKIP_TABLES = {
    "alembic_version",
    "sqlite_sequence",
}


def normalize_postgres_url(
    database_url: str,
) -> str:
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


def main() -> None:
    source_path = Path(
        os.getenv(
            "SOURCE_SQLITE_PATH",
            "choreflow.db",
        ),
    ).resolve()

    target_url = os.getenv(
        "TARGET_DATABASE_URL",
        "",
    ).strip()

    if not source_path.exists():
        raise SystemExit(
            f"SQLite source not found: {source_path}",
        )

    if not target_url:
        raise SystemExit(
            "TARGET_DATABASE_URL is required.",
        )

    target_url = normalize_postgres_url(
        target_url,
    )

    if not target_url.startswith(
        "postgresql+psycopg://",
    ):
        raise SystemExit(
            "TARGET_DATABASE_URL must be PostgreSQL.",
        )

    source_engine = create_engine(
        (
            "sqlite:///"
            + source_path.as_posix()
        ),
    )

    target_engine = create_engine(
        target_url,
        pool_pre_ping=True,
    )

    source_meta = MetaData()
    source_meta.reflect(
        bind=source_engine,
    )

    target_meta = MetaData()
    target_meta.reflect(
        bind=target_engine,
    )

    source_tables = [
        table
        for table in source_meta.sorted_tables
        if table.name not in SKIP_TABLES
        and table.name in target_meta.tables
    ]

    if not source_tables:
        raise SystemExit(
            "No matching application tables were found.",
        )

    # Refuse to merge into a database that already has rows.
    with target_engine.connect() as target:
        nonempty = []

        for source_table in source_tables:
            target_table = (
                target_meta.tables[
                    source_table.name
                ]
            )

            target_count = target.execute(
                select(
                    func.count(),
                ).select_from(
                    target_table,
                ),
            ).scalar_one()

            if target_count > 0:
                nonempty.append(
                    (
                        source_table.name,
                        target_count,
                    ),
                )

        if nonempty:
            details = ", ".join(
                (
                    f"{name}={count}"
                    for name, count in nonempty
                ),
            )

            raise SystemExit(
                "Target database is not empty. "
                f"Refusing to merge rows: {details}",
            )

    copied_counts: dict[
        str,
        int,
    ] = {}

    with (
        source_engine.connect() as source,
        target_engine.begin() as target,
    ):
        for source_table in source_tables:
            target_table = (
                target_meta.tables[
                    source_table.name
                ]
            )

            rows = [
                dict(row)
                for row in source.execute(
                    select(
                        source_table,
                    ),
                ).mappings()
            ]

            if rows:
                target.execute(
                    target_table.insert(),
                    rows,
                )

            copied_counts[
                source_table.name
            ] = len(rows)

        # Explicit primary-key inserts do not always advance
        # PostgreSQL sequences. Reset serial/identity sequences.
        for table_name in copied_counts:
            target_table = (
                target_meta.tables[
                    table_name
                ]
            )

            primary_keys = list(
                target_table.primary_key.columns,
            )

            if len(primary_keys) != 1:
                continue

            primary_key = primary_keys[0]

            sequence_name = target.execute(
                text(
                    "SELECT pg_get_serial_sequence("
                    ":table_name, :column_name)"
                ),
                {
                    "table_name": table_name,
                    "column_name":
                        primary_key.name,
                },
            ).scalar_one_or_none()

            if not sequence_name:
                continue

            max_value = target.execute(
                select(
                    func.max(
                        primary_key,
                    ),
                ),
            ).scalar_one_or_none()

            if max_value is None:
                continue

            target.execute(
                text(
                    "SELECT setval("
                    "CAST(:sequence_name AS regclass), "
                    ":max_value, true)"
                ),
                {
                    "sequence_name":
                        sequence_name,
                    "max_value":
                        int(max_value),
                },
            )

    print(
        "SQLite -> PostgreSQL copy complete.",
    )

    print(
        "\nTable counts:",
    )

    with (
        source_engine.connect() as source,
        target_engine.connect() as target,
    ):
        for source_table in source_tables:
            target_table = (
                target_meta.tables[
                    source_table.name
                ]
            )

            source_count = source.execute(
                select(
                    func.count(),
                ).select_from(
                    source_table,
                ),
            ).scalar_one()

            target_count = target.execute(
                select(
                    func.count(),
                ).select_from(
                    target_table,
                ),
            ).scalar_one()

            marker = (
                "OK"
                if source_count
                == target_count
                else "MISMATCH"
            )

            print(
                f"{marker:8} "
                f"{source_table.name:30} "
                f"SQLite={source_count:<6} "
                f"Postgres={target_count:<6}",
            )

            if source_count != target_count:
                raise SystemExit(
                    "Migration count verification failed.",
                )

    print(
        "\nAll migrated table counts match.",
    )


if __name__ == "__main__":
    main()
