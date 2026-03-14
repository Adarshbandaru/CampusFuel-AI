# CampusFuel AI 🚀

A modern health & habit tracking app for hostel students. Helps you track water, meals, and your timetable effortlessly.

## Tech Stack
- **Frontend**: React Native (Expo Router) for cross-platform (Android/iOS)
- **Backend**: FastAPI (Python)
- **Database/Push**: Firebase & Expo Notifications (pre-installed, needs your project keys)

---

## Getting Started

### 1. Run the Backend Server
Open your terminal in this directory:
```powershell
cd backend
.\venv\Scripts\activate
# If the activation fails because of execution policies, run: Set-ExecutionPolicy Unrestricted -Scope CurrentUser

uvicorn main:app --reload
```
The FastAPI server will start on `http://localhost:8000`.

### 2. Run the Mobile App
Open a *new* terminal window in this directory:
```powershell
cd frontend
npx expo start
```
- Press **a** to run on your Android Emulator, or
- Download the **Expo Go** app on your physical phone and scan the QR code in the terminal.

---

## Features Implemented
- **Login / Signup Screen**: Minimalistic authentication interface.
- **Dashboard**: High-level overview of daily water progress, meals, nutrition, and an aggregated habit score.
- **Meal Log**: Quick interface to track meals with calorie/protein metrics.
- **Water Tracker**: Tap to log glasses of water, complete with an interactive progress visualization.
- **Timetable Scanner**: Upload a timetable so the app knows when you are in class.
- **Settings**: Adjust daily goals and manage notification preferences.

## Next Steps for Firebase Integration
We've set up the packages (`firebase`, `firebase-admin`, `expo-notifications`). To fully enable Firebase DB and Push Notifications:
1. Create a project on the [Firebase Console](https://console.firebase.google.com/).
2. Get your `google-services.json` and initialize `firebase` in `frontend/src/firebase.js`.
3. Feed your service account credentials into `backend/main.py` using `firebase_admin.credentials.Certificate("path/to/key.json")`.
