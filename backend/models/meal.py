"""Pydantic models for meal-related requests."""
from pydantic import BaseModel
from typing import List, Optional


class MealLogReq(BaseModel):
    name: Optional[str] = "Meal"
    items: Optional[List[str]] = []
    calories: Optional[int] = 0
    protein: Optional[int] = 0
    carbs: Optional[int] = 0
    fat: Optional[int] = 0
    date: Optional[str] = None
    loggedAt: Optional[str] = None


class SavedMealReq(BaseModel):
    name: str
    calories: int
    protein: int
    carbs: int
    fat: int


class PlateItem(BaseModel):
    item: str
    quantity: float


class PlateLog(BaseModel):
    items: List[PlateItem]
    timestamp: Optional[str] = None
