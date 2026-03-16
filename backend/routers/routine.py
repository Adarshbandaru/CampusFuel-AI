from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import date
from utils import get_user_or_404
from services.routine_engine import generate_routine_plan
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users", tags=["routine"])

@router.get("/{uid}/routine-plan")
async def get_routine_plan(uid: str, authorization: str = Header(None)):
    if not authorization:
        # Simplistic authorization check fallback; in real life use Firebase decode
        pass

    today_str = date.today().isoformat()
    try:
        plan = await generate_routine_plan(uid, today_str)
        return {"status": "success", **plan}
    except Exception as e:
        logger.error(f"Error generating routine plan for {uid}: {e}")
        # Return elegant failure so we never 500 unhandled
        return {
            "status": "error",
            "message": "Routine engine temporarily unavailable.",
            "morning_tip": "Add your class timetable to unlock your full daily plan.",
            "hydration_tip": "Aim to drink water every 2 hours throughout the day.",
            "workout_window": "Try a 30-minute workout between 5–7 PM.",
            "sleep_tip": "Wind down by 11PM for a full 8 hours of sleep.",
            "exam_mode": False
        }
