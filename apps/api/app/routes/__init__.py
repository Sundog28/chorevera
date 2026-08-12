from app.routes.auth import router as auth_router
from app.routes.billing import router as billing_router
from app.routes.chores import router as chores_router
from app.routes.features import router as features_router
from app.routes.household_activities import router as household_activities_router
from app.routes.household_invitations import router as household_invitations_router
from app.routes.households import router as households_router
from app.routes.notifications import router as notifications_router
from app.routes.progress import router as progress_router

__all__ = [
    "auth_router", "billing_router", "chores_router", "features_router",
    "household_activities_router", "household_invitations_router",
    "households_router", "notifications_router", "progress_router",
]
