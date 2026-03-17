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

def _init_firebase():
    if firebase_admin._apps:
        return

    firebase_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")

    if not firebase_json:
        # Fallback for local development or individual env vars
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized from serviceAccountKey.json")
            return
        
        # Check individual env vars as final fallback
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
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email.replace('@', '%40')}",
                "universe_domain": "googleapis.com",
            }
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized from individual environment variables.")
            return

        raise RuntimeError("Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT (JSON string) or provide serviceAccountKey.json.")

    try:
        # Handle case where FIREBASE_SERVICE_ACCOUNT might be a path
        if os.path.exists(firebase_json):
            cred = credentials.Certificate(firebase_json)
            firebase_admin.initialize_app(cred)
            print(f"✅ Firebase initialized from file: {firebase_json}")
            return

        # Assume it's a JSON string
        cred_dict = json.loads(firebase_json)

        # 🔥 FIX: convert \\n → real newline
        if "private_key" in cred_dict:
            cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")

        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)

        print("✅ Firebase initialized successfully from JSON string")

    except Exception as e:
        raise RuntimeError(f"Firebase init failed: {e}")

_init_firebase()

db = firestore.client()
"""Shared Firestore client — import this in all routers and services."""
