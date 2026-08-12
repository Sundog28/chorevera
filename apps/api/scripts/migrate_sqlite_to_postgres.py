"""
Safely copy an existing ChoreFlow SQLite database into an EMPTY
PostgreSQL database whose schema has already been created by Alembic.

This version also repairs legacy nullable foreign-key references that
point to rows which no longer exist. Example: old household activity
records that still reference a chore that was later deleted.

Usage from apps/api:

PowerShell:
  $env:TARGET_DATABASE_URL="postgresql://..."
  python .\scripts\migrate_sqlite_to_postgres.py

Optional:
  $env:SOURCE_SQLITE_PATH=".\choreflow.db"

Safety behavior:
- refuses to run if target application tables already contain rows
- skips alembic_version
- preserves primary-key IDs
- inserts tables in PostgreSQL dependency order
- converts orphaned *nullable* foreign keys to NULL
- refuses to silently repair orphaned non-nullable foreign keys
- resets PostgreSQL sequences after explicit-ID inserts
- verifies source/target row counts after the copy
"""

from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path
from typing import Any

from sqlalchemy import (
    MetaData,
    create_engine,
    func,
    select,
    text,
)
from sqlalchemy.engine import Connection
from sqlalchemy.sql.schema import Table


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


def get_single_primary_key(
    table: Table,
):
    primary_keys = list(
        table.primary_key.columns,
    )

    if len(primary_keys) != 1:
        return None

    return primary_keys[0]


def load_source_rows(
    connection: Connection,
    table: Table,
) -> list[dict[str, Any]]:
    return [
        dict(row)
        for row in connection.execute(
            select(
                table,
            ),
        ).mappings()
    ]


def build_source_key_sets(
    source_connection: Connection,
    source_meta: MetaData,
) -> dict[
    tuple[str, str],
    set[Any],
]:
    key_sets: dict[
        tuple[str, str],
        set[Any],
    ] = {}

    for table in source_meta.tables.values():
        if table.name in SKIP_TABLES:
            continue

        primary_key = get_single_primary_key(
            table,
        )

        if primary_key is None:
            continue

        values = set(
            source_connection.execute(
                select(
                    primary_key,
                ),
            ).scalars()
        )

        key_sets[
            (
                table.name,
                primary_key.name,
            )
        ] = values

    return key_sets


def sanitize_nullable_foreign_keys(
    *,
    table: Table,
    rows: list[dict[str, Any]],
    source_key_sets: dict[
        tuple[str, str],
        set[Any],
    ],
    repaired_counts: dict[
        str,
        int,
    ],
) -> None:
    """
    PostgreSQL enforces foreign keys strictly.

    Older SQLite data can contain historical rows whose optional
    reference points at a record that was deleted later. If the
    destination column is nullable, preserve the historical row and
    clear only that stale reference.

    Non-nullable orphaned references are treated as a hard migration
    error because silently dropping them could corrupt core data.
    """
    for foreign_key in table.foreign_keys:
        local_column = (
            foreign_key.parent
        )

        remote_column = (
            foreign_key.column
        )

        remote_table = (
            remote_column.table
        )

        remote_values = (
            source_key_sets.get(
                (
                    remote_table.name,
                    remote_column.name,
                ),
            )
        )

        if remote_values is None:
            continue

        for row in rows:
            value = row.get(
                local_column.name,
            )

            if value is None:
                continue

            if value in remote_values:
                continue

            if not local_column.nullable:
                raise SystemExit(
                    (
                        "Migration stopped: "
                        f"{table.name}."
                        f"{local_column.name}="
                        f"{value!r} references missing "
                        f"{remote_table.name}."
                        f"{remote_column.name}, and "
                        "the destination column is "
                        "not nullable."
                    ),
                )

            row[
                local_column.name
            ] = None

            repair_key = (
                f"{table.name}."
                f"{local_column.name}"
            )

            repaired_counts[
                repair_key
            ] += 1


