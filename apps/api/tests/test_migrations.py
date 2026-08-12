from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_alembic_upgrade_creates_current_schema(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "migration-test.db"
    project_root = Path(__file__).resolve().parents[1]

    config = Config(
        str(project_root / "alembic.ini"),
    )
    config.set_main_option(
        "script_location",
        str(project_root / "alembic"),
    )
    config.attributes["database_url"] = (
        "sqlite:///"
        f"{database_path.as_posix()}"
    )

    command.upgrade(config, "head")

    engine = create_engine(
        "sqlite:///"
        f"{database_path.as_posix()}"
    )

    tables = set(
        inspect(engine).get_table_names(),
    )

    assert "users" in tables
    assert "auth_tokens" in tables
    assert "daily_progress" in tables
    assert "notifications" in tables
    assert "security_audit_logs" in tables
    assert "alembic_version" in tables
