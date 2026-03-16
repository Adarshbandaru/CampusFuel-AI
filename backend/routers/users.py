"""Users router — profile, goals, preferences, auth, XP, streaks, onboarding."""

from fastapi import APIRouter
from datetime import date
from db import db
from utils import get_user_or_404, get_user_optional
from models.user import (
    GoogleAuthRequest, ProfileReq, HealthGoalsReq,
    PreferencesReq, StreakUpdateReq,
)

router = APIRouter(prefix="/users", tags=["users"])

DEFAULT_GOALS = {
    "caloriesGoal": 2500, "proteinGoal": 150,
    "waterGoalLiters": 4.0, "sleepGoalHours": 8, "goalType": "maintenance",
}
DEFAULT_PREFS = {
    "themeMode": "system", "notificationsEnabled": True,
    "waterReminderIntervalHours": 2, "sleepTargetHour": 23, "developerMode": False,
}
DEFAULT_STREAKS = {
    "water": 0, "protein": 0, "calories": 0, "sleep": 0, "lastUpdatedDate": "",
}


# ─── Auth ────────────────────────────────────────────────────────────────

@router.post("/auth/google")
def google_auth(req: GoogleAuthRequest):
    raw_uid = req.uid if req.uid else req.email.replace(".", "_")
    uid = str(raw_uid)
    user = get_user_optional(uid)

    if not user:
        user_data = {
            "uid": uid, "name": req.name, "photo_url": req.photo_url,
            "settings": {
                "daily_water_goal_liters": 4.0, "daily_calories_goal": 2500,
                "daily_protein_goal": 150, "xp": 0, "level": 1,
                "water_streak": 0, "sleep_streak": 0, "sleep_goal": 8,
                "sleep_consistency": 88,
            },
            "achievements": [], "badges": [], "timetable": {}, "weight_history": [],
        }
        db.collection("users").document(uid).set(user_data)
        user = user_data
    else:
        user["name"] = req.name
        user["photo_url"] = req.photo_url
        db.collection("users").document(uid).set(user)

    return {"status": "success", "user": user, "token": "dummy_" + uid}


# ─── Profile ─────────────────────────────────────────────────────────────

@router.get("/{uid}/profile")
def get_profile(uid: str):
    user = get_user_or_404(uid)
    return user.get("profile", {})


@router.post("/{uid}/profile")
def save_profile(uid: str, req: ProfileReq):
    db.collection("users").document(uid).set(
        {"profile": req.dict()}, merge=True
    )
    return {"status": "success"}


# ─── Goals ────────────────────────────────────────────────────────────────

@router.get("/{uid}/goals")
def get_goals(uid: str):
    user = get_user_or_404(uid)
    goals = user.get("goals", {})
    settings = user.get("settings", {})
    
    if "waterGoalLiters" not in goals and "daily_water_goal_liters" in settings:
        goals["waterGoalLiters"] = settings["daily_water_goal_liters"]
    if "caloriesGoal" not in goals and "daily_calories_goal" in settings:
        goals["caloriesGoal"] = settings["daily_calories_goal"]
    if "proteinGoal" not in goals and "daily_protein_goal" in settings:
        goals["proteinGoal"] = settings["daily_protein_goal"]
    if "sleepGoalHours" not in goals and "sleep_goal" in settings:
        goals["sleepGoalHours"] = settings["sleep_goal"]
        
    return {**DEFAULT_GOALS, **goals}


@router.post("/{uid}/goals")
def save_goals(uid: str, req: HealthGoalsReq):
    goals_data = {k: v for k, v in req.dict().items() if v is not None}
    db.collection("users").document(uid).set({"goals": goals_data}, merge=True)
    return {"status": "success"}


# ─── Preferences ──────────────────────────────────────────────────────────

@router.get("/{uid}/preferences")
def get_preferences(uid: str):
    user = get_user_or_404(uid)
    return {**DEFAULT_PREFS, **user.get("preferences", {})}


@router.post("/{uid}/preferences")
def save_preferences(uid: str, req: PreferencesReq):
    prefs_data = {k: v for k, v in req.dict().items() if v is not None}
    db.collection("users").document(uid).set({"preferences": prefs_data}, merge=True)
    return {"status": "success"}


# ─── XP ───────────────────────────────────────────────────────────────────

@router.get("/{uid}/xp")
def get_xp(uid: str):
    user = get_user_or_404(uid)
    return {"xp": user.get("xp", 0)}


@router.post("/{uid}/xp/add")
def add_xp(uid: str, amount: int = 0):
    user = get_user_or_404(uid)
    new_xp = user.get("xp", 0) + amount
    db.collection("users").document(uid).update({"xp": new_xp})
    return {"xp": new_xp}


# ─── Streaks ──────────────────────────────────────────────────────────────

@router.get("/{uid}/streaks")
def get_streaks(uid: str):
    user = get_user_or_404(uid)
    return {**DEFAULT_STREAKS, **user.get("streaks", {})}


@router.post("/{uid}/streaks")
def update_streaks(uid: str, req: StreakUpdateReq):
    user = get_user_or_404(uid)
    current = user.get("streaks", {**DEFAULT_STREAKS})
    updates = {k: v for k, v in req.dict().items() if v is not None}
    updated = {**current, **updates, "lastUpdatedDate": date.today().isoformat()}
    db.collection("users").document(uid).set({"streaks": updated}, merge=True)
    return updated


@router.post("/{uid}/streaks/{key}/reset")
def reset_streak(uid: str, key: str):
    user = get_user_or_404(uid)
    current = user.get("streaks", {**DEFAULT_STREAKS})
    current[key] = 0
    db.collection("users").document(uid).set({"streaks": current}, merge=True)
    return {"status": "success"}


# ─── Onboarding ───────────────────────────────────────────────────────────

@router.get("/{uid}/onboarding")
def get_onboarding_status(uid: str):
    user = get_user_optional(uid)
    if not user:
        return {"completed": False}
    return {"completed": user.get("onboardingCompleted", False)}


@router.post("/{uid}/onboarding/complete")
def set_onboarding_complete(uid: str):
    db.collection("users").document(uid).set({"onboardingCompleted": True}, merge=True)
    return {"status": "success"}
