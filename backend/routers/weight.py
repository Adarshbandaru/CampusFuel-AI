"""Weight router — weight logging + projection."""

from fastapi import APIRouter
from datetime import date, datetime
from firebase_admin import firestore
from db import db
from models.weight import WeightLogReq
from services.prediction_engine import project_weight

router = APIRouter(prefix="/users", tags=["weight"])


@router.post("/{uid}/weight")
def log_weight(uid: str, req: WeightLogReq):
    db.collection("weightLogs").document().set({
        "userId": uid, "weightKg": req.weight_kg,
        "date": date.today().isoformat(),
        "loggedAt": datetime.now().isoformat(),
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return {"status": "success"}


@router.get("/{uid}/weight")
def get_weight_logs(uid: str):
    docs = db.collection("weightLogs").where("userId", "==", uid).get()
    logs = [{"id": d.id, **d.to_dict()} for d in docs]
    logs.sort(key=lambda x: x.get("loggedAt", ""), reverse=True)
    return {"status": "success", "logs": logs}


@router.get("/{uid}/weight/latest")
def get_latest_weight(uid: str):
    docs = db.collection("weightLogs").where("userId", "==", uid).get()
    logs = [{"id": d.id, **d.to_dict()} for d in docs]
    if not logs:
        return {"status": "success", "latest": None}
    logs.sort(key=lambda x: x.get("loggedAt", ""), reverse=True)
    return {"status": "success", "latest": logs[0]}


@router.get("/{uid}/weight/projection")
def get_weight_projection(uid: str):
    """Real weight projection using linear regression on last 14 days."""
    docs = db.collection("weightLogs").where("userId", "==", uid).get()
    logs = [d.to_dict() for d in docs]
    # Sort by date and take last 14 entries
    logs.sort(key=lambda x: x.get("date", ""))
    recent = logs[-14:] if len(logs) > 14 else logs
    return project_weight(recent)
