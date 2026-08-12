from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    status,
)

from app.dependencies import (
    CurrentUserDependency,
    SessionDependency,
)
from app.schemas.progress import (
    ProgressDayResponse,
    ProgressHistoryResponse,
    ProgressImportRequest,
    ProgressSnapshotUpsert,
)
from app.services.progress import (
    build_progress_history,
    upsert_progress_snapshot,
)


router = APIRouter(
    prefix="/api/v1/progress",
    tags=["Progress"],
)


def require_user_id(
    current_user: CurrentUserDependency,
) -> int:
    if current_user.id is None:
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "User account has no "
                "database ID."
            ),
        )

    return current_user.id


@router.get(
    "/history",
    response_model=(
        ProgressHistoryResponse
    ),
)
def get_progress_history(
    current_user: CurrentUserDependency,
    session: SessionDependency,
    days: int = Query(
        default=365,
        ge=1,
        le=3_650,
    ),
) -> ProgressHistoryResponse:
    user_id = require_user_id(
        current_user,
    )

    return build_progress_history(
        session,
        user_id,
        days,
    )


@router.put(
    "/snapshot",
    response_model=ProgressDayResponse,
)
def save_progress_snapshot(
    snapshot: ProgressSnapshotUpsert,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ProgressDayResponse:
    user_id = require_user_id(
        current_user,
    )

    progress = upsert_progress_snapshot(
        session,
        user_id,
        snapshot,
    )

    session.commit()
    session.refresh(
        progress,
    )

    return ProgressDayResponse.model_validate(
        progress,
    )


@router.post(
    "/import",
    response_model=(
        ProgressHistoryResponse
    ),
)
def import_progress_history(
    request: ProgressImportRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ProgressHistoryResponse:
    user_id = require_user_id(
        current_user,
    )

    for snapshot in request.snapshots:
        upsert_progress_snapshot(
            session,
            user_id,
            snapshot,
        )

    session.commit()

    return build_progress_history(
        session,
        user_id,
        days=3_650,
    )
