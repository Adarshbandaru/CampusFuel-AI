import firebase_admin
from firebase_admin import credentials, firestore

def run_diag():
    cred = credentials.Certificate("C:/Users/adars/OneDrive/Desktop/CampusFuel AI/backend/serviceAccountKey.json")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("--- Detailed Firestore Users Check ---")
    users = db.collection("users").get()
    print(f"Total Users in 'users' collection: {len(users)}")
    for u in users:
        data = u.to_dict()
        profile = data.get('profile', {})
        print(f"UID: {u.id}, Email: {profile.get('email')}, Name: {profile.get('name')}")

    print("\n--- Collections Check ---")
    for coll in db.collections():
        print(f"Collection: {coll.id}")

run_diag()
