"""
firestore_client.py
Single shared Firestore client instance.
All routers and services import `db` from here.
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()


import json

def _init_firebase() -> None:
    """Initialize Firebase Admin SDK from environment variables or fallback JSON."""
    if firebase_admin._apps:
        return

    # In production: load from environment variable (JSON string)
    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    
    if service_account_json and not os.path.exists(service_account_json):
        try:
            cred_dict = json.loads(service_account_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized from FIREBASE_SERVICE_ACCOUNT environment variable.")
            return
        except json.JSONDecodeError:
            print("❌ FIREBASE_SERVICE_ACCOUNT is not a valid JSON string.")

    # Fallback to individual environment variables
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")

    if project_id and private_key and client_email:
        service_account_info = {
            "type": "service_account",
            "project_id": project_id,
            "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
            "private_key": private_key.replace("\\n", "\n"),
            "client_email": client_email,
            "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": (
                f"https://www.googleapis.com/robot/v1/metadata/x509/"
                f"{client_email.replace('@', '%40')}"
            ),
            "universe_domain": "googleapis.com",
        }
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized from individual environment variables.")
    else:
        # Fallback to file
        fallback = os.getenv("FIREBASE_SERVICE_ACCOUNT", "serviceAccountKey.json")
        if os.path.exists(fallback):
            cred = credentials.Certificate(fallback)
            firebase_admin.initialize_app(cred)
            print(f"⚠️  Firebase initialized from {fallback}.")
        else:
            raise RuntimeError(
                "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT (JSON string), "
                "or individual FIREBASE_* env vars, or provide a serviceAccountKey.json file."
            )

_init_firebase()

db = firestore.client()
"""Shared Firestore client — import this in all routers and services."""
