"""Timetable router — weekly schedule CRUD."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from db import db
from utils import get_user_or_404

router = APIRouter(prefix="/users", tags=["timetable"])


class TimetableEntry(BaseModel):
    day: str
    time: str
    subject: str
    type: Optional[str] = "lecture"


class TimetableUpdate(BaseModel):
    entries: List[TimetableEntry]


@router.get("/{uid}/timetable")
def get_timetable(uid: str):
    user = get_user_or_404(uid)
    return {"timetable": user.get("timetable", {})}


@router.post("/{uid}/timetable")
def save_timetable(uid: str, timetable: dict):
    db.collection("users").document(uid).set(
        {"timetable": timetable}, merge=True
    )
    return {"status": "success"}