def reset_postgres_sequence(
    connection: Connection,
    table: Table,
) -> None:
    primary_key = get_single_primary_key(
        table,
    )

    if primary_key is None:
        return

    sequence_name = connection.execute(
        text(
            "SELECT pg_get_serial_sequence("
            ":table_name, :column_name)"
        ),
        {
            "table_name":
                table.name,
            "column_name":
                primary_key.name,
        },
    ).scalar_one_or_none()

    if not sequence_name:
        return

    max_value = connection.execute(
        select(
            func.max(
                primary_key,
            ),
        ),
    ).scalar_one_or_none()

    if max_value is None:
        return

    connection.execute(
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
            (
                "SQLite source not found: "
                f"{source_path}"
            ),
        )

    if not target_url:
        raise SystemExit(
            (
                "TARGET_DATABASE_URL "
                "is required."
            ),
        )

    target_url = normalize_postgres_url(
        target_url,
    )

    if not target_url.startswith(
        "postgresql+psycopg://",
    ):
        raise SystemExit(
            (
                "TARGET_DATABASE_URL "
                "must be PostgreSQL."
            ),
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

    matching_table_names = {
        table_name
        for table_name
        in source_meta.tables
        if (
            table_name
            not in SKIP_TABLES
            and table_name
            in target_meta.tables
        )
    }

    if not matching_table_names:
        raise SystemExit(
            (
                "No matching application "
                "tables were found."
            ),
        )

    # Insert using destination dependency order.
    target_tables = [
        table
        for table
        in target_meta.sorted_tables
        if table.name
        in matching_table_names
    ]

    # Refuse to merge into a database that already has app rows.
    with target_engine.connect() as target:
        nonempty: list[
            tuple[str, int]
        ] = []

        for target_table in target_tables:
            target_count = (
                target.execute(
                    select(
                        func.count(),
                    ).select_from(
                        target_table,
                    ),
                ).scalar_one()
            )

            if target_count > 0:
                nonempty.append(
                    (
                        target_table.name,
                        target_count,
                    ),
                )

        if nonempty:
            details = ", ".join(
                (
                    f"{name}={count}"
                    for name, count
                    in nonempty
                ),
            )

            raise SystemExit(
                (
                    "Target database is not empty. "
                    "Refusing to merge rows: "
                    f"{details}"
                ),
            )

    copied_counts: dict[
        str,
        int,
    ] = {}

    repaired_counts: dict[
        str,
        int,
    ] = defaultdict(int)

    with source_engine.connect() as source:
        source_key_sets = (
            build_source_key_sets(
                source,
                source_meta,
            )
        )

        # One PostgreSQL transaction. Any failure rolls
        # back all inserted application rows.
        with target_engine.begin() as target:
            for target_table in target_tables:
                source_table = (
                    source_meta.tables[
                        target_table.name
                    ]
                )

                rows = load_source_rows(
                    source,
                    source_table,
                )

                sanitize_nullable_foreign_keys(
                    table=target_table,
                    rows=rows,
                    source_key_sets=(
                        source_key_sets
                    ),
                    repaired_counts=(
                        repaired_counts
                    ),
                )

                if rows:
                    target.execute(
                        target_table.insert(),
                        rows,
                    )

                copied_counts[
                    target_table.name
                ] = len(rows)

            # Explicit primary-key inserts do not always
            # advance PostgreSQL sequences.
            for target_table in target_tables:
                reset_postgres_sequence(
                    target,
                    target_table,
                )

    print(
        (
            "SQLite -> PostgreSQL "
            "copy complete."
        ),
    )

    if repaired_counts:
        print(
            "\nLegacy nullable references repaired:",
        )

        for key, count in sorted(
            repaired_counts.items(),
        ):
            print(
                (
                    f"REPAIRED {key}: "
                    f"{count} stale reference(s) "
                    "set to NULL"
                ),
            )

    print(
        "\nTable counts:",
    )

    with (
        source_engine.connect()
        as source,
        target_engine.connect()
        as target,
    ):
        for target_table in target_tables:
            source_table = (
                source_meta.tables[
                    target_table.name
                ]
            )

            source_count = (
                source.execute(
                    select(
                        func.count(),
                    ).select_from(
                        source_table,
                    ),
                ).scalar_one()
            )

            target_count = (
                target.execute(
                    select(
                        func.count(),
                    ).select_from(
                        target_table,
                    ),
                ).scalar_one()
            )

            marker = (
                "OK"
                if source_count
                == target_count
                else "MISMATCH"
            )

            print(
                (
                    f"{marker:8} "
                    f"{target_table.name:30} "
                    f"SQLite={source_count:<6} "
                    f"Postgres={target_count:<6}"
                ),
            )

            if source_count != target_count:
                raise SystemExit(
                    (
                        "Migration count "
                        "verification failed."
                    ),
                )

    print(
        (
            "\nAll migrated table "
            "counts match."
        ),
    )


if __name__ == "__main__":
    main()
