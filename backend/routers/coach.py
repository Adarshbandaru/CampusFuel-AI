"""Coach router — AI coach chat."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import date, datetime
from db import db
from utils import get_user_or_404

router = APIRouter(prefix="/users", tags=["coach"])


class CoachChatRequest(BaseModel):
    message: str = ""
    metrics: Optional[Dict] = None


@router.post("/{uid}/coach/chat")
def coach_chat(uid: str, req: CoachChatRequest):
    user = get_user_or_404(uid)
    settings = user.get("settings", {})
    goals = user.get("goals", {})
    today_str = date.today().isoformat()

    # Fetch real data
    water_doc = db.collection("water").document(f"{uid}_{today_str}").get()
    water_info = water_doc.to_dict() if water_doc.exists else {"amount_ml": 0}
    meals = [d.to_dict() for d in
             db.collection("meals").where("uid", "==", uid).where("date", "==", today_str).get()]

    water_liters = water_info["amount_ml"] / 1000.0
    calories = sum(m.get("calories", 0) for m in meals)
    protein = sum(m.get("protein", 0) for m in meals)

    goal_cal = goals.get("caloriesGoal", settings.get("daily_calories_goal", 2500))
    goal_pro = goals.get("proteinGoal", settings.get("daily_protein_goal", 150))
    goal_water = float(goals.get("waterGoalLiters", settings.get("daily_water_goal_liters", 4.0)))
    goal_sleep = goals.get("sleepGoalHours", settings.get("sleep_goal", 8))

    # Energy prediction model
    sleep_ratio = min(1.0, 7.5 / max(1, goal_sleep))
    cal_ratio = min(1.0, calories / max(1, goal_cal))
    pro_ratio = min(1.0, protein / max(1, goal_pro))
    water_ratio = min(1.0, water_liters / max(0.1, goal_water))

    energy_level = int(
        (sleep_ratio * 35) + (cal_ratio * 25) + (pro_ratio * 20) + (water_ratio * 20)
    )

    # Generate insights
    insights = []
    protein_gap = goal_pro - protein
    calorie_gap = goal_cal - calories
    water_remaining = goal_water - water_liters
    hour = datetime.now().hour

    if protein_gap > goal_pro * 0.5 and hour > 14:
        insights.append(f"Protein Alert: You need {protein_gap}g more.")
    if water_remaining > goal_water * 0.5 and hour > 12:
        insights.append(f"Hydration behind: {water_remaining:.1f}L remaining.")
    if calorie_gap > 500 and hour > 16:
        insights.append(f"Under-eating: You're {calorie_gap} kcal short.")
    if energy_level < 50:
        insights.append(f"Energy prediction: {energy_level}/100.")

    if not insights:
        if calories > 0 or water_liters > 0:
            score = int((cal_ratio + pro_ratio + water_ratio) / 3 * 100)
            insights.append(f"Looking good! Score: {score}/100 for today.")
        else:
            insights.append("Start logging your meals and water!")

    # Suggestions
    suggestions = []
    if protein_gap > 30:
        suggestions = ["Greek yogurt", "Egg whites", "Protein shake", "Paneer"]
    elif calorie_gap > 500:
        suggestions = ["Banana", "Peanut butter", "Oats with milk", "Rice & dal"]
    else:
        suggestions = ["Keep it up!", "Stay consistent", "Log your next meal"]

    data_points = sum([calories > 0, protein > 0, water_liters > 0, len(meals) > 0])
    confidence = int((data_points / 4) * 100)

    return {
        "reply": " | ".join(insights),
        "suggestions": suggestions[:4],
        "energy_level": energy_level,
        "confidence_score": confidence,
        "metrics": {
            "calories": {"current": calories, "goal": goal_cal, "gap": calorie_gap},
            "protein": {"current": protein, "goal": goal_pro, "gap": protein_gap},
            "water": {"current": round(water_liters, 1), "goal": goal_water,
                       "gap": round(water_remaining, 1)},
        },
    }
