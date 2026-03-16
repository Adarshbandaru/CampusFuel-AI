from .users import router as users_router
from .meals import router as meals_router
from .water import router as water_router
from .sleep import router as sleep_router
from .weight import router as weight_router
from .coach import router as coach_router
from .analytics import router as analytics_router
from .timetable import router as timetable_router

ALL_ROUTERS = [
    users_router,
    meals_router,
    water_router,
    sleep_router,
    weight_router,
    coach_router,
    analytics_router,
    timetable_router,
]
