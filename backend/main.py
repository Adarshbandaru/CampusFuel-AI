"""
CampusFuel AI — FastAPI Backend
================================

Application entry point. Initializes middleware and mounts all API routers.

Router structure:
  /users          — auth, profile, goals, preferences, XP, streaks, onboarding
  /users/{uid}/meals   — meal logging CRUD
  /users/{uid}/water   — water logging CRUD
  /users/{uid}/sleep   — sleep logging CRUD
  /users/{uid}/weight  — weight logging + projection
  /users/{uid}/coach   — AI coach chat
  /users/{uid}/*       — analytics, dashboard, heatmap, reports, summaries
  /users/{uid}/timetable — weekly schedule CRUD
  /users/{uid}/routine — daily routine CRUD

Modules:
  db/              — shared Firestore client
  models/          — Pydantic request/response models
  services/        — business logic (score, analytics, prediction, nutrition)
  utils/           — auth helpers, structured logging
  routers/         — all API route handlers
"""

import sys
import os

# Ensure the backend directory is in the Python path so that
# absolute imports (db, models, services, etc.) resolve correctly
# when running with `uvicorn main:app` from the backend directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from routers import ALL_ROUTERS  # type: ignore
from routers import routine  # type: ignore

app = FastAPI(
    title="CampusFuel AI Backend",
    description="Health tracking API for college students.",
    version="2.0.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────
allowed_origins = [
    "http://localhost:8081",
    "http://localhost:19006",
    "https://campusfuel.app",
    os.environ.get("FRONTEND_URL", "*")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mount all routers ────────────────────────────────────────────────────
for router in ALL_ROUTERS:
    app.include_router(router)
app.include_router(routine.router)

# ─── Health check ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Dev server ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn  # type: ignore
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
