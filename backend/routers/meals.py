"""Meals router — meal logging CRUD."""

from fastapi import APIRouter
from datetime import date, datetime
from firebase_admin import firestore
from db import db
from models.meal import MealLogReq, SavedMealReq
from utils import get_user_or_404

router = APIRouter(prefix="/users", tags=["meals"])


@router.get("/{uid}/meals/all")
def get_all_meal_logs(uid: str):
    docs = db.collection("mealLogs").where("userId", "==", uid).get()
    logs = [{"id": d.id, **d.to_dict()} for d in docs]
    logs.sort(key=lambda x: x.get("date", ""), reverse=True)
    return {"status": "success", "logs": logs}


@router.get("/{uid}/meals/date/{date_str}")
def get_meals_for_date(uid: str, date_str: str):
    docs = (
        db.collection("mealLogs")
        .where("userId", "==", uid)
        .where("date", "==", date_str)
        .get()
    )
    logs = [{"id": d.id, **d.to_dict()} for d in docs]
    return {"status": "success", "logs": logs}


@router.post("/{uid}/meals/log")
def save_meal_log(uid: str, req: MealLogReq):
    today_str = date.today().isoformat()
    db.collection("mealLogs").document().set({
        "userId": uid,
        "name": req.name or "Meal",
        "items": req.items or [],
        "calories": req.calories or 0,
        "protein": req.protein or 0,
        "carbs": req.carbs or 0,
        "fat": req.fat or 0,
        "date": req.date or today_str,
        "loggedAt": req.loggedAt or datetime.now().isoformat(),
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return {"status": "success"}


@router.post("/{uid}/meals")
def log_meal_saved(uid: str, meal: SavedMealReq):
    today_str = date.today().isoformat()
    db.collection("mealLogs").document().set({
        "userId": uid,
        "name": meal.name,
        "calories": meal.calories,
        "protein": meal.protein,
        "carbs": meal.carbs,
        "fat": meal.fat,
        "date": today_str,
        "loggedAt": datetime.now().isoformat(),
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    return {"status": "success"}


@router.post("/{uid}/meal/plate")
def log_meal_plate(uid: str, meal: dict):
    meal["userId"] = uid
    if "date" not in meal:
        meal["date"] = date.today().isoformat()
    db.collection("mealLogs").document().set(meal)
    return {"status": "success"}


@router.delete("/{uid}/meals/{log_id}")
def delete_meal_log(uid: str, log_id: str):
    db.collection("mealLogs").document(log_id).delete()
    return {"status": "success"}


@router.get("/{uid}/nutrition/recommendations")
def get_meal_recommendations(uid: str):
    user = get_user_or_404(uid)
    settings = user.get("settings", {})
    goals = user.get("goals", {})
    
    goal_cal = goals.get("caloriesGoal", settings.get("daily_calories_goal", 2500))
    goal_pro = goals.get("proteinGoal", settings.get("daily_protein_goal", 150))
    
    today_str = date.today().isoformat()
    docs = db.collection("mealLogs").where("userId", "==", uid).where("date", "==", today_str).get()
    meals = [d.to_dict() for d in docs]
    
    cals = sum(m.get("calories", 0) for m in meals)
    pro = sum(m.get("protein", 0) for m in meals)
    
    rem_cal = max(0, goal_cal - cals)
    rem_pro = max(0, goal_pro - pro)
    
    recommendations = []
    
    if rem_cal > 800:
        recommendations.append({"name": "Grilled Chicken Rice Bowl", "calories": 650, "protein": 45, "match": "95%"})
        recommendations.append({"name": "Large Steak Salad", "calories": 750, "protein": 50, "match": "92%"})
    elif rem_cal > 400:
        recommendations.append({"name": "Turkey Wrap", "calories": 350, "protein": 30, "match": "90%"})
        recommendations.append({"name": "Protein Oatmeal", "calories": 300, "protein": 25, "match": "88%"})
    else:
        recommendations.append({"name": "Greek Yogurt & Berries", "calories": 150, "protein": 15, "match": "98%"})
        recommendations.append({"name": "Protein Shake", "calories": 120, "protein": 25, "match": "95%"})
        
    return {
        "status": "success",
        "remaining": {"calories": rem_cal, "protein": rem_pro},
        "recommendations": recommendations,
    }
