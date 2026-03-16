"""
auth.py
Firebase token verification helper.
"""

from fastapi import HTTPException
from db import db


def get_user_or_404(uid: str) -> dict:
    """Fetch a user document from Firestore. Raise 404 if not found."""
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    return doc.to_dict()


def get_user_optional(uid: str):
    """Fetch a user document, return None if not found."""
    doc = db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None
