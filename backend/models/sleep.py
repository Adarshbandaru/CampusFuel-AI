"""Pydantic models for sleep-related requests."""
from pydantic import BaseModel
from typing import Optional


class SleepLogReq(BaseModel):
    duration_minutes: int
    quality_score: Optional[int] = 70


class SleepLogExtReq(BaseModel):
    date: str
    startTime: str
    endTime: str
    durationMinutes: int
