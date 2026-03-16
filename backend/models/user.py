"""Pydantic models for user-related requests."""
from pydantic import BaseModel
from typing import List, Optional


class UserSettings(BaseModel):
    daily_water_goal_liters: float = 4.0
    daily_calories_goal: int = 2500
    daily_protein_goal: int = 150
    xp: int = 0
    level: int = 1
    water_streak: int = 0
    sleep_streak: int = 0
    sleep_goal: int = 8
    sleep_consistency: int = 88


class UserProfileModel(BaseModel):
    uid: str
    name: str
    settings: UserSettings
    achievements: List[str] = []
    badges: List[dict] = []
    timetable: dict = {}


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    email: str
    name: str
    uid: Optional[str] = None
    photo_url: Optional[str] = None


class ProfileReq(BaseModel):
    name: str
    email: Optional[str] = None
    avatarUrl: Optional[str] = None


class HealthGoalsReq(BaseModel):
    caloriesGoal: Optional[int] = None
    proteinGoal: Optional[int] = None
    waterGoalLiters: Optional[float] = None
    sleepGoalHours: Optional[int] = None
    goalType: Optional[str] = None
    heightCm: Optional[float] = None
    weightKg: Optional[float] = None
    targetWeightKg: Optional[float] = None


class PreferencesReq(BaseModel):
    themeMode: Optional[str] = None
    notificationsEnabled: Optional[bool] = None
    waterReminderIntervalHours: Optional[int] = None
    sleepTargetHour: Optional[int] = None
    developerMode: Optional[bool] = None


class StreakUpdateReq(BaseModel):
    water: Optional[int] = None
    protein: Optional[int] = None
    calories: Optional[int] = None
    sleep: Optional[int] = None
