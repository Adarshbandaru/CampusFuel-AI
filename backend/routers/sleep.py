"""Sleep router — sleep logging CRUD."""

from fastapi import APIRouter
from datetime import date, datetime
from firebase_admin import firestore
from db import db
from models.sleep import SleepLogReq, SleepLogExtReq

router = APIRouter(prefix="/users", tags=["sleep"])


@router.post("/{uid}/sleep")
def log_sleep_legacy(uid: str, req: SleepLogReq):
    """Legacy endpoint: duration + quality score."""
    today_str = date.today().isoformat()
    db.collection("sleep").document(f"{uid}_{today_str}").set({
        "uid": uid, "date": today_str,
        "duration_minutes": req.duration_minutes,
        "quality_score": req.quality_score,
        "timestamp": datetime.now().isoformat(),
    })
    return {"status": "success"}


@router.post("/{uid}/sleep/log")
def save_sleep_log(uid: str, req: SleepLogExtReq):
    """New-style: full sleep log with start/end times."""
    db.collection("sleepLogs").document().set({
        "userId": uid, "date": req.date,
        "startTime": req.startTime, "endTime": req.endTime,
        "durationMinutes": req.durationMinutes,
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return {"status": "success"}


@router.get("/{uid}/sleep/all")
def get_all_sleep_logs(uid: str):
    docs = db.collection("sleepLogs").where("userId", "==", uid).get()
    logs = [{"id": d.id, **d.to_dict()} for d in docs]
    logs.sort(key=lambda x: x.get("date", ""), reverse=True)
    return {"status": "success", "logs": logs}


@router.get("/{uid}/sleep/date/{date_str}")
def get_sleep_for_date(uid: str, date_str: str):
    docs = (
        db.collection("sleepLogs")
        .where("userId", "==", uid)
        .where("date", "==", date_str)
        .get()
    )
    if not docs:
        return {"status": "success", "log": None}
    d = docs[0]
    return {"status": "success", "log": {"id": d.id, **d.to_dict()}}
