"""Water router — water logging CRUD."""

from fastapi import APIRouter
from datetime import date, datetime
from firebase_admin import firestore
from db import db

router = APIRouter(prefix="/users", tags=["water"])


@router.post("/{uid}/water")
def log_water_legacy(uid: str, amount_ml: int = 0):
    """Legacy endpoint: accumulates into a single daily document."""
    today_str = date.today().isoformat()
    ref = db.collection("water").document(f"{uid}_{today_str}")
    doc = ref.get()
    current = doc.to_dict() if doc.exists else {"amount_ml": 0}
    new_amount = current["amount_ml"] + amount_ml
    ref.set({
        "uid": uid, "date": today_str,
        "amount_ml": new_amount, "last_logged": datetime.now().isoformat(),
    })
    return {"status": "success", "new_total_ml": new_amount}


@router.post("/{uid}/water/log")
def save_water_log(uid: str, amount_ml: int = 0):
    """New-style: creates individual waterLog records."""
    today_str = date.today().isoformat()
    db.collection("waterLogs").document().set({
        "userId": uid, "amountMl": amount_ml,
        "date": today_str, "loggedAt": datetime.now().isoformat(),
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return {"status": "success"}


@router.get("/{uid}/water/logs")
def get_all_water_logs(uid: str):
    docs = db.collection("waterLogs").where("userId", "==", uid).get()
    logs = [{"id": d.id, **d.to_dict()} for d in docs]
    logs.sort(key=lambda x: x.get("loggedAt", ""), reverse=True)
    return {"status": "success", "logs": logs}


@router.get("/{uid}/water/date/{date_str}")
def get_water_for_date(uid: str, date_str: str):
    docs = (
        db.collection("waterLogs")
        .where("userId", "==", uid)
        .where("date", "==", date_str)
        .get()
    )
    total = sum(d.to_dict().get("amountMl", 0) for d in docs)
    return {"status": "success", "totalMl": total}


@router.delete("/{uid}/water/{log_id}")
def delete_water_log(uid: str, log_id: str):
    db.collection("waterLogs").document(log_id).delete()
    return {"status": "success"}
